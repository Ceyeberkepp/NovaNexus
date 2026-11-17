# NovaNexus deployment — development preview

The install entrypoint is `scripts/install.sh` (Ubuntu/Debian, amd64/arm64).
It installs Git, curl, Docker Engine, Docker Compose v2 and OpenSSL, clones a
selected source ref, builds the React frontend + Go API, initializes a PostgreSQL
database and starts a Caddy HTTPS reverse proxy.

**Do not run this preview on production hosts yet:** no end-to-end deployment
test, firewall audit, migrations/backup validation or external HTTPS check
has passed in this environment.

## Prerequisites

- Dedicated Ubuntu/Debian server with root/sudo access
- Public FQDN resolving to its public IP, external ports TCP 80 and 443
- Enough RAM, disk and CPU for Go compilation, Node compilation, Postgres
  and containers; a small machine may need swap
- No existing application on ports 80 and 443
- Keep the target host and its outbound internet supply-chain path trusted

## Review first, then install a tested release

Choose an audited tag or SHA (not a moving branch) for deployment. Download,
inspect and checksum the installer; do not blindly pipe network content
to root. The installer currently requires a branch/tag and rejects an existing
/opt/novanexus folder.

Example after obtaining and reviewing a local copy of the script:

```bash
sudo env NOVANEXUS_DOMAIN=nexus.example.com \
  NOVANEXUS_TLS_EMAIL=you@example.com \
  NOVANEXUS_REF=YOUR_TESTED_TAG \
  bash ./scripts/install.sh
```

The installer creates a random database password and a random 24-byte setup
secret, writes a root-readable-only `.env`, and checks the public HTTPS
health endpoint. It fails if certificate issuance / reachability is not
confirmed.

## First login

- Username: `admin`
- Temporary password: `admin`
- Setup code: printed once by the installer and saved in the root-only
  deployment `.env` file as `BOOTSTRAP_SETUP_CODE`
- On first login, change the password to a different secret of 16+
  characters. Existing sessions are revoked.
- The known temporary password **cannot** authenticate without the
  separately generated random installation secret.

This is a compatibility bootstrap flow, not a recommended long-term login
mechanism. Configure MFA, secret rotation and recovery before public release.

## Logs

```bash
cd /opt/novanexus
sudo docker compose ps
sudo docker compose logs --tail=100 app https db
```

## Known blockers

The user interface still includes unconnected prototype elements. Video
calls, message delivery, persistent scheduling, profile updates, true
activity auditing, MCP server tooling and disaster recovery procedures
remain unimplemented or unverified. An installation is not equivalent
to a completed collaboration platform.
