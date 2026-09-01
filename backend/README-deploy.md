# Deploying the FlowDesk backend (Rust / Axum)

This file walks you through provisioning the two cloud resources and wiring the
Netlify frontend to the migrated backend. The backend is a Docker-built Rust
service that reads a MongoDB Atlas database seeded from the pre-migration
Snapshot.

Target: `https://flowdesk-campus.netlify.app` → proxies `/api/*` →
`https://<your-service>.onrender.com/api/*` → MongoDB Atlas.

---

## Prerequisites

- A GitHub account (already connected to Netlify).
- Accounts to create (free tiers are fine): **MongoDB Atlas** and **Render**.
  You already have a **Render** account.

---

## 1. Create a MongoDB Atlas cluster

1. Go to https://account.mongodb.com/account/register — create a free MongoDB
   Atlas account (or log in if you have one).
2. Click **Create** / New Deployment; choose the **FREE (M0) Shared** tier.
3. Keep the default cloud provider/region (or pick a nearby region).
4. Click **Create Deployment**.
5. Set a **Database User**:
   - Username: e.g. `flowdesk`
   - Password: a strong one that only you know — **save it**.
6. **Add Your IP**: leave the default "My Local IP" or choose "Add Access from
   Anywhere" (`0.0.0.0/0`) for simplicity during setup.
7. Click **Finish and Close**.
8. On the cluster page click **Connect → Drivers**:
   - Driver **Node.js**, version **4.1+**.
   - Replace `<password>` in the shown URI with your real user password to get
     the full connection string, e.g.:

   ```
   mongodb+srv://flowdesk:<password>@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

   Keep the **entire URI** — you'll paste it into Render (step 3) and use it to
   seed the database (step 4).

---

## 2. Deploy the backend on Render (one click)

You have a Render account already.

1. Push this repo to GitHub (the `migration/rust-backend` branch).
2. In Render: **New → Blueprint**.
3. Choose this GitHub repo, and point it at the `render.yaml` file in the repo
   root.
4. Render shows a **Blueprint** ("flowdesk-backend"). Click **Apply**.
5. It will build `./backend/Dockerfile` and start the service. Note the auto
   generated URL, e.g. `https://flowdesk-backend-XXXX.onrender.com`.

> The Blueprint marks `MONGODB_URI` and `JWT_SECRET` as **secret env vars**
> (`sync: false`). Enter them before the first successful deploy:
> - On the service **Environment** tab add:
>   - `MONGODB_URI` → your Atlas connection string from step 1
>   - `JWT_SECRET` → a long random string. You may use:
>     `EAMkAR2GUm1x2h0k8gbdg1hSdpiUaK4yI2Ir6rNRiFSl6Aim`

Render injects `PORT` automatically; the backend binds `0.0.0.0:<PORT>`.

Health check: the `render.yaml` sets `/healthz` — the service is alive when it
returns `{"status":"ok"}`.

---

## 3. Seed the database

From a terminal (Python 3 with `pymongo`, or the mongosh path):

```bash
# Transform + load the pre-migration snapshot into Atlas.
# (pymongo path)
python migration/seed.py \
  --db "C:/Users/lenovo/AppData/Local/Temp/opencode/flowdesk-snapshot-pre-migration.db" \
  --mongo-uri "mongodb+srv://flowdesk:<password>@cluster0....mongodb.net/..." \
  --mongo-db flowdesk
```

Or, without pymongo — this writes JSON + a `load.sh` script you run with
`mongosh`/`mongoimport`:

```bash
python migration/seed.py --db "<snapshot>" --out migration/out
MONGODB_URI='mongodb+srv://<password>@...' FLOWDESK_DB=flowdesk bash migration/out/load.sh
```

After seeding, the `users` collection contains the demo account:
`admin@flowdesk.edu` / `flowdesk-admin@2026`.

Verify:
```bash
mongosh "MONGODB_URI/flowdesk" --eval 'db.users.countDocuments()'   # => 9
```

---

## 4. Point Netlify at the backend

The Next.js frontend calls same-origin `/api/*`. Add a **proxy rewrite** so
Netlify forwards `/api/*` to Render, keeping cookies on the `flowdesk-campus`
origin.

In the root `netlify.toml`, add:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://<your-service>.onrender.com/api/:splat"
  status = 200
  force = true
```

Then redeploy Netlify (auto-deploys on push to the connected branch).

> The legacy Next.js `/api/*` route handlers must be excluded/shadowed so they
> don't intercept the rewrite. See `netlify.toml` in the repo for the working
> configuration.

---

## 5. Verify login

```bash
curl -i -X POST https://flowdesk-campus.netlify.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@flowdesk.edu","password":"flowdesk-admin@2026"}'
```

Expect `200 OK` and a `Set-Cookie: flowdesk.session=...` header. Then:

```bash
curl -i https://flowdesk-campus.netlify.app/api/auth/me \
  -H 'Cookie: flowdesk.session=<token>'
```

should return the admin profile. The `/dashboard` page then loads for the admin.

---

## Environment variables (reference)

| Variable          | Where           | Example                                                        |
|-------------------|-----------------|----------------------------------------------------------------|
| `MONGODB_URI`     | Render secret   | `mongodb+srv://flowdesk:<pass>@cluster0....mongodb.net/?...`   |
| `JWT_SECRET`      | Render secret   | `EAMkAR2GUm1x2h0k8gbdg1hSdpiUaK4yI2Ir6rNRiFSl6Aim`            |
| `MONGODB_DB`      | Render env      | `flowdesk`                                                     |
| `SESSION_COOKIE`  | Render env      | `flowdesk.session`                                             |
| `CORS_ORIGINS`    | Render env      | `https://flowdesk-campus.netlify.app`                          |
| `DATA_DIR`        | Render env      | `/app/.data` (uploads/docs)                                    |
| `PORT`            | Render (auto)   | `8080`                                                         |

Note: `FLOWDESK_SEED` is read from env but **unused** by the backend — seeding
is intentional and done only via `migration/seed.py`.