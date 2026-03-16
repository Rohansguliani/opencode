# OpenCode Development Workflow

## Creating Clean Pull Requests

When developing new features for OpenCode while relying on a custom local testing setup (like Tailscale with Basic Auth), you must separate your feature code from your local environment code.

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
   
   To see your UI changes via Tailscale, you **MUST** compile the frontend to static files and restart the custom backend.
   
   See `notes/recompiling_local_server.md` for the exact build and restart commands!

```text
          /--- [Tailscale Changes] --- [Feature Code (Copied)]  <-- Local Testing Branch
         /
[origin/dev] 
         \
          \--- [Feature Code (Original)]                        <-- GitHub PR Branch
```

This ensures your Pull Requests remain perfectly clean while still allowing you to test features in your custom environment.

## 4. Submitting the Pull Request (Compliance Rules)

When you are ready to open the PR on GitHub, **you must read and follow `notes/pull_request_compliance.md`**.

The `anomalyco/opencode` repository uses strict automated bots that will close your PR within 2 hours if you do not follow their exact Issue and PR templates!