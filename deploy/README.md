# Running on AWS

One Lightsail server (Ubuntu 24.04) runs everything: nginx with HTTPS, the React app, Django under gunicorn,
and Postgres 17. Plan and costs: [docs/PLAN.md §11](../docs/PLAN.md).

| On the server | Where |
|---|---|
| Code (this repo, `main`) | `/srv/hindustan-electric/app` |
| Live settings and secret key (root and app only, never in git) | `/etc/hindustan-electric/env` |
| Purchase bill photos | `/var/lib/hindustan-electric/media` |
| Backups (last 14 days) | `/var/backups/hindustan-electric` |
| App service / logs | `hindustan-electric` · `journalctl -u hindustan-electric` |

## Build a server

1. Create an Ubuntu 24.04 Lightsail server, attach a static IP, open ports 22, 80 and 443.
2. On the server:

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/muntazir99/HindustanElectric/main/deploy/setup.sh
   sudo bash setup.sh 13-54-1-2.sslip.io   # the static IP with dashes, or the shop's own domain
   sudo hindustan-manage createsuperuser    # the owner login, once
   ```

`setup.sh` can be run again at any time; it keeps the database, secret key and bill photos.

## Update to the latest code

Push to `main` on GitHub, then on the server:

```bash
sudo bash /srv/hindustan-electric/app/deploy/update.sh
```

It takes a backup first, then pulls, installs, migrates, builds the app and restarts.

## Backups

- **Every night at 02:30** and before every update: the database and bill photos, kept 14 days.
- **Lightsail snapshots:** the whole server, daily, last 7 kept.
- **Copy to your Mac** (do this weekly at least):

  ```bash
  deploy/pull-backup.sh <server address>
  ```

### Restore

```bash
sudo systemctl stop hindustan-electric
sudo -u postgres dropdb hindustan_electric
sudo -u postgres createdb --owner hindustan hindustan_electric
# The backup folder is root-only, so root reads the file and the app restores it:
sudo cat /var/backups/hindustan-electric/db_<date>.dump | sudo -u hindustan pg_restore --no-owner --exit-on-error -d hindustan_electric
sudo tar -xzf /var/backups/hindustan-electric/media_<date>.tar.gz -C /var/lib/hindustan-electric
sudo systemctl start hindustan-electric
```

On a new server, run `setup.sh` first, copy the two backup files over, then restore as above.

## Help assistant: AI model settings

The ? Help button answers from `docs/HANDBOOK.md`. With no settings it shows the matching handbook topics.
To let a free AI model write the answers (plan §15), set three settings. The key is asked for without showing:

```bash
sudo bash /srv/hindustan-electric/app/deploy/set-env.sh HELP_LLM_BASE_URL <OpenAI-compatible URL>
sudo bash /srv/hindustan-electric/app/deploy/set-env.sh HELP_LLM_MODEL <model name>
sudo bash /srv/hindustan-electric/app/deploy/set-env.sh HELP_LLM_KEY
```

| Provider (free) | `HELP_LLM_BASE_URL` | `HELP_LLM_MODEL` (example) |
|---|---|---|
| Google Gemini (key from Google AI Studio) | `https://generativelanguage.googleapis.com/v1beta/openai` | a current Gemini Flash model |
| **NVIDIA Nemotron 3 Ultra** (key from build.nvidia.com) — in use | `https://integrate.api.nvidia.com/v1` | `nvidia/nemotron-3-ultra-550b-a55b` |

To turn the AI off, set `HELP_LLM_KEY` to `off`. The handbook answers alone then.

## Moving to the shop's own domain

Point the domain's A record at the static IP, then run `sudo bash setup.sh <domain>`: it gets a certificate
for the new address and updates the settings.
