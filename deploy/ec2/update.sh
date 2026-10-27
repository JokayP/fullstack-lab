#!/usr/bin/env bash
# Update an instance provisioned by install.sh without changing database storage.
# Usage: sudo bash update.sh /path/to/release
# Validation only: bash update.sh --validate-only /path/to/release
set -Eeuo pipefail

validate_only=false
if [[ ${1:-} == --validate-only ]]; then
    validate_only=true
    shift
fi
release_dir=$(realpath "${1:?Provide the extracted release directory}")
for artifact in app.jar www/index.html www/characters/index.html www/release.txt; do
    [[ -s "$release_dir/$artifact" ]] || { echo "Missing or empty release file: $artifact" >&2; exit 1; }
done
[[ -z $(find "$release_dir" -type l -print -quit) ]] || { echo 'Release symlinks are not supported.' >&2; exit 1; }
revision=$(cat "$release_dir/www/release.txt")
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'The release revision must be a complete Git commit SHA.' >&2; exit 1; }
if [[ "$validate_only" == true ]]; then
    echo "Release validated: $revision"
    exit 0
fi

[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
for existing in /opt/fullstack-lab/app.jar /etc/fullstack-lab/app.env /etc/systemd/system/fullstack.service; do
    [[ -f "$existing" ]] || { echo "Missing existing installation file: $existing. Run install.sh for initial setup." >&2; exit 1; }
done
[[ -d /var/www/fullstack-lab && ! -L /var/www/fullstack-lab ]] || {
    echo 'Expected the existing website directory at /var/www/fullstack-lab.' >&2; exit 1;
}
exec 9>/var/lock/fullstack-deploy.lock
flock -w 120 9 || { echo 'Another deployment is still running.' >&2; exit 1; }
nginx -t

backup_dir=$(mktemp -d /opt/fullstack-lab/rollback.XXXXXX)
staging_dir=$(mktemp -d /var/www/fullstack-staging.XXXXXX)
cp -p /opt/fullstack-lab/app.jar "$backup_dir/app.jar"
cp -a "$release_dir/www/." "$staging_dir/"
chown -R root:root "$staging_dir"
find "$staging_dir" -type d -exec chmod 755 {} +
find "$staging_dir" -type f -exec chmod 644 {} +

changed=false
website_moved=false
finish() {
    result=$?
    trap - EXIT INT TERM
    if [[ $result -ne 0 && "$changed" == true ]]; then
        echo "Update failed. Restoring the previous application from $backup_dir." >&2
        set +e
        rollback_failed=false
        systemctl stop fullstack.service || rollback_failed=true
        install -m 644 "$backup_dir/app.jar" /opt/fullstack-lab/app.jar || rollback_failed=true
        if [[ "$website_moved" == true ]]; then
            if [[ -d /var/www/fullstack-lab ]]; then
                mv /var/www/fullstack-lab "$backup_dir/failed-www" || rollback_failed=true
            fi
            mv "$backup_dir/www" /var/www/fullstack-lab || rollback_failed=true
        fi
        systemctl start fullstack.service || rollback_failed=true
        if [[ "$rollback_failed" == true ]]; then
            echo "Automatic restore was incomplete. Recover the application from $backup_dir and inspect the service logs." >&2
        else
            echo 'Previous application files restored and service restart requested; check recovery in the service logs.' >&2
        fi
    fi
    exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

changed=true
systemctl stop fullstack.service
install -m 644 "$release_dir/app.jar" /opt/fullstack-lab/app.jar
mv /var/www/fullstack-lab "$backup_dir/www"
website_moved=true
mv "$staging_dir" /var/www/fullstack-lab
if command -v getenforce >/dev/null && [[ $(getenforce) == Enforcing ]]; then
    restorecon -RF /var/www/fullstack-lab
fi
systemctl start fullstack.service

healthy=false
for ((attempt=0; attempt<60; attempt++)); do
    if curl -fsS --max-time 3 http://127.0.0.1/api/products >/dev/null 2>&1; then
        healthy=true
        break
    fi
    sleep 2
done
[[ "$healthy" == true ]] || { echo 'The Products API health check failed.' >&2; exit 1; }
for path in / /characters/; do
    curl -fsS --max-time 10 "http://127.0.0.1$path" >/dev/null
done
[[ $(curl -fsS --max-time 10 http://127.0.0.1/release.txt) == "$revision" ]] || {
    echo 'Nginx is not serving the expected release.' >&2; exit 1;
}
printf 'Deployment successful: %s\nPrevious application: %s\n' "$revision" "$backup_dir"
