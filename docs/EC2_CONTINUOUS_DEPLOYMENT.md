# Continuous deployment to the existing EC2 lab

Work items: `SCRUM-5` (initial deployment) and `SCRUM-7` (two-node deployment).

Changes are developed on a Jira-linked branch, reviewed into `dev`, and released
through a second pull request from `dev` into `main`. Only a push to `main` or a
manual run selected on `main` can reach the deployment job.

## What the workflow does

1. Checks the deployment scripts and release-validation tests.
2. Compiles and tests the Java backend and both React frontends.
3. Builds the production frontends with `VITE_PRODUCTS_API_URL=/api/products`.
4. Packages a release and its SHA-256 checksum. Pull requests stop here.
5. Downloads that same verified bundle in a separate `production` job.
6. Requires exactly two healthy HTTP:80 targets and checks their VPC and security groups.
7. Updates the secondary node first, then the primary. For each node, discovers
   its current public IP, temporarily permits SSH from the runner's single IPv4
   address, checks the pinned host key, and uploads the bundle.
8. Rechecks peer health, drains the target from the ALB, and runs `update.sh`.
9. Verifies the node's revision over SSH, registers it again, and waits for healthy
   status before proceeding. The final check covers both targets and the ALB URLs.
10. Attempts to restore target registration and remove this run's temporary SSH
    rules on failure. One production job covers both nodes.

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

| Variable                          | Value                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| `AWS_REGION`                      | The region shown in the EC2 console, for example `us-east-1`.       |
| `EC2_INSTANCE_ID`                 | The existing instance ID beginning with `i-`.                       |
| `EC2_SECURITY_GROUP_ID`           | A security group attached to that instance, beginning with `sg-`.   |
| `EC2_SSH_HOST_KEY`                | The instance's public SSH host key, captured as described below.    |
| `EC2_SECONDARY_INSTANCE_ID`       | The second application instance ID.                                 |
| `EC2_SECONDARY_SECURITY_GROUP_ID` | A security group attached to the second instance.                   |
| `EC2_SECONDARY_SSH_HOST_KEY`      | The second instance's public SSH host key.                          |
| `ALB_TARGET_GROUP_ARN`            | The ARN of the HTTP:80 instance target group containing both nodes. |
| `ALB_DNS_NAME`                    | The ALB DNS name, without `http://`, a port, or a path.             |

Connect to the instance using the existing trusted SSH connection and run:

```bash
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

Copy that one public-key line into `EC2_SSH_HOST_KEY`. It starts with
`ssh-ed25519`. This is the server's public identity, not the private login key.
It normally remains the same when the same instance is stopped and started.
Replacing the instance requires verifying and updating this value.
Repeat this command on the second instance and save its own key in
`EC2_SECONDARY_SSH_HOST_KEY`. Both nodes currently use the same login key pair;
the public host keys identify two different servers.

## AWS prerequisites

- Start the Academy lab and wait for both EC2 instances to be running and healthy
  in the ALB target group.
- The primary must have the original installation from `deploy/ec2/install.sh`.
  Both nodes need Nginx and `fullstack.service`; PostgreSQL stays on the primary.
- The `ec2-user` account must retain its existing non-interactive sudo access.
- The ALB must be reachable over public HTTP on port 80. The app security group
  permits HTTP from the ALB security group. Direct public HTTP to the nodes is
  not required by the two-node deployment script.
- The lab credentials must allow `ec2:DescribeInstances`,
  `ec2:AuthorizeSecurityGroupIngress`, and `ec2:RevokeSecurityGroupIngress` for
  both configured security groups. It also needs `elasticloadbalancing:DescribeTargetGroups`,
  `elasticloadbalancing:DescribeTargetHealth`, `elasticloadbalancing:DeregisterTargets`,
  and `elasticloadbalancing:RegisterTargets`. Check these permissions in the live lab.
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

1. Review the deployment changes in a pull request to `dev`. Keep its Jira key in the
   pull request title. The release job must pass; deployment will be skipped.
2. Configure the `production` environment and refresh the lab credentials.
3. Start the lab, verify both healthy targets and the ALB website, and complete the AWS prerequisites.
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
Deployment briefly stops one backend while replacing its JAR. The other target
continues serving traffic; the PostgreSQL container is not stopped by this update.

Before replacement, it saves the previous JAR and website under
`/opt/fullstack-lab/rollback.*`. If a server-side update or health check fails,
it attempts to restore those files and restart the previous service; the run
still fails. This is application-file recovery, not database-schema rollback.
Changes that migrate schemas require a separate backup and migration plan.
During a rolling release, old and new application versions coexist briefly and
must remain compatible with the same database schema.

If an update fails, the driver attempts to register that node again and waits
for health before exiting with failure. It does not proceed to the other node.
If a hard runner outage or expired credentials prevent recovery, inspect the
target group, register the missing instance on port 80, and inspect its service
logs if it remains unhealthy. Do not retry the rollout until both targets are
healthy. A failure on the second updated node can leave different application
revisions running; this is not an atomic two-node rollback.

Uploaded bundles remain in `/home/ec2-user/fullstack-deploy/`; previous versions
remain in `/opt/fullstack-lab/rollback.*`. Check available disk space and remove
obsolete versions only after verifying a successful release.

## Jira automation and release verification

Work item: `SCRUM-6`.

The WEB space uses Jira keys such as `SCRUM-6` to associate GitHub activity with
work items. Keep the key in branch names, commit messages, and pull request titles.
Configure the following rules in Jira's space automation settings:

| Event                                           | Condition                                                 | Result                                                   |
| ----------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| Work item transitions from To Do to In Progress | No branch starts with `<issue-key>-`                      | Create `<issue-key>-work` from the current `dev` commit. |
| Linked branch is created                        | Work item is To Do                                        | Move it to In Progress.                                  |
| Linked pull request is created                  | Work item is In Progress                                  | Move it to In Review.                                    |
| Linked deployment succeeds                      | Environment type is Production and work item is In Review | Move it to Done.                                         |

For this personal GitHub repository, the first rule uses web requests instead of
the organization-based Create branch in GitHub action. It checks matching branch
references, requires HTTP 200 and an empty list, reads `refs/heads/dev`, requires
HTTP 200 again, and creates the new reference with that commit SHA. HTTP 201
confirms creation. Every request waits for its response before the next step.

The write request uses a fine-grained token restricted to `fullstack-lab` with
Contents read/write access. Store it only in the hidden Authorization header in
Jira, using `Bearer <token>`. Renew the token and replace that header before it
expires. Never put the token in this guide, Git commits, or audit-log messages.

Keep the rule setting that allows other automation rules to trigger this rule
disabled. A transition caused by the Branch created rule should not start another
branch-creation run. The matching-reference check also skips creation when the
same work item returns from To Do to In Progress and its branch still exists.

Creating `SCRUM-6-work`, moving it to In Review on PR creation, and moving it to
Done after deployment were verified during SCRUM-6. Jira rules run
on new events and do not retroactively process the previous deployment.

Use this checklist when verifying a new release (substitute its Jira key):

1. Commit this documentation change on `SCRUM-6-work`, staging only this file.
2. Open a pull request to `dev` with `SCRUM-6` in its title. Confirm the card moves
   to In Review and wait for all applicable checks to pass before merging.
3. Keep the Academy lab running and refresh the temporary AWS credentials if
   needed. Open a release pull request from `dev` to `main`, retaining `SCRUM-6`
   in its title. Wait for checks, then merge using a merge commit.
4. Confirm the production deployment succeeds, `/release.txt` matches the deployed
   commit, both frontends work, and existing products remain available.
5. Confirm SCRUM-6 moves to Done. If it does not, inspect the Jira automation audit
   log and the work item's linked deployment before changing the rule.
6. Record the pull requests, successful workflow run, and Jira audit result as
   evidence on SCRUM-6. Only then mark this end-to-end check complete.

Merging into `dev` does not deploy the application. A failed production deployment
must not move the work item to Done.

## Local checks

```bash
bash -n deploy/ec2/update.sh
bash -n deploy/ec2/github-deploy.sh
bash -n deploy/ec2/github-deploy-alb.sh
bash tests/deployment-release.test.sh
bash tests/deployment-alb.test.sh
```

These checks do not contact AWS. Full deployment, credential permissions, recovery,
and database persistence still require verification against the running lab.

## Two-node lab bootstrap and evidence

The lab uses two app nodes in different availability zones, an internet-facing
ALB listening on HTTP:80, and an instance target group with `/api/products` as its
health-check path. Both applications use the PostgreSQL database on the primary's
private address. This balances application traffic, but the database host remains
a single point of failure; it is not a highly available database architecture.

Bootstrap tools are manual administrative operations, not workflow steps:

1. Attach a database security group to the primary allowing TCP:5432 only from
   the app security group. Back up and inspect the database archive.
2. Run `enable-private-database.sh` as root on the primary with its private IPv4
   address. It preserves the named volume, publishes loopback and private ports,
   and retains the old container stopped. Never start that old container while
   the replacement is using the same volume.
3. Run `export-app-node.sh` on the primary with that private IPv4 address. Transfer
   its archive and checksum over SSH to the secondary's
   `/home/ec2-user/fullstack-node-transfer/` directory.
4. Run `install-app-node.sh` as root on the secondary. It installs the application
   using the shared database, disables seed creation, and validates the schema.
   It deletes the transferred archive after success. Remove the archive and
   checksum from the source too: the archive contains database credentials.
5. Register both nodes on port 80, attach the target group to the ALB, and wait
   for two healthy targets before configuring the GitHub variables above.

On October 29, 2026, both nodes were healthy and served revision
`e3c1dc4df186c427f89f7a12675c4f82695be8d0`. A marked set of 20 ALB requests
appeared in the Nginx logs as 10 requests on each node. This verifies traffic
distribution. The new rolling deployment workflow still requires its first
successful live run; simulated tests alone do not verify AWS permissions.

## References

- [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Authorize an EC2 security group ingress rule](https://docs.aws.amazon.com/cli/latest/reference/ec2/authorize-security-group-ingress.html)
- [Revoke an EC2 security group ingress rule](https://docs.aws.amazon.com/cli/latest/reference/ec2/revoke-security-group-ingress.html)
