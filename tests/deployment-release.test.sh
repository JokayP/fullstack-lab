#!/usr/bin/env bash
# Exercise release validation and access cleanup without AWS or local service changes.
set -Eeuo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$repo_dir/target"
fixture=$(mktemp -d "$repo_dir/target/deployment-test.XXXXXX")
cleanup() {
    case "$fixture" in
        "$repo_dir"/target/deployment-test.*) rm -rf -- "$fixture" ;;
        *) echo 'Unexpected test directory; cleanup refused.' >&2; return 1 ;;
    esac
}
trap cleanup EXIT
mkdir -p "$fixture/release/www/characters"
printf 'placeholder jar\n' > "$fixture/release/app.jar"
printf '<html>store</html>\n' > "$fixture/release/www/index.html"
printf '<html>characters</html>\n' > "$fixture/release/www/characters/index.html"
printf '%040d\n' 1 > "$fixture/release/www/release.txt"
validate() { bash "$repo_dir/deploy/ec2/update.sh" --validate-only "$fixture/release"; }
expect_failure() {
    if validate > "$fixture/error.log" 2>&1; then
        echo "Expected validation to reject: $1" >&2
        exit 1
    fi
    grep -F "$2" "$fixture/error.log" >/dev/null
    printf 'PASS: %s\n' "$1"
}
validate
echo 'PASS: complete release accepted'
mv "$fixture/release/www/characters/index.html" "$fixture/characters.html"
expect_failure 'missing characters build' 'Missing or empty release file: www/characters/index.html'
mv "$fixture/characters.html" "$fixture/release/www/characters/index.html"
printf 'main\n' > "$fixture/release/www/release.txt"
expect_failure 'invalid revision' 'complete Git commit SHA'
printf '%040d\n' 1 > "$fixture/release/www/release.txt"
: > "$fixture/release/app.jar"
expect_failure 'empty backend artifact' 'Missing or empty release file: app.jar'
printf 'placeholder jar\n' > "$fixture/release/app.jar"
if ln -s "$fixture/release/www/index.html" "$fixture/release/www/unexpected-link" 2>/dev/null \
    && [[ -L "$fixture/release/www/unexpected-link" ]]; then
    expect_failure 'symlinks in a release' 'Release symlinks are not supported'
else
    echo 'SKIP: this filesystem does not support Unix symbolic links; CI checks this on Linux.'
fi
echo 'All release validation checks passed.'

# A mocked AWS CLI checks cleanup ownership, retries, and private-key removal.
export RUNNER_TEMP="$fixture/runner"
export EC2_SECURITY_GROUP_ID=sg-12345678
export MOCK_AWS_LOG="$fixture/aws.log"
mkdir -p "$fixture/bin" "$RUNNER_TEMP/fullstack-ec2"
cat > "$fixture/bin/aws" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$MOCK_AWS_LOG"
exit "${MOCK_AWS_FAILURE:-0}"
MOCK
chmod +x "$fixture/bin/aws"
export PATH="$fixture/bin:$PATH"
printf 'sgr-12345678\n' > "$RUNNER_TEMP/fullstack-ec2/rule-id"
printf 'temporary key\n' > "$RUNNER_TEMP/fullstack-ec2/key"
bash "$repo_dir/deploy/ec2/github-deploy.sh" --cleanup
grep -Fx 'ec2 revoke-security-group-ingress --group-id sg-12345678 --security-group-rule-ids sgr-12345678' "$MOCK_AWS_LOG"
[[ ! -e "$RUNNER_TEMP/fullstack-ec2/rule-id" && ! -e "$RUNNER_TEMP/fullstack-ec2/key" ]]
echo 'PASS: cleanup revokes only the recorded rule and removes the private key'
bash "$repo_dir/deploy/ec2/github-deploy.sh" --cleanup
[[ $(wc -l < "$MOCK_AWS_LOG") -eq 1 ]]
echo 'PASS: repeated cleanup does not revoke existing unrelated rules'
printf 'sgr-abcdef01\n' > "$RUNNER_TEMP/fullstack-ec2/rule-id"
printf 'temporary key\n' > "$RUNNER_TEMP/fullstack-ec2/key"
if MOCK_AWS_FAILURE=1 bash "$repo_dir/deploy/ec2/github-deploy.sh" --cleanup > "$fixture/cleanup-error.log" 2>&1; then
    echo 'Expected cleanup to report failed revocation.' >&2
    exit 1
fi
[[ -s "$RUNNER_TEMP/fullstack-ec2/rule-id" && ! -e "$RUNNER_TEMP/fullstack-ec2/key" ]]
grep -F 'Could not remove temporary SSH rule sgr-abcdef01' "$fixture/cleanup-error.log"
echo 'PASS: cleanup failure retains the rule ID for retry and still removes the private key'
