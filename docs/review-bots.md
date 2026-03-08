# Review Bot Policy

## Default Roles

- `CodeRabbit`: primary automatic AI reviewer for normal pull requests
- `cubic`: selective deeper reviewer with repository-specific Cloudflare guidance
- `Codex`: manual/interactive second opinion only
- `Sourcery`: optional extra reviewer if you intentionally keep the app installed

## Why This Repo Does Not Run a Separate Codex Review Workflow

Codex already supports GitHub code review through the installed GitHub integration. Running a second Codex workflow in GitHub Actions would duplicate comments, add secret management, and increase review noise.

For this repository:

- use the GitHub-integrated Codex reviewer for normal review behavior
- use `@codex review` when you want an explicit rerun or a targeted manual review
- do not add a second Codex Action unless you intentionally want a fully custom self-hosted review pipeline

If you later want a custom Codex Actions pipeline, use the official OpenAI cookbook example as the starting point and treat it as a separate review lane, not a duplicate of the GitHub app.

## Manual Triggers

- `@coderabbitai review`
- `@cubic-dev-ai review this PR`
- `@codex review`
- `@sourcery-ai review` only if Sourcery is intentionally kept active

## Merge Policy

- AI review bots are advisory
- human approval is required
- `CI / validate` is required
- `PR Guard / enforce-pr-policy` is required
