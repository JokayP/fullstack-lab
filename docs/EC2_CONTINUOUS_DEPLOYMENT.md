# Continuous deployment to the existing EC2 lab

Work item: `SCRUM-5`.

Changes are developed on a Jira-linked branch, reviewed into `dev`, and released
through a second pull request from `dev` into `main`. Only a push to `main` or a
manual run selected on `main` can reach the deployment job.

## What the workflow does

1. Checks the deployment scripts and release-validation tests.
2. Compiles and tests the Java backend and both React frontends.
3. Builds the production frontends with `VITE_PRODUCTS_API_URL=/api/products`.
4. Packages a release and its SHA-256 checksum. Pull requests stop here.
5. Downloads that same verified bundle in a separate `production` job.
6. Uses the instance ID to find its current public IP and confirm it is running.
7. Temporarily permits SSH from the current runner's single IPv4 address.
8. Checks the server's pinned SSH host key, uploads the release, and runs `update.sh`.
9. Checks the website, character explorer, API, and deployed Git revision.
10. Removes the SSH rule created by this run, even after an ordinary failure.

The existing CI workflows continue to run. This workflow repeats the checks for
the exact release it packages, so a successful unrelated or earlier workflow
cannot authorize a deployment. Pull requests receive no deployment credentials.

## One-time GitHub setup

In repository **Settings > Environments**, create `production`.
Under **Deployment branches and tags**, select **Selected branches and tags**
and allow only the `main` branch. This prevents other branches from using these
credentials, even if a pull request changes the workflow.

For automatic deployment, leave required reviewers disabled. Adding a reviewer
instead creates a manual approval step before production deployment.

Add the following **environment secrets** inside `production`:

| Secret                  | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | The current Academy lab AWS access key ID.                |
| `AWS_SECRET_ACCESS_KEY` | The current Academy lab AWS secret access key.            |
| `AWS_SESSION_TOKEN`     | The current Academy lab session token.                    |
| `EC2_SSH_PRIVATE_KEY`   | The complete contents of the existing `labsuser.pem` key. |

Enter these values directly into GitHub's secret fields. Do not commit the key,
the AWS credentials, or generated server environment files to the repository.
Academy credentials are temporary: renew all three AWS secrets when the session
expires. The workflow does not start the lab or create an EC2 instance.

Add these **environment variables**:

| Variable                | Value                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `AWS_REGION`            | The region shown in the EC2 console, for example `us-east-1`.     |
| `EC2_INSTANCE_ID`       | The existing instance ID beginning with `i-`.                     |
| `EC2_SECURITY_GROUP_ID` | A security group attached to that instance, beginning with `sg-`. |
| `EC2_SSH_HOST_KEY`      | The instance's public SSH host key, captured as described below.  |

Connect to the instance using the existing trusted SSH connection and run:

```bash
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

Copy that one public-key line into `EC2_SSH_HOST_KEY`. It starts with
`ssh-ed25519`. This is the server's public identity, not the private login key.
It normally remains the same when the same instance is stopped and started.
Replacing the instance requires verifying and updating this value.

## AWS prerequisites

- Start the Academy lab and wait for the existing EC2 instance to be running.
- The instance must have the original installation from `deploy/ec2/install.sh`,
  with Nginx, `fullstack.service`, and PostgreSQL already working.
- The `ec2-user` account must retain its existing non-interactive sudo access.
- The site must be reachable over public HTTP on port 80, as in the manual demo.
- The lab credentials must allow `ec2:DescribeInstances`,
  `ec2:AuthorizeSecurityGroupIngress`, and `ec2:RevokeSecurityGroupIngress` for
  this instance's security group. Academy policies must be checked in the live lab.
- Use a security group dedicated to this instance when possible. If the group is
  shared, the temporary port 22 rule also applies to other attached instances.

The script uses a `/32` rule for the runner's current address. It does not replace
your existing **My IP** rule or require opening SSH to the entire internet.
If the Academy policies deny the network operations, stop and inspect the error;
do not broaden access as a workaround.

The shell's exit handler and a final `always()` workflow step both attempt to
revoke the temporary rule. A hard runner outage or expired AWS credentials can
still prevent cleanup. In that case, remove the rule whose description starts
with `GitHub Actions` and matches that run number. Existing rules are not removed.

## First release

1. Review the SCRUM-5 changes in a pull request to `dev`. Keep its Jira key in the
   pull request title. The release job must pass; deployment will be skipped.
2. Configure the `production` environment and refresh the lab credentials.
3. Start the lab, verify the EC2 website, and complete the AWS prerequisites.
4. Open a pull request from `dev` to `main` and wait for the checks.
5. Merge it. Open **Actions > Build release and deploy to EC2** to follow the run.
6. Verify the URLs in the deployment job summary. `/release.txt` identifies the
   exact Git commit now served by Nginx.
7. Verify an existing product is still present and both applications work.

If the lab was stopped or the credentials expired, refresh them, then rerun the
failed workflow or use **Run workflow** on `main`. No public IP secret needs updating.

## Recovery and limits

`update.sh` updates only the backend JAR and website files. It does not recreate
the PostgreSQL container, delete its volume, or rewrite `/etc/fullstack-lab`.
Deployment briefly stops the backend while replacing the JAR.

Before replacement, it saves the previous JAR and website under
`/opt/fullstack-lab/rollback.*`. If a server-side update or health check fails,
it attempts to restore those files and restart the previous service; the run
still fails. This is application-file recovery, not database-schema rollback.
Changes that migrate schemas require a separate backup and migration plan.

Uploaded bundles remain in `/home/ec2-user/fullstack-deploy/`; previous versions
remain in `/opt/fullstack-lab/rollback.*`. Check available disk space and remove
obsolete versions only after verifying a successful release.

Jira's **Branch created** and **Pull request created** rules already track
development. Moving a card to **Done after deployment** requires an additional
deployment integration/rule and must be verified separately. Merging into `dev`
does not mean the application has been deployed.

## Local checks

```bash
bash -n deploy/ec2/update.sh
bash -n deploy/ec2/github-deploy.sh
bash tests/deployment-release.test.sh
```

These checks do not contact AWS. Full deployment, credential permissions, recovery,
and database persistence still require verification against the running lab.

## References

- [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Authorize an EC2 security group ingress rule](https://docs.aws.amazon.com/cli/latest/reference/ec2/authorize-security-group-ingress.html)
- [Revoke an EC2 security group ingress rule](https://docs.aws.amazon.com/cli/latest/reference/ec2/revoke-security-group-ingress.html)
