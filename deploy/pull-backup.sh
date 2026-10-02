#!/usr/bin/env bash
# Run on your own computer: copies the server's backups here, so the shop's data is never only at AWS.
#   deploy/pull-backup.sh <server address> [folder]      folder defaults to ~/HindustanElectric-backups
set -euo pipefail
HOST="${1:?usage: deploy/pull-backup.sh <server address> [folder]}"
DEST="${2:-$HOME/HindustanElectric-backups}"
KEY="${SSH_KEY:-$HOME/.ssh/hindustan-electric-aws}"
mkdir -p "$DEST"
rsync -a --rsync-path="sudo rsync" -e "ssh -i $KEY" "ubuntu@$HOST:/var/backups/hindustan-electric/" "$DEST/"
echo "Backups copied to $DEST:"
ls -t "$DEST" | head -4
