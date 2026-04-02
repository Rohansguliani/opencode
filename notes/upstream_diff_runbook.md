# Upstream Diff Runbook

Use this when you want to review what `origin/dev` has that `rohan/feat/tailscale-local-serve` does not.

## Goal

- compare upstream `dev` against the long-lived fork testing branch
- identify missing features and fixes worth cherry-picking
- separate high-value user-facing work from noise like `generate`, releases, and hash bumps

## Basic Commands

Fetch upstream first:

```bash
git fetch origin dev
```

Count divergence:

```bash
git rev-list --left-right --count rohan/feat/tailscale-local-serve...origin/dev
```

Show commits that are on upstream `dev` but not on the fork testing branch:

```bash
git log --oneline --no-merges rohan/feat/tailscale-local-serve..origin/dev
```

## Filter For Useful Work

Start with likely-signal commit subjects:

```bash
git log --oneline --no-merges \
  --grep='^feat' \
  --grep='^fix' \
  --grep='^app:' \
  --grep='^tui:' \
  --grep='^electron:' \
  --regexp-ignore-case \
  rohan/feat/tailscale-local-serve..origin/dev
```

This usually removes most of the noise from:
- `chore: generate`
- release commits
- nix hash bumps
- docs-only changes

## Inspect A Candidate Commit

Use full stats first:

```bash
git show --stat --summary <commit>
```

If it still looks relevant, inspect the actual patch:

```bash
git show <commit>
```

## How To Evaluate A Missing Commit

Ask these questions:

1. Is it user-visible or reliability-critical?
2. Does it overlap with local custom work on `feat/tailscale-local-serve`?
3. Is it likely to conflict with current local experiments?
4. Does it fix a pain point already seen during testing?
5. Is it dependency/tooling alignment you should probably keep current?

## Good Categories To Use In Writeups

- High-priority to pull in soon
- Nice quality-of-life improvements
- Probably not relevant for this branch
- Risky / likely-conflicting architectural work

## Practical Suggestions

- Prefer small targeted upstream fixes first.
- Be cautious with large architectural commits like sync/service refactors unless you need them.
- For app polish, sidebar/session/navigation fixes are often high value and low risk.
- Toolchain alignment commits like Bun/OpenTUI bumps are useful when local work starts hitting version drift.

## If You Decide To Bring Something In

Cherry-pick onto the local testing branch first:

```bash
git switch feat/tailscale-local-serve
git cherry-pick <commit>
```

Then test with:

```bash
./scripts/rebuild-local.sh
```
