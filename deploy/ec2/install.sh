#!/usr/bin/env bash
# Install the compiled release on the dedicated Amazon Linux 2023 lab instance.
# Usage: sudo bash install.sh /home/ec2-user/fullstack-release
set -Eeuo pipefail
trap 'printf "\nInstallation stopped at line %s. Share the error above, not the files in /etc/fullstack-lab.\n" "$LINENO" >&2' ERR

[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
release_dir=$(realpath "${1:?Provide the extracted fullstack-release directory}")
for artifact in app.jar www/index.html www/characters/index.html; do
    [[ -f "$release_dir/$artifact" ]] || { echo "Missing: $artifact" >&2; exit 1; }
done
source /etc/os-release
[[ "$ID" == amzn && "$VERSION_ID" == 2023 ]] || { echo 'Amazon Linux 2023 is required.' >&2; exit 1; }

echo '[1/6] Installing runtime packages...'
dnf install -y docker nginx java-21-amazon-corretto-headless openssl
systemctl enable --now docker

container=fullstack-postgres
volume=fullstack-postgres-data
config_dir=/etc/fullstack-lab
if docker container inspect "$container" >/dev/null 2>&1; then
    [[ "$(docker inspect -f '{{index .Config.Labels "app"}}' "$container")" == fullstack-lab ]] || {
        echo "Container $container already exists and is not managed by this installer." >&2; exit 1;
    }
fi
if docker volume inspect "$volume" >/dev/null 2>&1; then
    [[ "$(docker volume inspect -f '{{index .Labels "app"}}' "$volume")" == fullstack-lab ]] || {
        echo "Volume $volume already exists and is not managed by this installer." >&2; exit 1;
    }
fi
install -d -m 700 "$config_dir"
if [[ ! -f "$config_dir/postgres.env" ]]; then
    if docker container inspect "$container" >/dev/null 2>&1 || docker volume inspect "$volume" >/dev/null 2>&1; then
        echo 'Existing database found without its credentials. Restore postgres.env before continuing.' >&2
        exit 1
    fi
    (umask 077; printf 'POSTGRES_DB=products_db\nPOSTGRES_USER=fullstack\nPOSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)" > "$config_dir/postgres.env")
fi
chmod 600 "$config_dir/postgres.env"
source "$config_dir/postgres.env"
[[ "$POSTGRES_DB" == products_db && "$POSTGRES_USER" == fullstack && "$POSTGRES_PASSWORD" =~ ^[0-9a-f]{64}$ ]] || {
    echo 'Unexpected database configuration; inspect it privately before continuing.' >&2; exit 1;
}

echo '[2/6] Starting PostgreSQL with persistent storage...'
if docker container inspect "$container" >/dev/null 2>&1; then
    docker start "$container" >/dev/null
else
    docker pull postgres:17-alpine
    docker volume create --label app=fullstack-lab "$volume" >/dev/null
    docker run -d --name "$container" --label app=fullstack-lab \
        --restart unless-stopped --env-file "$config_dir/postgres.env" \
        --publish 127.0.0.1:5432:5432 \
        --mount "type=volume,source=$volume,target=/var/lib/postgresql/data" \
        --log-opt max-size=10m --log-opt max-file=3 \
        postgres:17-alpine >/dev/null
fi
database_ready=false
for ((attempt=0; attempt<60; attempt++)); do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U fullstack -d products_db >/dev/null 2>&1; then
        database_ready=true; break
    fi
    sleep 2
done
[[ "$database_ready" == true ]] || { echo 'PostgreSQL did not become ready. Run: sudo docker logs fullstack-postgres' >&2; exit 1; }

echo '[3/6] Installing the backend service...'
id fullstack >/dev/null 2>&1 || useradd --system --home-dir /opt/fullstack-lab --shell /sbin/nologin fullstack
install -d -m 755 /opt/fullstack-lab
# Stop the old JVM before replacing its JAR when re-running this installer.
if systemctl is-active --quiet fullstack.service; then systemctl stop fullstack.service; fi
install -m 644 "$release_dir/app.jar" /opt/fullstack-lab/app.jar
(umask 077; cat > "$config_dir/app.env" <<EOF
DB_URL=jdbc:postgresql://127.0.0.1:5432/products_db
DB_USER=fullstack
DB_PASSWORD=$POSTGRES_PASSWORD
SERVER_ADDRESS=127.0.0.1
PORT=8080
SERVER_FORWARD_HEADERS_STRATEGY=framework
SPRING_H2_CONSOLE_ENABLED=false
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=5
EOF
)
chmod 600 "$config_dir/app.env"
unset POSTGRES_PASSWORD
cat > /etc/systemd/system/fullstack.service <<'EOF'
[Unit]
Description=Fullstack Lab Products API
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service
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
systemctl daemon-reload
systemctl enable fullstack.service
systemctl restart fullstack.service
backend_ready=false
for ((attempt=0; attempt<90; attempt++)); do
    if curl -fsS --max-time 3 http://127.0.0.1:8080/api/products >/dev/null 2>&1; then
        backend_ready=true; break
    fi
    sleep 2
done
[[ "$backend_ready" == true ]] || { echo 'Backend did not become ready. Run: sudo journalctl -u fullstack -n 60 --no-pager' >&2; exit 1; }

echo '[4/6] Installing both websites...'
install -d -m 755 /var/www/fullstack-lab
cp -R "$release_dir/www/." /var/www/fullstack-lab/
find /var/www/fullstack-lab -type d -exec chmod 755 {} +
find /var/www/fullstack-lab -type f -exec chmod 644 {} +
if command -v getenforce >/dev/null && [[ "$(getenforce)" == Enforcing ]]; then
    restorecon -RF /var/www/fullstack-lab
    setsebool -P httpd_can_network_connect 1
fi

echo '[5/6] Configuring Nginx (backing up the existing configuration)...'
candidate=/etc/nginx/nginx.fullstack-candidate.conf
cat > "$candidate" <<'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log /var/log/nginx/access.log;
    sendfile on;
    keepalive_timeout 65;
    server_tokens off;

    server {
        listen 80 default_server;
        server_name _;
        root /var/www/fullstack-lab;
        index index.html;

        location /api/ {
            proxy_pass http://127.0.0.1:8080;
            proxy_set_header Host $http_host;
            proxy_set_header X-Forwarded-For $remote_addr;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_connect_timeout 5s;
            proxy_read_timeout 30s;
        }
        location = /characters { return 301 /characters/; }
        location /characters/assets/ { try_files $uri =404; }
        location /characters/ { try_files $uri $uri/ /characters/index.html; }
        location /assets/ { try_files $uri =404; }
        location / { try_files $uri $uri/ /index.html; }
        location ~ /\. { deny all; }
    }
}
EOF
nginx -t -c "$candidate"
backup="/etc/nginx/nginx.conf.before-fullstack.$(date +%Y%m%d%H%M%S).$$"
cp -p /etc/nginx/nginx.conf "$backup"
install -m 644 "$candidate" /etc/nginx/nginx.conf
systemctl enable nginx
if ! systemctl reload-or-restart nginx; then
    cp -p "$backup" /etc/nginx/nginx.conf
    systemctl reload-or-restart nginx
    echo 'Nginx failed; its previous configuration was restored.' >&2
    exit 1
fi

echo '[6/6] Checking the website and API through Nginx...'
proxy_ready=false
for ((attempt=0; attempt<20; attempt++)); do
    if curl -fsS --max-time 3 -H 'Host: fullstack.example' \
        -H 'Origin: http://fullstack.example' http://127.0.0.1/api/products >/dev/null 2>&1; then
        proxy_ready=true; break
    fi
    sleep 1
done
[[ "$proxy_ready" == true ]] || { echo 'The API is not reachable through Nginx. Check: sudo tail -n 40 /var/log/nginx/error.log' >&2; exit 1; }
for path in / /characters/ /api/products; do
    curl -fsS --max-time 15 "http://127.0.0.1$path" >/dev/null
    printf 'OK: %s\n' "$path"
done
printf '\nINSTALLATION COMPLETED\nStorefront: http://YOUR_PUBLIC_IP/\nCharacter explorer: http://YOUR_PUBLIC_IP/characters/\n'
