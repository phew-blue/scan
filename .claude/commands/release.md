Trigger a release for scan via the prepare-release workflow.

Usage: /release <version>   e.g. /release v0.2.0

Steps:

1. Confirm the version argument was provided. If not, ask the user for it.
   - Must have `v` prefix: e.g. `v0.2.0`, `v0.2.0-alpha.1`

2. Check CI status on main: `gh run list --branch main --limit 5 --repo phew-blue/scan`
   - If any recent run failed, warn the user and ask whether to proceed.

3. Trigger the prepare-release workflow:
   `gh workflow run prepare-release.yml --field version=<version> --repo phew-blue/scan`

4. Wait a few seconds, then find the resulting PR:
   `gh pr list --repo phew-blue/scan --head release/<version>`
   Retry up to 5 times with a short wait if the PR isn't created yet.

5. Report the PR URL to the user and give them next steps:
   - Review the PR — it bumps versions across all relevant files
   - Merge the PR
   - The auto-tag workflow will detect the release commit and push the tag automatically
   - The tag push triggers the Docker build and GitHub release creation automatically
   - Once the Docker build completes, update `kubernetes/apps/default/scan/app/helmrelease.yaml`
     in home-ops with the new image tag and SHA digest
