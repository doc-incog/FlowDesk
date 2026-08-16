# Deploying FlowDesk to an Android phone (Termux)

Run FlowDesk as a live server on an Android phone. The app is **built on a PC**
and the precompiled output is **run** on the phone via Termux — no on-device
compilation needed.

Why this works: `next build` needs Next's Rust (SWC) compiler, which has no
official Android build, but `next start` only *serves* already-compiled output.
We verified that `next start` runs a fully working app (login, APIs, PDF
generation, middleware) with the SWC native binary removed entirely.

## What you need

- An Android phone (tested target: Redmi Note 8, arm64, 4 GB RAM, Android 9+/MIUI).
- A PC with `pnpm` and the repo cloned.
- Phone and PC on the same Wi-Fi (for the initial transfer + LAN access).
- The GitHub repo is public: `https://github.com/doc-incog/FlowDesk.git`.

## Part A — PC: build the transfer bundle

From `flowdesk-app/`:

```bash
pnpm build
mkdir -p dist
tar -czf dist/next-android.tar.gz --exclude='.next/cache' --exclude='.next/dev' .next
```

Or use the helper: `./scripts/build-android-bundle.sh` (does a clean build +
bundle). The bundle is ~3 MB and is regenerated on every rebuild.

> Do not include `.next/cache` / `.next/dev` — `next start` does not need them.

## Part B — Phone: install Termux + Node

1. Install **Termux from F-Droid** (https://f-droid.org/packages/com.termux/).
   The Play Store version is abandoned and will not work.
2. Open Termux and run:

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts openssh net-tools
```

3. Verify Node and the built-in SQLite driver:

```bash
node --version            # expect v24.x (or v22.x)
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE t(x)'); console.log('sqlite OK')"
```

If the second command fails, see Troubleshooting.

4. (For scp) set a password and start the SSH server:

```bash
passwd                    # set any password
sshd                      # runs on port 8022
```

5. Note your phone's IP and username:

```bash
whoami
ifconfig                  # look for 192.168.x.x (wlan0)
```

## Part C — Get the code + bundle onto the phone

Clone the repo (public, no token needed):

```bash
git clone https://github.com/doc-incog/FlowDesk.git
cd FlowDesk/flowdesk-app
```

Install dependencies (the SWC binary for Android does not exist on npm, but
that is fine — `next start` does not need it, and install succeeds anyway):

```bash
npm i -g pnpm
pnpm install
```

Copy the build bundle from the PC (replace `<user>` with your `whoami` result
and `<phone-ip>` with the phone's IP):

```bash
# on the PC:
scp -P 8022 flowdesk-app/dist/next-android.tar.gz <user>@<phone-ip>:
```

Then on the phone, extract it over the local `.next`:

```bash
tar -xzf ~/next-android.tar.gz -C $HOME/FlowDesk/flowdesk-app
```

> No scp? `termux-setup-storage` unlocks `/sdcard` — copy the tar via USB into
> `Download/` and use `cp /sdcard/Download/next-android.tar.gz $HOME/`.

## Part D — Run the server

```bash
pkg install termux-api      # provides termux-wake-lock (needs the Termux:API app from F-Droid)
termux-wake-lock            # keep Node alive when the screen is off
cd $HOME/FlowDesk/flowdesk-app
pnpm start                  # next start on port 3000
```

The first start creates and seeds a fresh `.data/` database (SQLite) inside
`flowdesk-app/`. It persists across restarts.

Verify on the phone:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/    # expect 200
```

Verify from the PC (same Wi-Fi):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://<phone-ip>:3000/    # expect 200
```

Then open `http://<phone-ip>:3000` in a browser and test login, the dashboard,
and a PDF download.

## Part E — Public URL (optional, free)

Primary — Cloudflare tunnel (no account needed):

```bash
pkg install cloudflared
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `https://<random>.trycloudflare.com` URL — reachable from
anywhere while the process runs.

Fallback — Pinggy (zero install, but free sessions cap at 60 minutes):

```bash
ssh -p 443 -R0:localhost:3000 free.pinggy.io
```

## Part F — Keep it alive on MIUI (important)

Android/MIUI aggressively kills background processes. The phone must stay in
charge of this:

1. Settings → Apps → Termux → Battery → **Unrestricted**.
2. Keep the phone plugged in (prevents throttling + Doze suspension).
3. Run `termux-wake-lock` before starting the server (Part D).
4. Disable any MIUI "Battery saver" / auto-cleaner for Termux.

Optional auto-start after reboot — install **Termux:Boot** from F-Droid, then:

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-flowdesk.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
cd $HOME/FlowDesk/flowdesk-app
pnpm start
EOF
chmod +x ~/.termux/boot/start-flowdesk.sh
```

## Part G — Updating the app

On the PC: rebuild + re-tar (`pnpm build && ./scripts/build-android-bundle.sh`),
then `scp` the tar again and extract on the phone (Part C/Part D).
`git pull` inside the repo first if the code changed upstream.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to load SWC binary for android/arm64` | You should never see this with a PC-built bundle. If you do, you ran `next build` on the phone — switch to webpack mode (`next build --webpack`) or patch in a community Android SWC binary. |
| `node:sqlite` throws `ERR_UNKNOWN_BUILTIN_MODULE` | Termux's Node lacks the bundled SQLite. Install build tools and swap to `better-sqlite3`: `pkg install clang make python binutils`, then `pnpm remove` nothing — update `lib/db/*` imports (documented separately). |
| Server dies when screen locks | Wake lock missing, or MIUI battery optimisation active (Part F). |
| `http://<phone-ip>:3000` times out from PC | Phone and PC on different Wi-Fi / AP isolation enabled; test `localhost:3000` on the phone first. |
| Login works but every page/API returns 401 | Stale bundle: the session cookie's `Secure` flag was previously unconditional in production. Re-transfer the current bundle (which makes it scheme-aware) and restart. |
| Tunnel URL not loading | The tunnel process was killed by the OS — restart `cloudflared`/`ssh` inside an active Termux session (Part E). |
| Out of memory | 4 GB is enough for this app; if the OS kills Node under load, reduce concurrency (`NODE_OPTIONS=--max-old-space-size=1024`) and keep the phone cool. |

## Security notes

- The phone now runs a reachable web server. The default seeded users use demo
  passwords (`campus123`, `flowdesk-admin@2026`) — change them before exposing
  a public URL.
- Don't commit `.data/` (SQLite DB + student uploads). It is gitignored.
- A public tunnel exposes the app to the internet; for anything beyond a demo
  add a reverse proxy + HTTPS and consider replacing the phone host.
- This is a demo-grade host: no SLA, throttles when hot, and Android can kill
  the process at any time. Not for production traffic.
