# Security Policy

## Reporting

Do not open public GitHub issues for suspected vulnerabilities, secrets exposure, authentication bypasses, billing flaws, or infrastructure weaknesses.

Report security issues privately to the repository owner through GitHub Security Advisories or a private maintainer channel.

## Scope Priorities

Highest-priority areas for this repository:

- Cloudflare Workers auth and routing
- Durable Objects and service bindings
- billing and entitlement enforcement
- webhook verification
- secret handling and deployment safety
- AI gateway and outbound delivery paths

## Secret Handling

- Never commit secrets, API keys, session cookies, or private certificates.
- Use Wrangler secrets, GitHub Actions secrets, or local ignored env files.
- Example or placeholder files must not contain live values.

## Verification Expectations

- Add or update tests for security-relevant behavior changes.
- Prefer fail-closed behavior over permissive fallback.
- Keep generated runtime types and deployment config in sync with actual bindings.
