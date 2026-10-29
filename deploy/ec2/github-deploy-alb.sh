#!/usr/bin/env bash
# Deploy the same verified bundle to two existing targets, one at a time.
set -Eeuo pipefail
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

run_node() {
    local node=$1
    shift
    if [[ "$node" == secondary ]]; then
        DEPLOY_NODE_NAME=secondary \
        EC2_INSTANCE_ID="${EC2_SECONDARY_INSTANCE_ID:-}" \
        EC2_SECURITY_GROUP_ID="${EC2_SECONDARY_SECURITY_GROUP_ID:-}" \
        EC2_SSH_HOST_KEY="${EC2_SECONDARY_SSH_HOST_KEY:-}" \
            bash "$script_dir/github-deploy.sh" "$@"
    else
        DEPLOY_NODE_NAME=primary bash "$script_dir/github-deploy.sh" "$@"
    fi
}
if [[ ${1:-} == --cleanup ]]; then
    result=0
    run_node secondary --cleanup || result=1
    run_node primary --cleanup || result=1
    exit "$result"
fi

for setting in RUNNER_TEMP EC2_INSTANCE_ID EC2_SECURITY_GROUP_ID EC2_SSH_HOST_KEY \
    EC2_SECONDARY_INSTANCE_ID EC2_SECONDARY_SECURITY_GROUP_ID EC2_SECONDARY_SSH_HOST_KEY \
    ALB_TARGET_GROUP_ARN ALB_DNS_NAME GITHUB_SHA; do
    [[ -n ${!setting:-} ]] || { echo "Missing production configuration: $setting" >&2; exit 1; }
done
for setting in EC2_INSTANCE_ID EC2_SECONDARY_INSTANCE_ID; do
    [[ ${!setting} =~ ^i-[0-9a-f]+$ ]] || { echo "Invalid instance ID: $setting" >&2; exit 1; }
done
[[ "$EC2_INSTANCE_ID" != "$EC2_SECONDARY_INSTANCE_ID" ]] || { echo 'Two distinct instances are required.' >&2; exit 1; }
[[ "$ALB_TARGET_GROUP_ARN" =~ ^arn:aws:elasticloadbalancing:[a-z0-9-]+:[0-9]{12}:targetgroup/[a-zA-Z0-9-]+/[a-f0-9]+$ ]] || exit 1
[[ "$ALB_DNS_NAME" =~ ^[a-zA-Z0-9-]+\.[a-z0-9-]+\.elb\.amazonaws\.com$ ]] || {
    echo 'Use the ALB DNS name without a scheme, path, or port.' >&2; exit 1;
}
bundle_dir=$(realpath "${1:?Provide the verified bundle directory}")
state_dir="$RUNNER_TEMP/fullstack-alb"
mkdir -p "$state_dir"
chmod 700 "$state_dir"
aws elbv2 describe-target-groups --target-group-arns "$ALB_TARGET_GROUP_ARN" > "$state_dir/group.json"
aws elbv2 describe-target-health --target-group-arn "$ALB_TARGET_GROUP_ARN" > "$state_dir/targets.json"
aws ec2 describe-instances --instance-ids "$EC2_INSTANCE_ID" "$EC2_SECONDARY_INSTANCE_ID" > "$state_dir/instances.json"

python3 - "$state_dir" <<'PY'
import ipaddress
import json
import os
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
def read(name):
    return json.loads((root / name).read_text(encoding='utf-8'))

group = read('group.json')['TargetGroups'][0]
if (group['TargetType'] != 'instance' or group['Protocol'] != 'HTTP'
        or group['Port'] != 80 or not group.get('LoadBalancerArns')):
    sys.exit('Expected an attached HTTP:80 instance target group.')
expected = {os.environ['EC2_INSTANCE_ID']: os.environ['EC2_SECURITY_GROUP_ID'],
            os.environ['EC2_SECONDARY_INSTANCE_ID']: os.environ['EC2_SECONDARY_SECURITY_GROUP_ID']}
targets = read('targets.json')['TargetHealthDescriptions']
if (len(targets) != 2 or {t['Target']['Id'] for t in targets} != set(expected)
        or any(t['Target'].get('Port') != 80 or t['TargetHealth']['State'] != 'healthy' for t in targets)):
    sys.exit('Both configured instances must be the only registered targets and healthy on port 80.')
instances = [i for r in read('instances.json')['Reservations'] for i in r['Instances']]
if len(instances) != 2 or {i['InstanceId'] for i in instances} != set(expected):
    sys.exit('Could not resolve both EC2 instances.')
for instance in instances:
    groups = {g['GroupId'] for g in instance['SecurityGroups']}
    if (instance['State']['Name'] != 'running' or instance['VpcId'] != group['VpcId']
            or expected[instance['InstanceId']] not in groups):
        sys.exit('An instance is stopped or has an unexpected VPC/security group.')
    ipaddress.IPv4Address(instance.get('PublicIpAddress', ''))
print('Preflight passed: two healthy targets in the expected VPC.')
PY

# Stop if either node fails. The other remains registered and is not updated.
run_node secondary "$bundle_dir"
run_node primary "$bundle_dir"
aws elbv2 wait target-in-service --target-group-arn "$ALB_TARGET_GROUP_ARN" \
    --targets "Id=$EC2_INSTANCE_ID,Port=80" "Id=$EC2_SECONDARY_INSTANCE_ID,Port=80"
for path in / /characters/ /api/products; do
    curl -fsS --retry 3 --retry-delay 2 --max-time 15 "http://$ALB_DNS_NAME$path" >/dev/null
done
for ((attempt=0; attempt<10; attempt++)); do
    [[ $(curl -fsS --max-time 15 "http://$ALB_DNS_NAME/release.txt") == "$GITHUB_SHA" ]] || {
        echo 'The ALB returned an unexpected release revision.' >&2; exit 1;
    }
done
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    printf '\n## Load-balanced release\n\n- Revision: %s\n- Both targets healthy.\n- Storefront: http://%s/\n- Characters: http://%s/characters/\n' \
        "$GITHUB_SHA" "$ALB_DNS_NAME" "$ALB_DNS_NAME" >> "$GITHUB_STEP_SUMMARY"
fi
echo 'Both application nodes and the ALB passed release verification.'
