#!/usr/bin/env bash
# Run only on a GitHub-hosted runner, using the production environment credentials.
set -Eeuo pipefail
state_dir="${RUNNER_TEMP:?This script requires a GitHub Actions runner}/fullstack-ec2"

cleanup() {
    local result=0 rule_id
    if [[ -s "$state_dir/rule-id" ]]; then
        rule_id=$(cat "$state_dir/rule-id")
        if [[ "$rule_id" =~ ^sgr-[0-9a-f]+$ ]]; then
            if aws ec2 revoke-security-group-ingress \
                --group-id "$EC2_SECURITY_GROUP_ID" \
                --security-group-rule-ids "$rule_id" >/dev/null; then
                rm -f "$state_dir/rule-id"
                echo "Removed temporary SSH rule: $rule_id"
            else
                echo "Could not remove temporary SSH rule $rule_id. Remove it from the EC2 security group." >&2
                result=1
            fi
        else
            echo 'Unexpected security group rule ID; inspect the deployment logs.' >&2
            result=1
        fi
    fi
    rm -f "$state_dir/key" "$state_dir/known_hosts"
    return "$result"
}
if [[ ${1:-} == --cleanup ]]; then
    cleanup
    exit $?
fi

for setting in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_DEFAULT_REGION \
    EC2_INSTANCE_ID EC2_SECURITY_GROUP_ID EC2_SSH_PRIVATE_KEY EC2_SSH_HOST_KEY \
    GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT; do
    [[ -n ${!setting:-} ]] || { echo "Missing production configuration: $setting" >&2; exit 1; }
done
[[ "$EC2_INSTANCE_ID" =~ ^i-[0-9a-f]+$ ]] || { echo 'Invalid EC2 instance ID.' >&2; exit 1; }
[[ "$EC2_SECURITY_GROUP_ID" =~ ^sg-[0-9a-f]+$ ]] || { echo 'Invalid EC2 security group ID.' >&2; exit 1; }
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || exit 1
[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
for tool in aws python3 ssh scp curl sha256sum; do
    command -v "$tool" >/dev/null || { echo "Required runner tool is unavailable: $tool" >&2; exit 1; }
done
bundle_dir=$(realpath "${1:?Provide the downloaded release bundle directory}")
for artifact in bundle.tar.gz bundle.sha256 update.sh; do
    [[ -s "$bundle_dir/$artifact" ]] || { echo "Missing release artifact: $artifact" >&2; exit 1; }
done
(cd "$bundle_dir" && sha256sum -c bundle.sha256)
mkdir -p "$state_dir"
chmod 700 "$state_dir"
finish() {
    local result=$?
    trap - EXIT INT TERM
    cleanup || result=1
    exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Read the current address instead of storing an IP that changes after an Academy restart.
aws ec2 describe-instances --instance-ids "$EC2_INSTANCE_ID" > "$state_dir/instance.json"
host=$(python3 - "$state_dir/instance.json" <<'PY'
import ipaddress
import json
import os
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    data = json.load(source)
instance = data["Reservations"][0]["Instances"][0]
if instance["State"]["Name"] != "running":
    sys.exit("The EC2 instance is stopped. Start the Academy lab and instance first.")
groups = {item["GroupId"] for item in instance["SecurityGroups"]}
if os.environ["EC2_SECURITY_GROUP_ID"] not in groups:
    sys.exit("The configured security group is not attached to the target instance.")
print(ipaddress.IPv4Address(instance.get("PublicIpAddress", "")))
PY
)

# Pin the host identity captured through the user's existing trusted SSH connection.
printf '%s\n' "$EC2_SSH_PRIVATE_KEY" | tr -d '\r' > "$state_dir/key"
printf 'fullstack-ec2 %s\n' "$EC2_SSH_HOST_KEY" > "$state_dir/known_hosts"
chmod 600 "$state_dir/key" "$state_dir/known_hosts"
ssh-keygen -y -f "$state_dir/key" >/dev/null
ssh-keygen -l -f "$state_dir/known_hosts" >/dev/null

# Permit only this runner's IPv4 address, and revoke only the rule this run creates.
runner_ip=$(curl -4fsS --retry 3 --max-time 15 https://checkip.amazonaws.com)
export RUNNER_PUBLIC_IP="$runner_ip"
python3 - "$state_dir/ingress.json" <<'PY'
import ipaddress
import json
import os
import sys

ip = ipaddress.IPv4Address(os.environ["RUNNER_PUBLIC_IP"].strip())
rules = [{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22,
          "IpRanges": [{"CidrIp": f"{ip}/32",
                        "Description": f"GitHub Actions {os.environ['GITHUB_RUN_ID']}"}]}]
with open(sys.argv[1], "w", encoding="utf-8") as target:
    json.dump(rules, target)
PY
aws ec2 authorize-security-group-ingress --group-id "$EC2_SECURITY_GROUP_ID" \
    --ip-permissions "file://$state_dir/ingress.json" \
    --query 'SecurityGroupRules[0].SecurityGroupRuleId' --output text > "$state_dir/rule-id"

ssh_options=(-i "$state_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes -o HostKeyAlias=fullstack-ec2 \
    -o "UserKnownHostsFile=$state_dir/known_hosts" -o ConnectTimeout=10 \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
destination="ec2-user@$host"
ready=false
for ((attempt=0; attempt<12; attempt++)); do
    if ssh "${ssh_options[@]}" "$destination" true; then
        ready=true
        break
    fi
    sleep 5
done
[[ "$ready" == true ]] || { echo 'SSH did not become reachable; check the instance, key, and security group.' >&2; exit 1; }
remote_dir="/home/ec2-user/fullstack-deploy/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
# Expansion is intentional: the path uses a fixed prefix and validated numeric IDs.
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$destination" "mkdir -p '$remote_dir' && chmod 700 '$remote_dir'"
scp "${ssh_options[@]}" "$bundle_dir/bundle.tar.gz" "$bundle_dir/bundle.sha256" \
    "$bundle_dir/update.sh" "$destination:$remote_dir/"
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$destination" \
    "set -e; cd '$remote_dir'; sha256sum -c bundle.sha256; tar -xzf bundle.tar.gz; sudo -n bash ./update.sh ./release"

for path in / /characters/ /api/products; do
    curl -fsS --retry 3 --retry-delay 2 --max-time 15 "http://$host$path" >/dev/null
done
[[ $(curl -fsS --max-time 15 "http://$host/release.txt") == "$GITHUB_SHA" ]] || {
    echo 'The public website did not return the expected Git revision.' >&2; exit 1;
}
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    printf '## EC2 deployment\n\n- Revision: %s\n- Storefront: http://%s/\n- Characters: http://%s/characters/\n' \
        "$GITHUB_SHA" "$host" "$host" >> "$GITHUB_STEP_SUMMARY"
fi
echo "Public health checks passed for revision $GITHUB_SHA."
