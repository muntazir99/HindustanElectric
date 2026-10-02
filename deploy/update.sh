#!/usr/bin/env bash
# Brings the server up to date with GitHub: backup first, then code, packages, database changes, the app
# build, and a restart. Stops at the first problem; the app keeps running the old version until the restart.
#
#   sudo bash /srv/hindustan-electric/app/deploy/update.sh
set -euo pipefail

APP_USER=hindustan
HOME_DIR=/srv/hindustan-electric
APP_DIR=$HOME_DIR/app
VENV=$HOME_DIR/venv
ENV_FILE=/etc/hindustan-electric/env
BRANCH="${BRANCH:-main}"

step() { printf '\n==> %s\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash $0" >&2; exit 1; }
cd /
as_app() { sudo -u "$APP_USER" -H env PATH="/opt/node/bin:$VENV/bin:/usr/local/bin:/usr/bin:/bin" "$@"; }
domain="$(sed -n 's/^DJANGO_ALLOWED_HOSTS=//p' "$ENV_FILE" | cut -d, -f1)"

if [ -x /usr/local/sbin/hindustan-backup ] && sudo -u "$APP_USER" psql -d hindustan_electric -tAc "SELECT 1" >/dev/null 2>&1; then
  step "Backup before changing anything"
  /usr/local/sbin/hindustan-backup
fi

step "Code: latest $BRANCH from GitHub"
as_app git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
as_app git -C "$APP_DIR" checkout --quiet "$BRANCH"
as_app git -C "$APP_DIR" merge --quiet --ff-only "origin/$BRANCH"
as_app git -C "$APP_DIR" log -1 --format='Now at %h %s'

step "Python packages"
[ -x "$VENV/bin/python" ] || as_app python3 -m venv "$VENV"
as_app pip install --quiet --upgrade pip
as_app pip install --quiet -r "$APP_DIR/backend/requirements.txt"

step "Database changes and back office files"
hindustan-manage migrate --noinput
hindustan-manage collectstatic --noinput --verbosity 0
hindustan-manage check --deploy

step "Build the app (into a new folder, then swap, so the shop never sees a half-built app)"
cd "$APP_DIR/frontend"
as_app npm ci --no-audit --no-fund --loglevel=error
as_app env VITE_API_URL=/api npm run build --silent -- --outDir build-next --emptyOutDir
rm -rf build-old
[ -d build ] && mv build build-old
mv build-next build
rm -rf build-old
cd /

step "Restart"
systemctl restart hindustan-electric
nginx -t -q && systemctl reload nginx
for _ in $(seq 1 20); do
  if curl -fsS -H "Host: $domain" -H "X-Forwarded-Proto: https" http://127.0.0.1:8001/api/health >/dev/null 2>&1; then
    echo "App is up."
    exit 0
  fi
  sleep 1
done
echo "The app did not start. Look at: journalctl -u hindustan-electric -n 50" >&2
exit 1
