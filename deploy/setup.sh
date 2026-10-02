#!/usr/bin/env bash
# Builds the Hindustan Electric server on a fresh Ubuntu 24.04 machine, then deploys the app (update.sh).
#
#   sudo bash setup.sh <address>        e.g.  sudo bash setup.sh 13-54-1-2.sslip.io
#
# Safe to run again: the database, the Django secret key and uploaded bill photos are kept.
# Nothing secret is in this file. The secret key is generated on the server into a root-only file and
# the database needs no password (the app logs in as its own system user).
set -euo pipefail

DOMAIN="${1:?usage: sudo bash setup.sh <address, e.g. 13-54-1-2.sslip.io>}"
REPO_URL="${REPO_URL:-https://github.com/muntazir99/HindustanElectric.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR=22

APP_USER=hindustan
HOME_DIR=/srv/hindustan-electric
APP_DIR=$HOME_DIR/app
ENV_FILE=/etc/hindustan-electric/env
MEDIA_DIR=/var/lib/hindustan-electric/media
CACHE_DIR=/var/cache/hindustan-electric
BACKUP_DIR=/var/backups/hindustan-electric
ACME_DIR=/var/www/letsencrypt
DB_NAME=hindustan_electric

step() { printf '\n==> %s\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash $0 $DOMAIN" >&2; exit 1; }
cd /

step "Time zone and system packages"
timedatectl set-timezone Asia/Kolkata
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q git nginx python3-venv certbot rsync curl ca-certificates xz-utils \
  unattended-upgrades postgresql-common

step "Swap (2 GB), so building the app never runs out of memory"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

step "PostgreSQL 17, from the PostgreSQL project's own package repository"
if ! dpkg -s postgresql-17 >/dev/null 2>&1; then
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt-get install -y -q postgresql-17
fi

step "Node.js $NODE_MAJOR from nodejs.org (checksum checked), used only to build the app"
if ! /opt/node/bin/node --version 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  case "$(uname -m)" in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; *) echo "unknown CPU $(uname -m)" >&2; exit 1 ;; esac
  base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  sums="$(curl -fsSL "$base/SHASUMS256.txt")"
  file="$(printf '%s\n' "$sums" | awk -v a="linux-$arch.tar.xz" '$2 ~ a"$" {print $2}')"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/$file" "$base/$file"
  (cd "$tmp" && printf '%s\n' "$sums" | grep " $file\$" | sha256sum -c -)
  rm -rf /opt/node
  mkdir -p /opt/node
  tar -xJf "$tmp/$file" -C /opt/node --strip-components=1
  rm -rf "$tmp"
fi

step "App user and folders"
id -u "$APP_USER" >/dev/null 2>&1 ||
  useradd --system --home-dir "$HOME_DIR" --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$HOME_DIR" "$MEDIA_DIR" "$CACHE_DIR"
install -d -o root -g "$APP_USER" -m 750 /etc/hindustan-electric
install -d -o root -g root -m 700 "$BACKUP_DIR"
install -d -m 755 "$ACME_DIR"
# nginx reads the built app and the back office's static files.
usermod -aG "$APP_USER" www-data

step "Code from GitHub ($BRANCH)"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

step "Database: local only; the app logs in as its own system user, no password"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER'" | grep -q 1 ||
  sudo -u postgres createuser "$APP_USER"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 ||
  sudo -u postgres createdb --owner "$APP_USER" "$DB_NAME"

step "Live settings ($ENV_FILE, readable by root and the app only)"
[ -f "$ENV_FILE" ] || install -o root -g "$APP_USER" -m 640 /dev/null "$ENV_FILE"
set_env() {
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}
grep -q '^DJANGO_SECRET_KEY=' "$ENV_FILE" ||
  echo "DJANGO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')" >> "$ENV_FILE"
set_env DJANGO_DEBUG false
set_env DJANGO_SECURE true
set_env DJANGO_BEHIND_PROXY true
set_env DJANGO_NUM_PROXIES 1
set_env DJANGO_ALLOWED_HOSTS "$DOMAIN"
set_env DJANGO_CSRF_TRUSTED_ORIGINS "https://$DOMAIN"
set_env CORS_ALLOWED_ORIGINS "https://$DOMAIN"
set_env DATABASE_URL "postgres://%2Fvar%2Frun%2Fpostgresql/$DB_NAME"
set_env DJANGO_CACHE_DIR "$CACHE_DIR"
set_env DJANGO_MEDIA_ROOT "$MEDIA_DIR"

step "Services: app (gunicorn), nightly backup, and the manage command"
install -m 644 "$APP_DIR/deploy/hindustan-electric.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deploy/hindustan-backup.service" "$APP_DIR/deploy/hindustan-backup.timer" /etc/systemd/system/
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/sbin/hindustan-backup
install -m 755 "$APP_DIR/deploy/manage.sh" /usr/local/bin/hindustan-manage
systemctl daemon-reload
systemctl enable --quiet hindustan-electric hindustan-backup.timer
systemctl start hindustan-backup.timer

step "HTTPS certificate for $DOMAIN (Let's Encrypt, renews itself)"
site=/etc/nginx/sites-available/hindustan-electric
rm -f /etc/nginx/sites-enabled/default
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # Plain-HTTP site, only so Let's Encrypt can check we own the address.
  cat > "$site" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root $ACME_DIR; }
    location / { return 404; }
}
EOF
  ln -sf "$site" /etc/nginx/sites-enabled/hindustan-electric
  nginx -t -q && systemctl reload nginx
  certbot certonly --webroot -w "$ACME_DIR" -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --deploy-hook "systemctl reload nginx"
fi
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__APP__|$APP_DIR|g" -e "s|__ACME__|$ACME_DIR|g" \
  "$APP_DIR/deploy/nginx.conf" > "$site"
ln -sf "$site" /etc/nginx/sites-enabled/hindustan-electric

step "Deploy the app"
bash "$APP_DIR/deploy/update.sh"

step "Done"
echo "Open https://$DOMAIN"
echo "Create the owner login (once):  sudo hindustan-manage createsuperuser"
