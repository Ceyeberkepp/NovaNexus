# NovaNexus import and modernization status

This repository began as a user-supplied single-file React workspace prototype.
The import is now being modernized behind the **draft** production hardening PR.

## Implementation introduced on the hardening branch
- Go API with PostgreSQL, Argon2id password hashing, HTTP-only sessions,
  account role enforcement, and mandatory first-admin password rotation.
- A strictly typed TypeScript browser API client. The original large React
  interface remains JSX and needs a strict TypeScript migration and UI audit.
- Docker image, Caddy TLS reverse proxy, PostgreSQL Compose stack,
  and guarded Ubuntu/Debian install script.
- CI build, authentication integration tests, container smoke tests,
  CodeQL scans, Dependabot and proprietary policy documents.

## What remains blocked
- Real multi-party media signaling and TURN/STUN transport.
- Persistent messaging, channels, scheduling, notifications and audits.
- MCP protocol server, authenticated MCP tooling, and third-party integrations.
- Application-level MFA, invitation/registration policy, password recovery.
- Backup/restore drills, migration versioning, container image provenance,
  firewall validation, and tested one-click installation on supported hosts.
- Source privacy and enforceable GitHub branch protection must be set by a
  repository owner. The repository is still public.

Passing the API smoke test is **not** equivalent to production readiness.
Do not deploy this app as a functioning collaboration system until all
required release gates are verified.
