# NovaNexus

**A unified, self-hosted workspace platform — under active development.**

NovaNexus is being built as a secure, self-hosted environment for teams and administrators. Its planned workspace combines communication, scheduling, account administration, and extensible services in a single interface.

> **Development status:** NovaNexus is **not yet production-ready**. The imported React workspace contains prototype features. Video meetings, persistent messaging, scheduling, MCP services, and various administration functions must be implemented, integrated, and tested before a production launch.

## Project overview

| Area | Current state |
| --- | --- |
| Workspace interface | React UI prototype imported |
| Authentication and permissions | Go / PostgreSQL hardening work is in progress |
| Administrator onboarding | First-login password change implementation is in progress |
| Database | PostgreSQL deployment integration in progress |
| REST API | Go backend implementation and CI work in progress |
| HTTPS | Caddy TLS deployment integration in progress |
| One-command installation | Ubuntu/Debian installer is under development |
| Messaging and channels | Not production-ready |
| Video calls and conferencing | Not production-ready |
| Calendar and scheduling | Not production-ready |
| MCP and extended integrations | Not implemented and verified |
| Audit logging, backup, recovery, and MFA | Release blockers |

**Do not interpret the UI prototype as a fully working service.** The back-end deployment and security work is being reviewed separately.

## Planned architecture

```text
                     HTTPS :443
                         |
                Caddy reverse proxy
                         |
               Go application / API
                    |         |
               React UI   PostgreSQL
```

The backend is being implemented in **Go**. New browser API code is being written in **TypeScript** with strict type checks. The original React interface still contains JSX/JavaScript and is being modernized. No claim is made that programming-language choice alone guarantees security.

## One-command installer

The goal is **one install command**, with the installer automatically preparing all required runtime services. The development installer covers:

1. Confirming a supported Ubuntu/Debian host and architecture.
2. Installing missing tools, Docker Engine, and Docker Compose.
3. Collecting the public domain name and TLS registration email.
4. Pulling the application and building the React frontend and Go API.
5. Creating PostgreSQL and administrator-bootstrap credentials.
6. Starting the database, application, and HTTPS reverse proxy.
7. Checking the HTTPS health endpoint before reporting completion.

Docker is an **implementation detail** of the packaged runtime; users should not need to install its components individually. A public domain with correct DNS and network access is required for publicly trusted HTTPS certificates.

**The installer remains a development preview.** Do not deploy this branch on a production machine or assume a complete collaboration platform merely because its containers start.

Review the implementation and tests in [production-hardening PR #2](https://github.com/Ceyeberkepp/NovaNexus/pull/2). That pull request is separate from the earlier UI import.

## Initial administrator

The work-in-progress installer provisions the requested first-login credentials:

- **Username:** `admin`
- **Temporary password:** `admin`
- **Additional verification:** a unique, randomly generated, installation-specific setup code
- **First-login requirement:** change the temporary password before the workspace dashboard becomes available

The known default credentials must **not** provide unrestricted access. Administrator recovery, MFA, and broader account security still require review before public deployment.

## Development

The imported frontend uses Vite, React, Tailwind CSS, and Lucide. For local frontend-only development on a trusted machine:

```bash
npm install
npm run dev
```

This runs the UI development server; it does **not** automatically deploy the Go API, PostgreSQL, or HTTPS and must **not** be exposed as a production workspace.

The Go API, deployment stack, first-login authentication, and container smoke tests are tracked in [PR #2](https://github.com/Ceyeberkepp/NovaNexus/pull/2). The source files available on `main` may differ until that work is merged.

## Security and source licensing

NovaNexus is intended to be **proprietary**, not an open-source project. Third-party packages retain their own licenses. A proprietary license notice alone does not make a public repository private or prevent people from viewing its source.

Before production deployment:

- Make the GitHub repository **private** if the source must not be publicly accessible.
- Apply branch protection, required checks/reviews, and maintainer MFA.
- Verify login, authorization, secret storage, backups, restoration, updates, and full TLS deployment.
- Complete end-to-end testing for every advertised subsystem.

See the [security and deployment work in PR #2](https://github.com/Ceyeberkepp/NovaNexus/pull/2).

## Roadmap

**Priority 1:** secure Go authentication and database-backed user administration, deployment validation, HTTPS, and the single-command installer.

**Priority 2:** persistent collaboration services, actual conferencing infrastructure, messaging, scheduling, and role-checked APIs.

**Priority 3:** MCP integrations, auditability, monitoring, backup/recovery, and release hardening.

---

**Status:** Active development. **No production release is certified.**
