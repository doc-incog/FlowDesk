// Load the per-collection JSON emitted by migration/seed.py --out into MongoDB
// using the official `mongodb` Node driver (no pymongo/mongosh required).
//
// Usage (Node >= 18, run from repo root):
//   export MONGODB_URI='mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority'
//   node migration/load_seed.mjs
//
// Reads JSON from migration/out/*.json into the database named by MONGODB_DB
// (default "flowdesk"). Each collection is dropped and re-inserted, so the load
// is idempotent.
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = process.env.SEED_DIR || path.join(here, 'out');
const dbName = process.env.MONGODB_DB || 'flowdesk';
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGODB_URI (e.g. mongodb+srv://<user>:<pass>@host/db).');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

let total = 0;
const files = fs.readdirSync(seedDir).filter((f) => f.endsWith('.json'));
for (const f of files) {
  const coll = path.basename(f, '.json');
  const docs = JSON.parse(fs.readFileSync(path.join(seedDir, f), 'utf8'));
  if (!Array.isArray(docs) || docs.length === 0) continue;
  const c = db.collection(coll);
  await c.deleteMany({});
  const r = await c.insertMany(docs, { ordered: false });
  total += r.insertedCount;
  console.log(`loaded ${coll.padEnd(26)} n=${r.insertedCount}`);
}
console.log('TOTAL', total);
await client.close();