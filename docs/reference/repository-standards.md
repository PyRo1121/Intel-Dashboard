# Repository Standards

## Root surface

The repository root should stay limited to:

- primary maintainer files: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`
- code and package roots: `apps/`, `packages/`, `scripts/`, `e2e/`, `docs/`
- repo metadata: `.github/`, `.gitignore`, `.gitattributes`, `.editorconfig`
- dependency/runtime manifests

Operational reports, plans, architecture notes, and checklists belong in `docs/`.

## Documentation layout

- `docs/architecture/` for runtime architecture and service boundaries
- `docs/operations/` for runbooks, hardening notes, benchmarks, and checklists
- `docs/reference/` for workspace and repository conventions
- `docs/plans/` for dated design and implementation plans

## Review and ownership

- `CODEOWNERS` defines the default review owner
- AI review bots are advisory only
- CI and PR guard are the authoritative merge checks

## Public repository expectations

- no secrets in tracked files
- no generated local build output tracked
- no local filesystem paths in docs
- no root-level scratch notes or temporary reports
