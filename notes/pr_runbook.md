# PR Runbook

Use this when you need to turn a tested change on `feat/tailscale-local-serve` into a clean PR.

## Goal

- Keep local environment changes on `feat/tailscale-local-serve`.
- Open PRs from a clean branch based on `origin/dev`.
- Cherry-pick only the focused commit(s) needed for the PR.

## Branch Roles

- `feat/tailscale-local-serve`: long-lived local testing branch
- `origin/dev`: clean upstream base for PR branches
- `rohan/<branch>`: fork branch used for pushing clean PR branches

## Fork Push Targets

- Local tested branch on the fork:
  ```bash
  git push rohan feat/tailscale-local-serve
  ```
- Clean PR branch on the fork:
  ```bash
  git push -u rohan fix/my-branch
  ```

Use `feat/tailscale-local-serve` only for the long-lived non-PR branch. Use a separate clean branch name for every PR.

## Exact Flow

1. On `feat/tailscale-local-serve`, commit the focused feature or fix.
2. Rebuild and test locally with `./scripts/rebuild-local.sh`.
3. Run package-level verification before branching for PRs:
   ```bash
   cd packages/app && bun typecheck
   cd packages/app && bun run build
   cd packages/opencode && bun typecheck
   ```
4. Fetch the latest upstream base:
   ```bash
   git fetch origin dev
   ```
5. Create a clean PR branch from `origin/dev`:
   ```bash
   git switch -c fix/my-branch origin/dev
   ```
6. Cherry-pick only the commit(s) needed for the PR:
   ```bash
   git cherry-pick <commit>
   ```
7. If cherry-pick conflicts, resolve them in favor of the minimal PR diff.
8. Run verification on the clean branch too.
9. Create an issue first in `anomalyco/opencode`.
10. Push the PR branch to the fork:
   ```bash
   git push -u rohan fix/my-branch
   ```
11. Open the PR against `dev` using the upstream PR template.
12. Switch back to `feat/tailscale-local-serve` when done.

## Conflict Rule

If a cherry-pick conflicts with a clean PR branch:

- keep the focused fix
- do not accidentally pull in unrelated local-branch work
- if necessary, copy the minimal final version from `feat/tailscale-local-serve` by hand and continue the cherry-pick

## PR Compliance Checklist

Before `gh pr create`, always do all of these:

- Read `.github/pull_request_template.md`
- Create an upstream issue and reference it with `Closes #<id>`
- Keep the PR body short and human-sounding
- Use a conventional title like `fix(app): ...`
- If the change affects UI, ask `@Rohansguliani` to attach a screenshot or recording

## Issue Creation Format

`gh issue create` is easiest when you manually mirror the template headings in the body.

For bug reports, include:

- `### Description`
- `### Plugins`
- `### OpenCode version`
- `### Steps to reproduce`
- `### Screenshot and/or share link`
- `### Operating System`
- `### Terminal`

## Verification Expectations

Prefer verifying on the clean branch too, not only on the local testing branch.

For machine-specific ingress and port mapping on this ThinkPad, use `notes/thinkpadMachine/architecture_truth.md`.

Common commands:

```bash
cd packages/app && bun typecheck
cd packages/app && bun run build
cd packages/opencode && bun typecheck
```

If the change affects the running UI or backend behavior, rerun:

```bash
./scripts/rebuild-local.sh
```

That step is part of the normal local verification loop on this machine.

## Common Gotchas

- Do not open PRs from `feat/tailscale-local-serve`.
- Do not include local-only files like logs, scratch files, or proxy scripts.
- If push fails because the pre-push hook wants a newer Bun, run:
  ```bash
  bun upgrade
  ```
- If a fix needs local retesting after the clean PR is updated, cherry-pick it back onto `feat/tailscale-local-serve` and rerun `./scripts/rebuild-local.sh`.
