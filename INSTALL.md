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

## One command: Debian 13 and Ubuntu

On a fresh supported server, **logged in as root**, run this single command:

```bash
apt-get update && apt-get install -y ca-certificates curl && curl -fsSL https://raw.githubusercontent.com/Ceyeberkepp/NovaNexus/main/scripts/install.sh -o /root/novanexus-install.sh && bash /root/novanexus-install.sh
```

The `apt-get` bootstrap is necessary only because no installer can download itself if the operating system has no downloader. The rest is automatic: missing Git and OpenSSL, Docker Engine and Compose from Docker's **official signed APT repository** (not Debian's missing `docker-compose-v2` or `docker-compose-plugin` packages), database, Go service, frontend and Caddy proxy. On Debian, outdated APT metadata can cause `.deb` 404 errors; `apt-get update` refreshes that metadata. Inspect the script and pin to a reviewed release before using a production system.

### IP address HTTPS (default)

The installer detects the server IPv4 address automatically and serves the app at `https://SERVER_IP`. No domain and no certificate email are required. Caddy issues an encrypted IP certificate through a **private local CA**. The installer verifies HTTPS against that CA and exports `/opt/novanexus/novanexus-local-root-ca.crt`. Browsers on other computers will show an untrusted certificate warning until you explicitly trust that CA on each client. Never install that CA on devices you do not manage.

For public-domain HTTPS, set `NOVANEXUS_DOMAIN=your.example.com` and optionally `NOVANEXUS_TLS_EMAIL=you@example.com` when launching the script; public DNS and reachable port 80/443 are required. The installer does not set router port forwarding or DNS records.

This is not yet production-certified. Docker must be permitted by the VM/container host, and no installed software may already own the needed ports.
## Prerequisites and limitations

Ubuntu/Debian x86_64 or ARM64, root privileges, systemd, outbound package and container-registry access, and free TCP ports 80 and 443. The auto-detected IP must be reachable from the browser. On public DNS mode, a public address and certificate email are needed.

A one-command installer cannot override host networking or virtualization restrictions. IP-only mode provides encrypted HTTPS with a **private**, not publicly trusted, CA; user devices require a one-time trust setup to eliminate warnings. The app still has unfinished features and must not be treated as production-ready.

## First-time administrator

- Username: `admin`
- Temporary password: a unique, randomly generated password printed during installation and saved in the root-only `/opt/novanexus/.env`.
- No separate setup code is required or shown in the Web GUI.
- Before the dashboard unlocks, replace the temporary password with a different password of at least 8 characters; existing sessions are revoked.
- The known `admin/admin` combination is not accepted.

The temporary credentials are a compatibility convenience, not a replacement
for an audited recovery policy and MFA. Avoid deploying them on the public
internet until the full release security review is complete.

## Verification and troubleshooting

On a successfully installed server:

```bash
sudo docker compose -f /opt/novanexus/docker-compose.yml --project-directory /opt/novanexus ps
```

The installer prints the **Web GUI** address (`https://SERVER_IP/`) and checks `https://SERVER_IP/api/health` with a valid TLS
certificate. It will not silently downgrade to HTTP. TCP 80 is reserved for
ACME HTTP challenges and HTTPS redirection.

## Known missing functionality

This one-command deployment currently packages only *implemented* components.
It cannot provide working video conferences, persistent chat or calendar,
MCP services, MFA, backups or notifications until those subsystems are
implemented and tested. The current pull request is a development preview,
not a complete production release.
