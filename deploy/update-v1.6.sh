#!/usr/bin/env bash
set -euo pipefail
umask 0077

if [ "$(id -u)" != 0 ]; then echo 'Run this update as root.' >&2; exit 1; fi
handari_source=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
handari_target=/var/handari
handari_db=${HANDARI_DB_PATH:-/var/lib/handari/handari.sqlite}
if [ -x /opt/handari-node/bin/node ]; then handari_node=/opt/handari-node/bin/node; else handari_node=/usr/bin/node; fi
"$handari_node" -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<24||(a===24&&b<14)){console.error("Node 24.14+ required");process.exit(1)}'
if [ "$handari_source" = "$handari_target" ]; then echo 'Extract the new ZIP into a separate directory under /tmp first.' >&2; exit 1; fi
export PATH="$(dirname "$handari_node"):$PATH"
(cd "$handari_source" && npm ci --omit=dev --ignore-scripts)
test -f "$handari_source/lib/google.mjs"
test -f "$handari_source/public/accounts.js"
test -d "$handari_target/lib"
id handari >/dev/null
"$handari_node" --check "$handari_source/server.mjs"
"$handari_node" --check "$handari_source/public/app.js"
"$handari_node" --check "$handari_source/public/accounts.js"
"$handari_node" "$handari_source/scripts/run-tests.mjs"

handari_backup=/var/backups/handari/upgrades/$(date -u +%Y%m%dT%H%M%SZ)-$$
install -d -m 700 "$handari_backup"
tar -czf "$handari_backup/previous-code.tar.gz" -C "$handari_target" server.mjs package.json lib public scripts
echo "Previous code backup: $handari_backup"
if systemctl is-active --quiet handari; then systemctl stop handari; fi
if [ -f /etc/systemd/system/handari.service.d/database.conf ]; then
  "$handari_node" --env-file=/etc/handari/database.env "$handari_source/scripts/backup.mjs" "$handari_backup/before-v1.6.sqlite"
elif [ -f "$handari_db" ]; then
  DB_DRIVER=sqlite DB_PATH="$handari_db" "$handari_node" "$handari_source/scripts/backup.mjs" "$handari_backup/before-v1.6.sqlite"
fi
trap 'echo "Update failed. Previous code/database remain in $handari_backup; inspect the error before proceeding." >&2' ERR

for handari_dir in lib public scripts deploy test node_modules; do
  install -d -o root -g handari -m 750 "$handari_target/$handari_dir"
  cp -R "$handari_source/$handari_dir/." "$handari_target/$handari_dir/"
  find "$handari_target/$handari_dir" -type d -exec chown root:handari {} + -exec chmod 750 {} +
  find "$handari_target/$handari_dir" -type f -exec chown root:handari {} + -exec chmod 640 {} +
done
for handari_file in server.mjs package.json package-lock.json index.html start-handari.cmd README.md UPGRADE-v1.2.md UPGRADE-v1.3.md UPGRADE-v1.6.md REGISTRATION-v1.4.2.md PASSWORD-RESET.md DATABASE-v1.6.md GITHUB.md .gitignore; do
  [ -f "$handari_source/$handari_file" ] || continue
  install -o root -g handari -m 640 "$handari_source/$handari_file" "$handari_target/$handari_file"
done
chown root:handari "$handari_target"
chmod 750 "$handari_target"
# Existing /etc Nginx, service, backup key and database files are preserved.
if [ -f /etc/systemd/system/handari.service ]; then
  systemctl restart handari
  for handari_attempt in $(seq 1 10); do
    if curl --silent --fail --max-time 3 http://127.0.0.1:3100/ -o /dev/null; then
      echo 'HANDARI v1.6 is running. Open https://handari.duckdns.org/#register or /#admin.'
      exit 0
    fi
    sleep 1
  done
  systemctl status handari --no-pager || true
  journalctl -u handari -n 30 --no-pager
  exit 1
fi
echo 'Code updated. handari.service is not installed yet; use the initial service/HTTPS setup instructions.'
