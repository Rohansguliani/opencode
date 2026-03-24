# OpenCode Development Workflow

## Creating Clean Pull Requests

Start with `notes/pr_runbook.md` if you need the exact end-to-end sequence.

When developing new features for OpenCode while relying on this ThinkPad's custom remote testing setup, you must separate your feature code from your local environment code.

If you commit both to the same branch, your Pull Request will include your personal Tailscale/environment changes, which should not be merged into the main OpenCode repository.

### The "Parallel Branch" Strategy

We use a "Y-shaped" branching strategy to solve this:

1. **Create the Feature Branch (Clean PR)**
   Branch directly off `origin/dev` (the core OpenCode codebase):
   ```bash
   git checkout -b my-new-feature origin/dev
   ```
   Write your feature code, commit it, and push it to your fork. This is the branch you will use to open your Pull Request.

2. **Cherry-Pick for Local Testing**
   Switch back to your custom local environment branch (e.g., `feat/tailscale-local-serve`):
   ```bash
   git checkout feat/tailscale-local-serve
   ```
   Then, copy (cherry-pick) the feature commit from your clean branch onto your testing branch:
   ```bash
   git cherry-pick <commit-hash-of-feature>
   ```

3. **Test Locally (CRITICAL: RECOMPILE AND RESTART)**
     Now your local environment branch contains BOTH your custom testing setup AND the new feature.

     On this machine, the development Tailscale Funnel points at the unified server on port `5000`, so you **MUST** rebuild the frontend and restart that server.

    Use:
    ```bash
    ./scripts/rebuild-local.sh
    ```

    See `notes/recompiling_local_server.md` and `notes/thinkpadMachine/architecture_truth.md` for details.

```text
          /--- [Tailscale Changes] --- [Feature Code (Copied)]  <-- Local Testing Branch
         /
[origin/dev] 
         \
          \--- [Feature Code (Original)]                        <-- GitHub PR Branch
```

This ensures your Pull Requests remain perfectly clean while still allowing you to test features in your custom environment.

## 4. Submitting the Pull Request (Compliance Rules)

When you are ready to open the PR on GitHub:

1. Read `notes/pr_runbook.md`
2. Read `notes/pull_request_compliance.md`

The `anomalyco/opencode` repository uses strict automated bots that will close your PR within 2 hours if you do not follow their exact Issue and PR templates!
