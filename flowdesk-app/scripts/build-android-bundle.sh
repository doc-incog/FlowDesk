#!/usr/bin/env bash
# Build a shippable Next.js bundle for running `next start` on an Android
# phone (Termux). The phone never compiles anything — it only serves this
# precompiled .next output, which is platform-independent JS.
#
# Usage:   scripts/build-android-bundle.sh
# Output:  dist/next-android.tar.gz

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  for cand in "$HOME/.local/bin/pnpm" "$HOME/.local/share/pnpm/pnpm" "$HOME/.nvm/current/bin/pnpm"; do
    if [ -x "$cand" ]; then
      export PATH="$(dirname "$cand"):$PATH"
      break
    fi
  done
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm not found on PATH (install it, e.g. 'npm i -g pnpm')" >&2
  exit 1
fi

echo "==> clean build"
rm -rf .next
pnpm build

echo "==> bundling .next (excluding cache/dev)"
mkdir -p dist
rm -f dist/next-android.tar.gz
tar -czf dist/next-android.tar.gz \
  --exclude='.next/cache' \
  --exclude='.next/dev' \
  .next

ls -lh dist/next-android.tar.gz
echo "done. copy dist/next-android.tar.gz to the phone and extract inside flowdesk-app/ (see docs/android-deploy.md)"
