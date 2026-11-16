#!/usr/bin/env bash
# Applies the repository configuration from code (D41, D58): settings, security, rulesets, environments.
# Run by the person (D35) with a one-day fine-grained token, revoked afterwards (D64):
#   repository worKampo/workampo, permissions Administration: read and write.
#   GH_TOKEN=<token> bash scripts/github/setup-repo.sh
# Idempotent: safe to run again after changing .github/rulesets/*.json.
set -euo pipefail

REPO=worKampo/workampo
PERSON=workampo-dev # required reviewer of the prod environment

[ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN is not set: create a one-day admin token (see header)." >&2; exit 1; }
cd "$(dirname "$0")/../.."

echo "Settings: squash merge only, delete merged branches, secret scanning and push protection"
gh api -X PATCH "repos/$REPO" --silent --input - <<'JSON'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_auto_merge": false,
  "delete_branch_on_merge": true,
  "squash_merge_commit_title": "PR_TITLE",
  "squash_merge_commit_message": "COMMIT_MESSAGES",
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

echo "Actions: read-only GITHUB_TOKEN by default, workflows cannot approve PRs"
gh api -X PUT "repos/$REPO/actions/permissions/workflow" --silent \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

echo "Dependabot: security alerts only; version updates come from Renovate"
gh api -X PUT "repos/$REPO/vulnerability-alerts" --silent
gh api -X DELETE "repos/$REPO/automated-security-fixes" --silent
gh api -X PUT "repos/$REPO/private-vulnerability-reporting" --silent

echo "CodeQL: default setup"
gh api -X PATCH "repos/$REPO/code-scanning/default-setup" --silent -f state=configured

for file in .github/rulesets/*.json; do
  name=$(sed -n 's/^  "name": "\(.*\)",$/\1/p' "$file")
  id=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$name\") | .id")
  if [ -n "$id" ]; then
    echo "Ruleset $name: update"
    gh api -X PUT "repos/$REPO/rulesets/$id" --silent --input "$file"
  else
    echo "Ruleset $name: create"
    gh api -X POST "repos/$REPO/rulesets" --silent --input "$file"
  fi
done

echo "Environments: stg, and prod with the person as required reviewer"
gh api -X PUT "repos/$REPO/environments/stg" --silent
person_id=$(gh api "users/$PERSON" --jq .id)
gh api -X PUT "repos/$REPO/environments/prod" --silent --input - <<JSON
{
  "reviewers": [{ "type": "User", "id": $person_id }],
  "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false }
}
JSON

echo "Done. Revoke the token now."
