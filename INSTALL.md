# NovaNexus one-command installer (development preview)

**Release status:** The Go API, PostgreSQL database, HTTPS reverse proxy and
frontend are packaged together. This is **not** a production-ready collaboration
platform yet: live video, messaging, scheduling, MCP and related integrations
remain unfinished. Do not publish a live instance until release testing passes.

## Why Docker is included

Docker is an **internal runtime** used to isolate and run the PostgreSQL database,
Go backend and Caddy TLS reverse proxy. Users do **not** install, configure or
operate Docker manually. The installer downloads everything needed via apt and
builds/runs the application. The frontend build uses Node only inside the
builder container; users do not install Node or Go on their host.

## One command

On a **fresh supported Ubuntu/Debian server**, download and run a **reviewed,
tested release** of the installer with the following structure (replace the
release tag with a published, validated tag):

```bash
curl -fsSL https://raw.githubusercontent.com/Ceyeberkepp/NovaNexus/RELEASE_TAG/scripts/install.sh | sudo env NOVANEXUS_REF=RELEASE_TAG bash
```

A fresh server must already have a way to download the bootstrap script
(`curl` in the example); **no remote installer can download itself without an
existing network/download facility**. Once the installer starts it automatically
installs missing Git, curl, CA certificates, OpenSSL, Docker Engine and
Docker Compose v2. It then pulls NovaNexus, builds the Go and React app, creates
PostgreSQL credentials and the one-time administrator setup code, and starts
and verifies the complete packaged stack.

For safer operation, download the script separately, inspect it and verify
its release integrity before running it as root. Avoid piping unreviewed
moving-branch code into sudo.

## Prompts and prerequisites

The installer asks only for the public DNS name and TLS registration email,
unless `NOVANEXUS_DOMAIN` and `NOVANEXUS_TLS_EMAIL` are already supplied.
It requires Ubuntu or Debian, an x86_64 or ARM64 host, systemd, root privileges,
outbound network access, a public DNS name resolving to the host, and inbound
TCP 80/443 to issue a publicly trusted certificate. It refuses to overwrite an
existing `/opt/novanexus` installation. If installation or HTTPS verification
fails, it exits with an error; it **does not** report the app as ready.

No manual PostgreSQL, Go, Node.js, Nginx, Caddy or Docker commands are needed
for the supported installation path.

## First-time administrator

- Username: `admin`
- Temporary password: `admin`
- Separate high-entropy one-time setup code: printed by the installer and saved
  in root-only `/opt/novanexus/.env`.
- Before the dashboard unlocks, replace the temporary password with a
  different password of at least 16 characters; existing sessions are revoked.
- The known `admin/admin` combination is **rejected without the setup code**.

The temporary credentials are a compatibility convenience, not a replacement
for an audited recovery policy and MFA. Avoid deploying them on the public
internet until the full release security review is complete.

## Verification and troubleshooting

On a successfully installed server:

```bash
sudo docker compose -f /opt/novanexus/docker-compose.yml --project-directory /opt/novanexus ps
```

The installer itself checks `https://YOUR_DOMAIN/api/health` with a valid TLS
certificate. It will not silently downgrade to HTTP. TCP 80 is reserved for
ACME HTTP challenges and HTTPS redirection.

## Known missing functionality

This one-command deployment currently packages only *implemented* components.
It cannot provide working video conferences, persistent chat or calendar,
MCP services, MFA, backups or notifications until those subsystems are
implemented and tested. The current pull request is a development preview,
not a complete production release.
