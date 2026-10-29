#!/usr/bin/env bash
# Run on the existing database host after allowing TCP 5432 only from the app SG.
# Usage: sudo bash enable-private-database.sh 172.31.21.52
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
private_ip=${1:?Provide this instance private IPv4 address}
[[ "$private_ip" =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.) ]] || {
    echo 'Provide an RFC1918 private address.' >&2; exit 1;
}
ip -4 -o addr show | awk '{split($4, address, "/"); print address[1]}' | grep -Fxq "$private_ip" || {
    echo 'The supplied private IP does not belong to this host.' >&2; exit 1;
}
exec 9>/run/fullstack-database-network.lock
flock -n 9 || { echo 'Another database network change is running.' >&2; exit 1; }

container=fullstack-postgres
volume=fullstack-postgres-data
credentials=/etc/fullstack-lab/postgres.env
[[ -s "$credentials" ]] || { echo 'Existing database credentials are missing.' >&2; exit 1; }
[[ $(docker inspect -f '{{index .Config.Labels "app"}}' "$container") == fullstack-lab ]] || {
    echo 'The existing container is not managed by the fullstack installer.' >&2; exit 1;
}
mount=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}:{{.Name}}{{end}}{{end}}' "$container")
[[ "$mount" == "volume:$volume" ]] || { echo 'Unexpected database volume; stopping.' >&2; exit 1; }
[[ $(docker inspect -f '{{.State.Running}}' "$container") == true ]] || {
    echo 'Start the existing database before running this script.' >&2; exit 1;
}
systemctl is-active --quiet fullstack.service
curl -fsS --max-time 15 http://127.0.0.1/api/products >/dev/null

bindings=$(docker port "$container" 5432/tcp | sort)
expected=$(printf '127.0.0.1:5432\n%s:5432\n' "$private_ip" | sort)
if [[ "$bindings" == "$expected" ]]; then
    echo 'Private database publishing is already configured; no changes made.'
    exit 0
fi
[[ "$bindings" == '127.0.0.1:5432' ]] || {
    echo 'Unexpected port mappings; inspect them before changing the container.' >&2; exit 1;
}

# Reuse the exact locally installed image, credentials, and persistent volume.
original_id=$(docker inspect -f '{{.Id}}' "$container")
image_id=$(docker inspect -f '{{.Image}}' "$container")
suffix="$(date +%Y%m%d-%H%M%S)-$$"
previous_name="fullstack-postgres-before-private-$suffix"
candidate_name="fullstack-postgres-private-$suffix"
candidate_id=''
service_stopped=false
original_stopped=false
original_renamed=false

finish() {
    local result=$? recovery_failed=false
    trap - EXIT INT TERM
    if (( result == 0 )); then return; fi
    set +e
    echo 'Configuration failed; attempting to restore the original container.' >&2
    if [[ -n "$candidate_id" ]]; then
        # Never remove the volume. Stop the replacement before restarting the original.
        docker rm -f "$candidate_id" >/dev/null || recovery_failed=true
    fi
    if [[ "$recovery_failed" == false && "$original_renamed" == true ]]; then
        docker rename "$original_id" "$container" || recovery_failed=true
    fi
    if [[ "$recovery_failed" == false && "$original_stopped" == true ]]; then
        docker start "$original_id" >/dev/null || recovery_failed=true
    fi
    if [[ "$recovery_failed" == false && "$service_stopped" == true ]]; then
        systemctl restart fullstack.service || recovery_failed=true
    fi
    if [[ "$recovery_failed" == true ]]; then
        echo "Recovery needs attention. Original container ID: $original_id" >&2
        echo 'Do not start two PostgreSQL containers against the same volume.' >&2
    else
        echo 'Original configuration restored; check API readiness before proceeding.' >&2
    fi
    exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

candidate_id=$(docker create --name "$candidate_name" --label app=fullstack-lab \
    --restart unless-stopped --env-file "$credentials" \
    --publish 127.0.0.1:5432:5432 --publish "$private_ip:5432:5432" \
    --mount "type=volume,source=$volume,target=/var/lib/postgresql/data" \
    --log-opt max-size=10m --log-opt max-file=3 "$image_id")

umask 077
install -d -m 700 /var/backups/fullstack-lab
backup_file="/var/backups/fullstack-lab/products-before-private-$suffix.dump"
systemctl stop fullstack.service
service_stopped=true
docker exec "$container" pg_dump -U fullstack -d products_db -Fc > "$backup_file"
test -s "$backup_file"
docker exec -i "$container" pg_restore --list < "$backup_file" >/dev/null
echo "Backup archive created and readable: $backup_file"

docker stop --time 60 "$original_id" >/dev/null
original_stopped=true
docker rename "$original_id" "$previous_name"
original_renamed=true
docker rename "$candidate_id" "$container"
docker start "$candidate_id" >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U fullstack -d products_db >/dev/null 2>&1; then
        ready=true; break
    fi
    sleep 2
done
[[ "$ready" == true ]] || { echo 'PostgreSQL did not become ready.' >&2; exit 1; }
systemctl start fullstack.service
ready=false
for ((attempt=0; attempt<60; attempt++)); do
    if curl -fsS --max-time 3 http://127.0.0.1/api/products >/dev/null 2>&1; then
        ready=true; break
    fi
    sleep 2
done
[[ "$ready" == true ]] || { echo 'The API did not recover.' >&2; exit 1; }
echo 'PRIVATE DATABASE CONFIGURATION COMPLETED'
docker port "$container" 5432/tcp
echo "Original container retained STOPPED as $previous_name; do not start it."
echo 'The same database volume and credentials are in use. Verify remote access next.'
