#!/usr/bin/env bash
set -euo pipefail
umask 0077
[ "$(id -u)" = 0 ] || { echo 'Run as root.'; exit 1; }
read -r -p 'Google OAuth Web Client ID: ' handari_client
[[ "$handari_client" =~ ^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$ ]] || { echo 'Invalid Web Client ID. Do not enter a client secret.'; exit 1; }
id handari >/dev/null
install -d -o root -g handari -m 750 /etc/handari
printf 'GOOGLE_CLIENT_ID=%s\n' "$handari_client" > /etc/handari/google.env
chown root:handari /etc/handari/google.env
chmod 640 /etc/handari/google.env
install -d -m 755 /etc/systemd/system/handari.service.d
printf '[Service]\nEnvironmentFile=/etc/handari/google.env\n' > /etc/systemd/system/handari.service.d/google.conf
chmod 644 /etc/systemd/system/handari.service.d/google.conf
systemctl daemon-reload
systemctl restart handari
echo 'Google configuration saved. Check https://handari.duckdns.org/api/auth/config and test sign-in.'
