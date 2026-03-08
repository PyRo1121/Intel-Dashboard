# Contributing

## Branching

- `main` is the protected integration branch.
- Do not push directly to `main` during normal development.
- Use one of these branch prefixes:
  - `codex/`
  - `feature/`
  - `fix/`
  - `chore/`
  - `docs/`
  - `refactor/`
  - `hotfix/`
  - `dependabot/`
  - `renovate/`

## Pull Requests

- Open pull requests against `main`.
- Keep PRs focused on one concern.
- Include a short summary, validation notes, and any release or migration impact.
- Required merge gates:
  - `validate`
  - `enforce-pr-policy`

## Local Validation

```bash
bun run check:repo-hygiene
bun run typecheck
bun run test
```

Use these additional gates when relevant:

```bash
bun run test:e2e
bun run test:all
```

## Review Policy

- `CodeRabbit` is the primary automatic AI reviewer.
- `cubic` is the selective deeper reviewer for higher-risk changes.
- `Codex` is manual and can be triggered with `@codex review`.
- `Sourcery` is optional and should not be treated as a merge requirement.

See [docs/review-bots.md](docs/review-bots.md) for the detailed review-bot policy.
