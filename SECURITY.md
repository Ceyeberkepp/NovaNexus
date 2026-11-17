# NovaNexus security policy

## Status
This is an experimental development branch, **not yet a production release**.

Do not expose the current imported collaboration features as live systems.
The video, messaging, scheduling and MCP integration subsystems have not been
implemented or end-to-end validated.

## Reporting
Report privately to repository maintainers through GitHub's security
advisory feature where available. Do not post secrets or exploitation
instructions in public issues.

## Required release controls
- Make the GitHub repository **private** if the source must not be publicly
  readable. LICENSE and CODEOWNERS do not make a public repository private.
- Configure rulesets/branch protection on main: required reviews, required
  passing CI, no direct pushes, and restrict administrative bypass.
- Require MFA for maintainers and rotate any leaked secrets.
- Scan dependencies and images; monitor security alerts and review SBOMs.
- Store credentials in a secrets manager and avoid committing .env files.
- Back up PostgreSQL and verify restores; document monitoring and incident
  response before production.
- Use a publicly resolvable DNS name and verified TLS for internet-facing
  deployment; the reverse proxy uses port 80 for ACME validation and HTTPS
  redirection.
- Rotate the initial admin credential before exposing the dashboard.
- Never claim unavailable video, messaging, calendar, MCP, or other services
  are supported simply because containers can start.
