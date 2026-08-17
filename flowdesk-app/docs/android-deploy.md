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
- Phone and PC on the same Wi-Fi for the initial transfer only.
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

## Part B — Phone: install Termux + dependencies

1. Install **Termux from F-Droid** (https://f-droid.org/packages/com.termux/).
   The Play Store version is abandoned and will not work.
2. Open Termux and run:

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts openssh net-tools cloudflared termux-api
```

3. Verify Node and the built-in SQLite driver:

```bash
node --version            # expect v24.x (or v22.x)
```

If `node:sqlite` is missing, see Troubleshooting.

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

## Part D — Start the server + public URL

Run both the server and a Cloudflare tunnel with one command:

```bash
chmod +x $HOME/FlowDesk/flowdesk-app/scripts/start-android.sh
$HOME/FlowDesk/flowdesk-app/scripts/start-android.sh
```

This starts:
- **Next.js** on port 3000 (LAN accessible at `http://<phone-ip>:3000`)
- **Cloudflare tunnel** giving a stable public URL like `https://x7k2m9.trycloudflare.com`

The public URL works from **any network** — it doesn't depend on the phone's
IP address. Copy it from the terminal output and share it with anyone.

Verify on the phone:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/    # expect 200
```

Verify from the public URL (from any device, any network):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>.trycloudflare.com/    # expect 200
```

Then open the URL in a browser and test login, the dashboard, and a PDF download.

> **Without cloudflared?** If you skipped installing cloudflared, the script
> prints the LAN IP and tells you. LAN-only access still works fine from any
> device on the same Wi-Fi.

## Part E — Keep it alive on MIUI (important)

Android/MIUI aggressively kills background processes. The phone must stay in
charge of this:

1. Settings → Apps → Termux → Battery → **Unrestricted**.
2. Keep the phone plugged in (prevents throttling + Doze suspension).
3. The start script runs `termux-wake-lock` automatically.
4. Disable any MIUI "Battery saver" / auto-cleaner for Termux.

Optional auto-start after reboot — install **Termux:Boot** from F-Droid, then:

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-flowdesk.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
$HOME/FlowDesk/flowdesk-app/scripts/start-android.sh
EOF
chmod +x ~/.termux/boot/start-flowdesk.sh
```

## Part F — Updating the app

On the PC: rebuild + re-tar (`pnpm build && ./scripts/build-android-bundle.sh`),
then `scp` the tar again and extract on the phone (Part C).
`git pull` inside the repo first if the code changed upstream.

If the schema changed (new tables/columns), wipe the phone's database first:

```bash
rm -rf $HOME/FlowDesk/flowdesk-app/.data
```

The first start after wiping re-seeds fresh data.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to load SWC binary for android/arm64` | You should never see this with a PC-built bundle. If you do, you ran `next build` on the phone — switch to webpack mode (`next build --webpack`) or patch in a community Android SWC binary. |
| `node:sqlite` throws `ERR_UNKNOWN_BUILTIN_MODULE` | Termux's Node lacks the bundled SQLite. Install build tools and swap to `better-sqlite3`: `pkg install clang make python binutils`, then `pnpm remove` nothing — update `lib/db/*` imports (documented separately). |
| Server dies when screen locks | Wake lock missing, or MIUI battery optimisation active (Part E). |
| `http://<phone-ip>:3000` times out from PC | Phone and PC on different Wi-Fi / AP isolation enabled; test `localhost:3000` on the phone first. |
| Login works but every page/API returns 401 | Stale bundle: the session cookie's `Secure` flag was previously unconditional in production. Re-transfer the current bundle (which makes it scheme-aware) and restart. |
| Tunnel URL not loading | The tunnel process was killed by the OS — restart via the start script or run `cloudflared tunnel --url http://localhost:3000` manually. |
| Public URL changes on restart | This is expected with free Cloudflare quick tunnels. For a permanent domain, use a named tunnel (see below). |
| Dashboard nav is empty after schema change | Wipe `.data` and restart — the old database is missing the roles/permissions tables (`rm -rf .data`). |

## Custom domain (optional)

The free quick tunnel gives a random `*.trycloudflare.com` URL that changes on
restart. For a **permanent domain**:

1. Sign up for a free Cloudflare account.
2. Point a domain's nameservers to Cloudflare.
3. Install `cloudflared` and run:
   ```bash
   cloudflared tunnel create flowdesk
   cloudflared tunnel route dns flowdesk flowdesk.yourdomain.com
   ```
4. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: /data/data/com.termux/files/home/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: flowdesk.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. Run: `cloudflared tunnel run flowdesk`

The app itself requires zero code changes — only the tunnel configuration.

## Security notes

- The phone now runs a reachable web server. The default seeded users use demo
  passwords (`campus123`, `flowdesk-admin@2026`) — change them before exposing
  a public URL.
- Don't commit `.data/` (SQLite DB + student uploads). It is gitignored.
- A public tunnel exposes the app to the internet; for anything beyond a demo
  add a reverse proxy + HTTPS and consider replacing the phone host.
- Cloudflare provides HTTPS automatically — no certificate management needed.
- This is a demo-grade host: no SLA, throttles when hot, and Android can kill
  the process at any time. Not for production traffic.
