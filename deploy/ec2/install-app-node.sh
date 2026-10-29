#!/usr/bin/env bash
# Bootstrap an additional app node; never creates a database or changes its schema.
# Usage: sudo bash install-app-node.sh
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
# shellcheck disable=SC1091
source /etc/os-release
[[ "$ID" == amzn && "$VERSION_ID" == 2023 ]] || { echo 'Amazon Linux 2023 is required.' >&2; exit 1; }
[[ ! -e /etc/fullstack-lab/postgres.env ]] || {
    echo 'This is the database host. Run this installer only on the additional app node.' >&2; exit 1;
}
transfer_dir=/home/ec2-user/fullstack-node-transfer
archive="$transfer_dir/node-bootstrap.tar.gz"
[[ -s "$archive" && -s "$transfer_dir/node-bootstrap.sha256" ]] || {
    echo 'Transfer the bootstrap archive and checksum first.' >&2; exit 1;
}
exec 9>/var/lock/fullstack-deploy.lock
flock -w 120 9 || { echo 'Another deployment is running.' >&2; exit 1; }
(cd "$transfer_dir" && sha256sum -c node-bootstrap.sha256)
umask 077
staging=$(mktemp -d /var/tmp/fullstack-node-install.XXXXXX)
cleanup() {
    local result=$?
    if [[ "$staging" == /var/tmp/fullstack-node-install.* && -d "$staging" ]]; then
        rm -rf -- "$staging"
    fi
    if (( result != 0 )); then
        echo 'App node installation stopped. Share the error, not the bootstrap archive or environment file.' >&2
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

python3 - "$archive" "$staging" <<'PY'
import pathlib
import sys
import tarfile

with tarfile.open(sys.argv[1], 'r:gz') as source:
    members = source.getmembers()
    if sum(member.size for member in members) > 2 * 1024**3:
        raise SystemExit('Bootstrap archive is unexpectedly large.')
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if (path.is_absolute() or '..' in path.parts or not path.parts
                or path.parts[0] != 'bootstrap'
                or not (member.isfile() or member.isdir())):
            raise SystemExit('Unsafe bootstrap archive entry.')
    source.extractall(sys.argv[2], members=members)
PY
release_dir="$staging/bootstrap"
for file in app.jar app.env nginx.conf www/index.html www/characters/index.html www/release.txt; do
    [[ -s "$release_dir/$file" ]] || { echo "Missing bootstrap file: $file" >&2; exit 1; }
done
revision=$(cat "$release_dir/www/release.txt")
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release revision.' >&2; exit 1; }
grep -Fxq 'APP_SEED=false' "$release_dir/app.env"
grep -Fxq 'SPRING_JPA_HIBERNATE_DDL_AUTO=validate' "$release_dir/app.env"

echo '[1/4] Installing Java and Nginx...'
dnf install -y nginx java-21-amazon-corretto-headless
nginx -t -c "$release_dir/nginx.conf"
echo '[2/4] Installing the application with its shared database configuration...'
id fullstack >/dev/null 2>&1 || useradd --system --home-dir /opt/fullstack-lab --shell /sbin/nologin fullstack
install -d -m 755 /opt/fullstack-lab /var/www/fullstack-lab
install -d -m 700 /etc/fullstack-lab
if systemctl is-active --quiet fullstack.service; then systemctl stop fullstack.service; fi
install -m 600 "$release_dir/app.env" /etc/fullstack-lab/app.env
install -m 644 "$release_dir/app.jar" /opt/fullstack-lab/app.jar
cp -a "$release_dir/www/." /var/www/fullstack-lab/
chown -R root:root /var/www/fullstack-lab
find /var/www/fullstack-lab -type d -exec chmod 755 {} +
find /var/www/fullstack-lab -type f -exec chmod 644 {} +
cat > /etc/systemd/system/fullstack.service <<'EOF'
[Unit]
Description=Fullstack Lab Products API (shared database)
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=fullstack
Group=fullstack
WorkingDirectory=/opt/fullstack-lab
EnvironmentFile=/etc/fullstack-lab/app.env
ExecStart=/usr/bin/java -Xms128m -Xmx512m -jar /opt/fullstack-lab/app.jar
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
chmod 644 /etc/systemd/system/fullstack.service

echo '[3/4] Starting the application and Nginx...'
cp -p /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.before-app-node.$(date +%Y%m%d%H%M%S).$$"
install -m 644 "$release_dir/nginx.conf" /etc/nginx/nginx.conf
if command -v getenforce >/dev/null && [[ $(getenforce) == Enforcing ]]; then
    restorecon -RF /var/www/fullstack-lab
    setsebool -P httpd_can_network_connect 1
fi
systemctl daemon-reload
systemctl enable fullstack.service nginx
systemctl restart fullstack.service
systemctl reload-or-restart nginx

echo '[4/4] Checking the shared database API and both frontends...'
ready=false
for ((attempt=0; attempt<90; attempt++)); do
    if curl -fsS --max-time 3 http://127.0.0.1/api/products >/dev/null 2>&1; then
        ready=true; break
    fi
    sleep 2
done
[[ "$ready" == true ]] || { echo 'API failed to start. Inspect: sudo journalctl -u fullstack -n 60 --no-pager' >&2; exit 1; }
for path in / /characters/ /api/products; do
    curl -fsS --max-time 15 "http://127.0.0.1$path" >/dev/null
    printf 'OK: %s\n' "$path"
done
[[ $(curl -fsS --max-time 10 http://127.0.0.1/release.txt) == "$revision" ]] || {
    echo 'The served release does not match the bootstrap archive.' >&2; exit 1;
}
rm -f -- "$archive" "$transfer_dir/node-bootstrap.sha256"
printf 'APP NODE INSTALLATION COMPLETED\nRevision: %s\n' "$revision"
echo 'The bootstrap archive was removed from this node. Remove its copy on the source host too.'
