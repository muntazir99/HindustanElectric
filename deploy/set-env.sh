#!/usr/bin/env bash
# Sets one live setting on the server, then restarts the app. For a secret (an API key), leave the value out:
# it asks for it without showing it on screen, so it never lands in the terminal history.
#   sudo bash /srv/hindustan-electric/app/deploy/set-env.sh HELP_LLM_KEY
#   sudo bash /srv/hindustan-electric/app/deploy/set-env.sh HELP_LLM_MODEL gemini-3.5-flash
set -euo pipefail
NAME="${1:?usage: sudo bash set-env.sh NAME [VALUE]}"
ENV_FILE=/etc/hindustan-electric/env
[[ "$NAME" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Setting names are CAPITALS_AND_UNDERSCORES." >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }
if [ $# -ge 2 ]; then
  VALUE="$2"
else
  read -r -s -p "Paste the value for $NAME (it won't show), then press Enter: " VALUE
  echo
fi
[ -n "$VALUE" ] || { echo "Nothing entered; nothing changed." >&2; exit 1; }
[[ "$VALUE" != *$'\n'* && "$VALUE" != *" "* ]] || { echo "The value can't contain spaces or new lines." >&2; exit 1; }
tmp="$(mktemp)"
grep -v "^$NAME=" "$ENV_FILE" > "$tmp" || true
printf '%s=%s\n' "$NAME" "$VALUE" >> "$tmp"
install -o root -g hindustan -m 640 "$tmp" "$ENV_FILE"
rm -f "$tmp"
systemctl restart hindustan-electric
echo "$NAME saved; the app restarted."
