#!/bin/sh
# Runs a Django management command as the app, with the live settings. Installed as /usr/local/bin/hindustan-manage.
#   sudo hindustan-manage createsuperuser     (the owner login)
#   sudo hindustan-manage changepassword <username>
set -e
cd /srv/hindustan-electric/app/backend
exec sudo -u hindustan -H sh -c 'set -a; . /etc/hindustan-electric/env; set +a; exec /srv/hindustan-electric/venv/bin/python manage.py "$@"' manage "$@"
