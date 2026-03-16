# OpenCode Pull Request Compliance Rules

The `anomalyco/opencode` repository has strict, bot-enforced rules for submitting Pull Requests. **If you do not follow these rules exactly, the `github-actions` bot will flag the PR and automatically close it within 2 hours.**

Future Agents: Read this carefully before running `gh pr create`!

## 1. Issue First Policy (CRITICAL)
**ALL PRs must reference an existing issue.** You cannot just open a PR.
- Before opening a PR, use the `gh issue create` command to create an issue.
- You MUST use one of their issue templates located in `.github/ISSUE_TEMPLATE/` (e.g., `feature-request.yml` or `bug-report.yml`).
- Link the issue in the PR body using `Closes #<issue_number>` or `Fixes #<issue_number>`.

## 2. You MUST use the PR Template
You cannot write a free-form PR description. You must strictly adhere to the headers and checkboxes in `.github/pull_request_template.md`. 
- Ensure you literally copy the template headers (e.g., `### Type of change`, `### What does this PR do?`, `### Checklist`).
- Actually check the markdown boxes like `- [x] Bug fix` or `- [x] I have tested my changes locally`.

## 3. No AI-Generated Walls of Text
The maintainers explicitly denounce "AI-generated walls of text". 
- Keep the description extremely concise and human-sounding.
- Bullet points are fine, but do not write 5 paragraphs of filler explaining the code step-by-step. Keep it to the "what" and "why".

## 4. Conventional Commit Titles
PR titles must follow conventional commit standards:
- `feat(app): <description>`
- `fix(desktop): <description>`
- `chore(opencode): <description>`
- `docs: <description>`

## 5. UI Changes Require Proof
If the PR involves UI changes, the maintainers require a screenshot or screen recording.
- Since you (the agent) cannot easily attach screen recordings, **always leave a bold note in the PR body** asking the user (e.g., `@Rohansguliani`) to attach a screen recording to satisfy this rule!

## Summary Workflow for PR Creation
1. `cat .github/ISSUE_TEMPLATE/...` -> Find the right template.
2. `gh issue create ...` -> Create the issue and get the Issue Number.
3. `cat .github/pull_request_template.md` -> Read the PR template.
4. Draft the PR body matching the template exactly, referencing `Closes #123`.
5. `gh pr create ...` -> Submit the compliant PR.
