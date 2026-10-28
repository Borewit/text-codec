# Dependabot release-note labels

The workflow inspects the root npm manifest and v3 lockfile at both the PR merge
base and head. It handles direct, transitive and grouped updates, including
security updates, without installing or executing PR code.

- `dev-dependencies`: all named packages and changed lockfile entries are
  development-only in both revisions. Excluded from release notes.
- `dependencies`: runtime, mixed or uncertain scope, including unsupported
  workspaces/lockfiles and incomplete API responses. Included in release notes.

Only the trusted base-branch labeler executes. The labeler adds the selected
scope label before removing its opposite, preserves unrelated labels, and
ignores stale events whose PR head has changed. GitHub Actions updates retain
Dependabot's `DevOps` label.
