# Debugging Pull Request Checks

When a Pull Request is opened, GitHub Actions will automatically run a suite of tests (E2E tests, typechecks, linters, etc.). If a check fails, you must investigate the logs to identify and fix the issue.

As an agent, you can debug these failures entirely from the terminal using the GitHub CLI (`gh`).

## Step 1: Check the Status of the PR

Run the following command to see all checks for a specific PR and their status:

```bash
gh pr checks <pr-number>
```

**Output Example:**
```text
e2e (linux)            fail    6m19s   https://github.com/anomalyco/opencode/actions/runs/23256613501/job/67614058610
typecheck              pass    40s     https://github.com/anomalyco/opencode/actions/runs/23256613541/job/67613253462
```

Identify which check failed. In this example, `e2e (linux)` failed.

## Step 2: Extract the Run ID

Look at the URL provided in the output for the failed check. You need the **Run ID**, which is the number immediately following `/runs/`.

In `https://github.com/anomalyco/opencode/actions/runs/23256613501/job/67614058610`, the Run ID is **`23256613501`**.

## Step 3: View the Failed Logs

Use the `gh run view` command with the `--log-failed` flag to dump the logs for the specific failed run.

```bash
gh run view <Run-ID> --log-failed
```

Example:
```bash
gh run view 23256613501 --log-failed
```

## Step 4: Analyze the Logs

The output might be very long. You can pipe it into `grep` to find specific errors, or just read the tail end of the output which usually contains the test summary.

```bash
gh run view <Run-ID> --log-failed | grep -i "Error" -B 5 -A 20
```

### Common Failures in OpenCode:
1. **Typecheck Failures (`bun run typecheck`)**: Usually caused by missing props in SolidJS components or incorrect Drizzle schemas. Look for `error TS...`.
2. **E2E Test Failures (Playwright)**: Usually caused by UI changes that break test selectors (e.g., stopping click propagation on a link, or changing a button's `aria-label`). Look for `Error: locator.click: Timeout...` or `expect(locator).toHaveURL(...) failed`.

## Step 5: Fix and Push

1. Checkout the clean PR branch (`git checkout feat/your-pr-branch`).
2. Fix the code.
3. Commit and push (`git commit -m "fix: resolve E2E failure" && git push`).
4. Switch back to your local testing branch (`git checkout feat/tailscale-local-serve`).
5. Cherry-pick the fix (`git cherry-pick <hash>`).
6. Rebuild and restart the local backend to verify.
