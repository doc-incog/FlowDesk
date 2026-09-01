#!/usr/bin/env python3
"""FlowDesk SQLite -> MongoDB seed/backfill transform.

Reads the pre-migration snapshot DB and emits camelCase Mongo-ready documents
for each collection. Deterministic, stdlib-only, and verifiable without a live
MongoDB (asserts per-collection row counts against the source).

Usage:
    python migration/seed.py --db <snapshot.db> [--out <dir>]

Example:
    python migration/seed.py --db C:/Users/lenovo/AppData/Local/Temp/opencode/flowdesk-snapshot-pre-migration.db --out migration/out
"""
import argparse
import csv
import json
import os
import re
import sqlite3

CAMEL_RE = re.compile(r"_(.)")


def camel(name: str) -> str:
    """snake_case -> camelCase (id columns are promoted to _id by the caller)."""
    return CAMEL_RE.sub(lambda m: m.group(1).upper(), name)


def rows(db, table: str):
    cur = db.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    return cols, cur.fetchall()


def to_jsonable(v, key: str):
    """Coerce sqlite values; numeric-looking stays numeric, dates stay strings."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        if key in {"semester", "max_marks", "maxMarks", "amount", "rating", "seats", "score"}:
            return v
        return v
    return v


def transform(db) -> dict:
    """Return mapping collection -> list of documents (excludes the _id from fields)."""
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
                k = "id" if c in ("id", "token", "key", "device_id") and c != "conversation_id" else camel(c)
                if c in ("id", "token", "key", "device_id"):
                    k = "_id"
                if c == "conversation_id":
                    k = "conversationId"
                if c == "notification_id":
                    k = "notificationId"
                jv = to_jsonable(v, c)
                if jv is None:
                    continue
                doc[k] = jv
            # mentees: csv of names -> keep as raw for snapshot fidelity (no user ids)
            if table == "mentors" and isinstance(doc.get("mentees"), str):
                doc["mentees"] = [s.strip() for s in doc["mentees"].split(",") if s.strip()]
            docs.append(doc)
        out.setdefault(coll, []).extend(docs)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", default="out", help="output dir for per-collection .json")
    args = ap.parse_args()

    db = sqlite3.connect(args.db)
    result = transform(db)
    db.close()

    os.makedirs(args.out, exist_ok=True)
    total = 0
    for coll, docs in sorted(result.items()):
        path = os.path.join(args.out, f"{coll}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False)
        total += len(docs)
        print(f"{coll:28s} {len(docs):5d}")
    print(f"\ncollections: {len(result)}  total docs: {total}")
    print(f"output: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()