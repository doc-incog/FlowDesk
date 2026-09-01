#!/usr/bin/env python3
"""FlowDesk SQLite -> MongoDB seed/backfill transform.

Reads the pre-migration snapshot DB and emits camelCase Mongo-ready documents
for each collection. Deterministic and verifiable without a live MongoDB,
with two consumption paths:

  1. JSON pass (stdlib-only, always produces per-collection .json files).
  2. Direct Mongo load when `--mongo-uri` is provided (uses pymongo if
     available, otherwise emits a `migration/load.sh` that runs `mongosh`
     `mongosh.load()` / or `mongoimport` per file).

Usage:
    python migration/seed.py --db <snapshot.db> [--out <dir>]
    python migration/seed.py --db <snapshot.db> --mongo-uri "mongodb+srv://..." [--mongo-db flowdesk]

Example:
    python migration/seed.py --db C:/Users/lenovo/AppData/Local/Temp/opencode/flowdesk-snapshot-pre-migration.db --out migration/out
    python migration/seed.py --db C:/Users/lenovo/AppData/Local/Temp/opencode/flowdesk-snapshot-pre-migration.db --mongo-uri "mongodb+srv://user:pass@cluster0.example.mongodb.net" --mongo-db flowdesk
    python migration/seed.py --db C:/Users/lenovo/AppData/Local/Temp/opencode/flowdesk-snapshot-pre-migration.db --out migration/out && python migration/load.sh
"""
import argparse
import json
import os
import re
import sqlite3
import sys


def rows(db, table: str):
    cur = db.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    return cols, cur.fetchall()


def to_jsonable(v, key: str):
    """Coerce sqlite values; numeric-looking stays numeric, dates stay strings."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        # Keep numbers as numbers for these known numeric columns; everything
        # else stays as-is (sqlite already returns numbers for numeric columns).
        if key in {"semester", "max_marks", "amount", "rating", "seats", "score"}:
            return v
        return v
    return v


# sqlite has no boolean type; these columns are stored as 0/1 ints but the Rust
# backend reads them as full BSON booleans (and *filters* on them in query
# predicates, e.g. `doc! { "is_deleted": false }`). MongoDB treats int 0 and
# bool false as distinct, so we must lift these to real booleans.
BOOL_COLUMNS = {"anonymous", "builtin", "hidden", "is_deleted", "read", "sender_deleted", "sensorConnected"}


def transform(db) -> dict:
    """Return mapping collection -> list of documents.

    IMPORTANT (Mongo field naming): the Rust backend reads *snake_case* Mongo
    field names everywhere (e.g. `password_hash`, `is_deleted`, `user_id`,
    `created_at`, `conversation_id`). The JSON API camelCases on output in the
    helpers/routes, but the *stored* documents are snake_case. So this
    transform preserves snake_case column names verbatim and only promotes the
    primary key column (id / token / key / device_id) to `_id`.
    """
    out: dict = {}
    tables = [
        "admission_applications", "assignments", "check_ins", "complaints",
        "conversation_participants", "conversations", "exams", "fee_items",
        "feedback_entries", "feedback_targets", "fingerprint_commands",
        "fingerprint_device_health", "fingerprint_devices", "fingerprint_templates",
        "mentors", "messages", "notification_reads", "notifications", "programs",
        "receipts", "results", "role_permissions", "roles", "schedule_slots",
        "scholarship_applications", "scholarships", "sessions", "submissions",
        "user_permissions", "users", "withdrawals",
    ]
    for table in tables:
        cols, data = rows(db, table)
        coll = "fees" if table == "fee_items" else table
        coll = coll.replace("conversation_participants", "conversation_reads")
        docs = []
        for row in data:
            doc = {}
            for c, v in zip(cols, row):
                # Promote the primary key column to `_id`; keep other field
                # names untouched (snake_case, matching the Rust backend reads).
                if c in ("id", "token", "key", "device_id"):
                    k = "_id"
                else:
                    k = c
                jv = to_jsonable(v, c)
                if jv is None:
                    continue
                if c in BOOL_COLUMNS:
                    jv = bool(jv)
                doc[k] = jv
            # mentees: csv of names -> keep as raw for snapshot fidelity (no user ids)
            if table == "mentors" and isinstance(doc.get("mentees"), str):
                doc["mentees"] = [s.strip() for s in doc["mentees"].split(",") if s.strip()]
            docs.append(doc)
        out.setdefault(coll, []).extend(docs)
    return out


def write_json(result: dict, out: str) -> int:
    """Write per-collection .json files; returns total doc count."""
    os.makedirs(out, exist_ok=True)
    total = 0
    for coll, docs in sorted(result.items()):
        path = os.path.join(out, f"{coll}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False)
        total += len(docs)
        print(f"{coll:28s} {len(docs):5d}")
    return total


def write_load_sh(out: str) -> str:
    """Write a bash script that loads each collection via `mongoimport`.
    Returns path to the script."""
    collections = sorted(f[:-5] for f in os.listdir(out) if f.endswith(".json"))
    lines = [
        "#!/usr/bin/env bash",
        "# Generated by migration/seed.py. Loads transformed JSON into MongoDB.",
        "# Usage: MONGODB_URI='mongodb+srv://...' FLOWDESK_DB=flowdesk bash migration/load.sh",
        "set -euo pipefail",
        ": \"${MONGODB_URI:?set MONGODB_URI to the Atlas connection string}\"",
        ": \"${FLOWDESK_DB:=flowdesk}\"",
        "",
        "cd \"$(dirname \"$0\")\"",
        "",
    ]
    for coll in collections:
        # --drop first so the snapshot is authoritative and re-runs are clean.
        lines.append(
            f"mongoimport --uri=\"$MONGODB_URI\" --db=\"$FLOWDESK_DB\" "
            f"--collection=\"{coll}\" --file=\"{coll}.json\" --drop"
        )
    lines.append("")
    path = os.path.join(out, "load.sh")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path


def load_with_pymongo(uri: str, dbname: str, result: dict) -> None:
    """Maintains string _ids and does upserts; requires `pymongo`."""
    try:
        import pymongo
    except Exception as exc:  # pragma: no cover - importerror only
        sys.exit(f"pymongo not installed and no mongosh fallback requested. Run `pip install pymongo`, or use --out then load.sh. ({exc})")
    client = pymongo.MongoClient(uri)
    try:
        db = client[dbname]
        for coll, docs in sorted(result.items()):
            coll = db[coll]
            total = 0
            for doc in docs:
                _id = str(doc["_id"])
                coll.replace_one({"_id": _id}, {**doc, "_id": _id}, upsert=True)
                total += 1
            print(f"{coll.name:28s} {total:5d}")
        print("done: pymongo")
    finally:
        client.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", default="out", help="output dir for per-collection .json")
    ap.add_argument("--mongo-uri", help="MongoDB connection string (loads directly via pymongo, else emits load.sh)")
    ap.add_argument("--mongo-db", default="flowdesk", help="MongoDB database name (default: flowdesk)")
    args = ap.parse_args()

    db = sqlite3.connect(args.db)
    result = transform(db)
    db.close()

    total = write_json(result, args.out)
    print(f"\ncollections: {len(result)}  total docs: {total}")
    print(f"output: {os.path.abspath(args.out)}")

    if args.mongo_uri:
        if import_pymongo_ok():
            load_with_pymongo(args.mongo_uri, args.mongo_db, result)
        else:
            sys.exit("--mongo-uri provided but pymongo is unavailable; install it and re-run, or use --out + load.sh")
        return

    path = write_load_sh(args.out)
    print("\nTo load into MongoDB without pymongo: "
          "MONGODB_URI='<atlas-uri>' FLOWDESK_DB=flowdesk bash " + path)


def import_pymongo_ok() -> bool:
    try:
        import pymongo  # noqa: F401
        return True
    except Exception:
        return False


if __name__ == "__main__":
    main()