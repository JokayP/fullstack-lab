#!/usr/bin/env bash
# Exercise the real orchestration scripts with simulated AWS/SSH/HTTP responses.
set -Eeuo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$repo_dir/target"
fixture=$(mktemp -d "$repo_dir/target/alb-deployment-test.XXXXXX")
cleanup() {
    case "$fixture" in
        "$repo_dir"/target/alb-deployment-test.*) rm -rf -- "$fixture" ;;
        *) echo 'Unexpected test directory; cleanup refused.' >&2; return 1 ;;
    esac
}
trap cleanup EXIT
mkdir -p "$fixture/bin" "$fixture/bundle"
printf 'mock bundle\n' > "$fixture/bundle/bundle.tar.gz"
printf 'mock updater\n' > "$fixture/bundle/update.sh"
(cd "$fixture/bundle" && sha256sum bundle.tar.gz > bundle.sha256)

export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_SESSION_TOKEN=test
export AWS_DEFAULT_REGION=us-east-1 GITHUB_RUN_ID=123 GITHUB_RUN_ATTEMPT=1
export GITHUB_SHA=1111111111111111111111111111111111111111
export EC2_INSTANCE_ID=i-11111111 EC2_SECONDARY_INSTANCE_ID=i-22222222
export EC2_SECURITY_GROUP_ID=sg-11111111 EC2_SECONDARY_SECURITY_GROUP_ID=sg-22222222
export EC2_SSH_PRIVATE_KEY='mock private key, never used for a real connection'
export EC2_SSH_HOST_KEY='ssh-ed25519 mock-primary' EC2_SECONDARY_SSH_HOST_KEY='ssh-ed25519 mock-secondary'
export ALB_TARGET_GROUP_ARN=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/test/abcdef01
export ALB_DNS_NAME=test-alb.us-east-1.elb.amazonaws.com
unset DEPLOY_NODE_NAME GITHUB_STEP_SUMMARY

cat > "$fixture/bin/aws" <<'MOCK'
#!/usr/bin/env bash
set -eu
printf 'aws|%s|%s\n' "${DEPLOY_NODE_NAME:-preflight}" "$*" >> "$MOCK_EVENTS"
case "$1 $2" in
    'elbv2 describe-target-groups')
        printf '%s\n' '{"TargetGroups":[{"TargetType":"instance","Protocol":"HTTP","Port":80,"VpcId":"vpc-test","LoadBalancerArns":["arn:test"]}]}' ;;
    'elbv2 describe-target-health')
        primary_state=healthy
        if [[ "$MOCK_MODE" == unhealthy || ( "$MOCK_MODE" == peer-failed && ${DEPLOY_NODE_NAME:-} == secondary ) ]]; then
            primary_state=unhealthy
        fi
        printf '{"TargetHealthDescriptions":[{"Target":{"Id":"i-11111111","Port":80},"TargetHealth":{"State":"%s"}},{"Target":{"Id":"i-22222222","Port":80},"TargetHealth":{"State":"healthy"}}]}\n' "$primary_state" ;;
    'ec2 describe-instances')
        printf '{"Reservations":[{"Instances":['
        separator=''
        for arg in "$@"; do
            case "$arg" in
                i-11111111) group=sg-11111111; address=192.0.2.11 ;;
                i-22222222) group=sg-22222222; address=192.0.2.22 ;;
                *) continue ;;
            esac
            printf '%s{"InstanceId":"%s","State":{"Name":"running"},"VpcId":"vpc-test","PublicIpAddress":"%s","SecurityGroups":[{"GroupId":"%s"}]}' "$separator" "$arg" "$address" "$group"
            separator=,
        done
        printf ']}]}\n' ;;
    'ec2 authorize-security-group-ingress') printf 'sgr-abcdef01\n' ;;
    'ec2 revoke-security-group-ingress') : ;;
    'elbv2 deregister-targets') : ;;
    'elbv2 register-targets') [[ "$MOCK_MODE" != registration-failed ]] ;;
    'elbv2 wait') : ;;
    *) echo "Unexpected mocked AWS call: $*" >&2; exit 1 ;;
esac
MOCK
cat > "$fixture/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
set -eu
printf 'ssh|%s|%s\n' "$EC2_INSTANCE_ID" "$*" >> "$MOCK_EVENTS"
command=${@: -1}
if [[ "$command" == *'sudo -n bash ./update.sh'* && "$MOCK_MODE" == update-failed && "$EC2_INSTANCE_ID" == i-22222222 ]]; then
    echo 'Simulated node update failure.' >&2
    exit 1
fi
if [[ "$command" == 'curl -fsS --max-time 10 http://127.0.0.1/release.txt' ]]; then
    if [[ "$MOCK_MODE" == node-revision-failed ]]; then printf '%040d\n' 0; else printf '%s\n' "$GITHUB_SHA"; fi
fi
MOCK
cat > "$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -eu
url=${@: -1}
case "$url" in
    https://checkip.amazonaws.com) printf '198.51.100.7\n' ;;
    http://test-alb.us-east-1.elb.amazonaws.com/release.txt)
        if [[ "$MOCK_MODE" == alb-revision-failed ]]; then printf '%040d\n' 0; else printf '%s\n' "$GITHUB_SHA"; fi ;;
    http://test-alb.us-east-1.elb.amazonaws.com/*) printf 'mock HTTP response\n' ;;
    *) echo "Unexpected HTTP destination: $url" >&2; exit 1 ;;
esac
MOCK
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/scp"
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/ssh-keygen"
if [[ -n ${TEST_PYTHON_EXE:-} ]]; then
    # Expand the interpreter path when the generated wrapper runs.
    # shellcheck disable=SC2016
    printf '#!/usr/bin/env bash\nexec "$TEST_PYTHON_EXE" "$@"\n' > "$fixture/bin/python3"
fi
chmod +x "$fixture/bin/"*
export PATH="$fixture/bin:$PATH"

run_case() {
    export MOCK_MODE=$1
    export RUNNER_TEMP="$fixture/$MOCK_MODE"
    mkdir -p "$RUNNER_TEMP"
    export MOCK_EVENTS="$RUNNER_TEMP/events.log"
    : > "$MOCK_EVENTS"
    local result=0
    bash "$repo_dir/deploy/ec2/github-deploy-alb.sh" "$fixture/bundle" > "$RUNNER_TEMP/output.log" 2>&1 || result=$?
    if [[ "$MOCK_MODE" == normal ]]; then
        if (( result != 0 )); then cat "$RUNNER_TEMP/output.log"; exit 1; fi
    elif (( result == 0 )); then
        echo "Expected a deployment failure: $MOCK_MODE" >&2; exit 1
    fi
}
assert_no_primary_drain() {
    if grep -Fq 'aws|primary|elbv2 deregister-targets' "$MOCK_EVENTS"; then
        echo 'The primary was drained after a secondary failure.' >&2; exit 1
    fi
}

run_case normal
[[ $(grep -c 'elbv2 deregister-targets' "$MOCK_EVENTS") -eq 2 ]]
secondary_ready=$(grep -n 'aws|secondary|elbv2 wait target-in-service' "$MOCK_EVENTS" | head -1 | cut -d: -f1)
primary_drain=$(grep -n 'aws|primary|elbv2 deregister-targets' "$MOCK_EVENTS" | head -1 | cut -d: -f1)
[[ "$secondary_ready" -lt "$primary_drain" ]]
[[ ! -e "$RUNNER_TEMP/fullstack-ec2-secondary/key" && ! -e "$RUNNER_TEMP/fullstack-ec2-primary/key" ]]
grep -Fq -- '--group-id sg-22222222 --security-group-rule-ids sgr-abcdef01' "$MOCK_EVENTS"
grep -Fq -- '--group-id sg-11111111 --security-group-rule-ids sgr-abcdef01' "$MOCK_EVENTS"
echo 'PASS: sequential deployment waits for the secondary and cleans the correct SSH groups'

run_case unhealthy
if grep -Fq 'elbv2 deregister-targets' "$MOCK_EVENTS"; then
    echo 'An unhealthy initial target must prevent draining.' >&2; exit 1
fi
echo 'PASS: an unhealthy initial target prevents all changes'

run_case peer-failed
if grep -Fq 'elbv2 deregister-targets' "$MOCK_EVENTS"; then
    echo 'A peer failure must prevent draining.' >&2; exit 1
fi
echo 'PASS: a peer failure after preflight prevents draining'

run_case update-failed
assert_no_primary_drain
grep -Fq 'aws|secondary|elbv2 register-targets' "$MOCK_EVENTS"
[[ ! -e "$RUNNER_TEMP/fullstack-ec2-secondary/target-pending" ]]
[[ ! -e "$RUNNER_TEMP/fullstack-ec2-secondary/key" ]]
echo 'PASS: a failed update restores target registration and stops the rollout'

run_case node-revision-failed
assert_no_primary_drain
grep -Fq 'The instance did not return the expected Git revision.' "$RUNNER_TEMP/output.log"
echo 'PASS: a wrong node revision fails before updating the peer'

run_case registration-failed
assert_no_primary_drain
[[ -s "$RUNNER_TEMP/fullstack-ec2-secondary/target-pending" ]]
MOCK_MODE=normal bash "$repo_dir/deploy/ec2/github-deploy-alb.sh" --cleanup > "$RUNNER_TEMP/retry.log" 2>&1
[[ ! -e "$RUNNER_TEMP/fullstack-ec2-secondary/target-pending" ]]
echo 'PASS: failed registration retains recovery state for the final cleanup step'

run_case alb-revision-failed
grep -Fq 'The ALB returned an unexpected release revision.' "$RUNNER_TEMP/output.log"
echo 'PASS: an unexpected ALB revision cannot produce a successful deployment'
