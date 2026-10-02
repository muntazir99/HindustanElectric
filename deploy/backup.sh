#!/usr/bin/env bash
# Backup of the database and the purchase bill photos, kept 14 days. Runs nightly (hindustan-backup.timer)
# and before every update. Installed as /usr/local/sbin/hindustan-backup. Restore: deploy/README.md.
set -euo pipefail
DIR=/var/backups/hindustan-electric
STAMP="$(date +%Y-%m-%d_%H%M)"
umask 077
cd /
# The dump runs as the app; root writes the file into the root-only backup folder (intended).
# shellcheck disable=SC2024
sudo -u hindustan pg_dump --format=custom --no-owner hindustan_electric > "$DIR/db_$STAMP.dump"
tar -czf "$DIR/media_$STAMP.tar.gz" -C /var/lib/hindustan-electric media
find "$DIR" -name 'db_*.dump' -mtime +14 -delete
find "$DIR" -name 'media_*.tar.gz' -mtime +14 -delete
echo "Backup saved: $DIR/db_$STAMP.dump ($(du -h "$DIR/db_$STAMP.dump" | cut -f1)), media_$STAMP.tar.gz"
