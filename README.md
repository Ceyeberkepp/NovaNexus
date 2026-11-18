# NovaNexus

**A unified, self-hosted workspace platform — under active development.**

NovaNexus is being built as a secure, self-hosted environment for teams and administrators. Its planned workspace combines communication, scheduling, account administration, and extensible services in a single interface.

> **Development status:** NovaNexus is **not yet production-ready**. The imported React workspace contains prototype features. Direct messaging, personal calendar events, and LiveKit-based video meeting integration now have initial implementations. Group messaging, guest invitations, MFA, MCP, extensive admin functions, and validated high-capacity media deployment remain unfinished.

## Workspace functionality

The original visual design is retained and gradually connected to working APIs:

- **Admin Console:** six original sections (Users, Groups, Security, Meetings, Branding, Logs), plus AI Assistant settings. User create/edit/disable/enable and administrator password resets persist in PostgreSQL. Groups, group membership, audit logs, branded assets, and workspace/meeting/session settings are backed by server APIs.
- **Chat Settings:** original Notifications, Display, Sidebar, Advanced and Calls preferences restored. Browser-specific options are saved locally; chat refresh, time display and recent-activity sorting have working behavior. Email notifications, group read receipts and Markdown formatting are not enabled until their supporting services exist.
- **Video Conference:** LiveKit provides audio, video, screen sharing, chat and participant controls. The Video Settings dialog includes device switching, camera preview, audio processing and video capture preferences; the live meeting toolbar includes local browser screen recording and a copyable invite link. Recording downloads locally (not cloud recording). Breakouts, guest lobby approval, remote control and broadcast egress still require server features.
- **Nexus AI Assistant:** authenticated AI chat through a private Ollama service. The one-click installer prepares a small local starter model (`qwen2.5:0.5b`). No external API key is required. Answers may be inaccurate; the assistant cannot read private messages or modify accounts. Admins may disable the assistant. The model can require additional RAM and download time.

**Important:** These integrations remain development-preview functionality. Real cross-browser media, firewall/NAT, optional large meetings, and security audit must pass before a production deployment.

### Calls workspace — real accounts and call history

The **Calls** sidebar button opens a Teams-inspired calling workspace, retaining NovaNexus's purple branding. The left panel searches only active accounts stored in the workspace database; select a real member and press **Call** or **Video**. The right panel reads real PostgreSQL call records with **All, Missed, Incoming, Outgoing and Voicemail** filters, chronological sorting, and repeat-call shortcuts. Answer/end timestamps and session end actions support call duration reporting for completed calls.

**No sample users, fabricated presence or simulated call history are used in this Calls workspace.** When no calls have occurred, the list is empty. The Voicemail filter explicitly says the service is not configured rather than inventing voicemails. Call forwarding likewise needs a future routing service. Browser microphone preference is saved to the user's chat/video preferences.

### Meeting numbers, direct calls and settings

- **Meeting numbers:** NovaNexus reserves unique random eight-digit numbers in PostgreSQL. Join links have the form \`https://10.5.5.51/12345678\` on local IP installs. The number is a sample; the app generates a new one when starting each meeting.
- **Custom meeting links:** In **Admin → Meetings → Public meeting link domain**, an administrator can select an existing HTTPS origin such as \`https://nexu.cyverax.com\`. Links will then end in \`/12345678\` on that domain. The URL setting does not register DNS, deploy a tunnel, open firewalls or configure TURN/WebRTC media; those must already be working. The video service needs reachable media ports or an appropriate relay.
- **Chat calls:** Calling a member creates a private ringing record and shows Accept / Decline in the recipient's workspace. Both users join automatically after acceptance; declining does not enter a room. Ringing calls expire automatically.
- **Video controls:** The meeting toolbar has a bottom-right **More (three dots)** menu for device settings, link copying, local recording and host-managed breakout rooms. The host can create breakouts, assign members and remove rooms. Assigned members are redirected through authenticated tokens.
- **Recording:** The built-in browser recorder saves a WebM recording of the screen/window selected by the user, when browser permissions allow. Screen audio depends on the browser and the selected capture source; this is not server-side recording, cloud archiving or a recording of every independent feed.
- **Chat appearance:** Chat Settings → Display preserves the original themes and now adds solid, aurora, dots, grid and waves backgrounds.
- **Password reset:** Admin → Users lets an administrator choose and confirm a new password of at least eight characters (no generated password), after confirming the administrator's own password. Previous sessions are revoked and the member must change that password at next sign-in.

### Automatic port fallback and tunnel origins

The one-click installer checks whether TCP port **80** is occupied. If it is, NovaNexus leaves the existing service untouched and automatically chooses an available HTTP host port (normally **8080**, otherwise 8081, 8880, or 18080). HTTPS remains available at `https://SERVER_IP` on port **443**. If **443** is already occupied, the installer stops with a specific explanation instead of claiming that HTTP can replace HTTPS.

Cloudflare and other tunnel clients should use the appliance's **LAN HTTPS origin**. After updating the installation, the installer prints its validated address (for example, `https://192.168.0.52:18081`). The former `http://127.0.0.1:18081` origin was intentionally removed; using that stale URL or pointing a remote connector at a localhost-only listener causes a 502 Bad Gateway. Port 443 also remains available for LAN browsers.

**Cloudflare Zero Trust → Networks → Tunnels → Routes:** edit the published application for `nexus.cyverax.com`. Set **Service** to **HTTPS** and **URL** to the appliance LAN IP and its assigned tunnel port, for example `192.168.0.52:18081` (do not insert `http://` in an HTTPS service field). If the route editor says “Could not find route to edit,” investigate the route/tunnel association or recreate the published application on the correct tunnel; this is a Cloudflare dashboard configuration issue, not something the NovaNexus installer can edit. Ensure the `cloudflared` connector is running and can access the appliance LAN IP/port.

For TLS verification, the internal CA is exported as `/opt/novanexus/novanexus-local-root-ca.crt`. Copy it **to the host running cloudflared** and configure Cloudflare's **CA Pool** to use that file path. With a hostname-based deployment, set **Origin Server Name** as needed to match the certificate SAN; with IP-only deployment, the certificate is issued for the appliance IP. Avoid permanently disabling TLS verification. The HTTPS origin and WebSocket/API requests share the reverse proxy. A successful tunnel web UI still does not prove that LiveKit audio/video UDP media traverses the tunnel.

Run `sudo bash /opt/novanexus/scripts/check-cloudflare-origin.sh` **on the appliance** after installation. It tests the HTTPS origin's certificate and API using the LAN address and the saved port, and prints the exact Cloudflare route settings. If the on-appliance test passes but Cloudflare continues reporting 502, test the same URL and CA **from the cloudflared connector host** and inspect the connector logs and Cloudflare route configuration.

### Real MFA and user identity

The Admin Users screen allows assigning a **username** (3–32 lowercase letters, digits, underscores, or hyphens) as well as name and email. The login screen accepts either the username or email. Users can activate **authenticator-app TOTP** from **Account Security** and receive ten single-use recovery codes; sign-in requires the code after the account password. Keep recovery codes somewhere safe. Administrator password resets do not silently disable MFA.

### Access from both LAN and the internet

The installer now supports **both local-IP HTTPS and an optional public HTTPS hostname** on the same installation. Existing users, meetings, and PostgreSQL volumes are preserved on upgrade. On a default LAN installation, the GUI remains at `https://10.5.5.51/` (replace with your actual server IP). If you supply `NOVANEXUS_PUBLIC_DOMAIN=nexu.cyverax.com` when installing or upgrading, Caddy also serves `https://nexu.cyverax.com/` with automatic publicly trusted TLS, provided the domain's DNS and inbound HTTP/HTTPS work.

The app prefers the configured external hostname when generating shareable meeting URLs, such as `https://nexu.cyverax.com/12345678`. The existing LAN IP address remains an option for internal browsers and administrators. If no public hostname is configured, links use the host you are browsing.

**Required router/firewall ingress for direct self-hosting:** TCP **80** (ACME/redirect), TCP **443** (GUI, auth API and secure WebSockets), UDP **7882** and TCP **7881** (WebRTC media), and UDP **3478** (LiveKit's authenticated TURN/UDP fallback). Media ports bypass the HTTP proxy. Do **not** expose PostgreSQL, Ollama or the internal Go/LiveKit API ports (5432, 11434, 3000 or 7880).

The installer can install and configure the services and validate local HTTPS, but **cannot create a DNS record, bypass carrier-grade NAT, automatically reconfigure an upstream router, or verify external clients from inside the network**. Confirm the public hostname, port forwarding, and media from a truly external device. An HTTPS-only tunnel is sufficient for the web UI and signaling, **not** WebRTC UDP/TCP media unless an externally reachable media relay or TURN service is separately configured. TURN/TLS on a trusted public media hostname provides wider coverage for restrictive corporate networks but is not bundled/configured by this installer.

If you already have `https://10.5.5.51`, re-running the one-click installer with the public hostname configured upgrades the existing install in place; it does not destroy saved data. Public exposure is **not production-certified** while the dependency-security audit and end-to-end tests remain incomplete.

## One-click installation (Ubuntu / Debian)

> **Development preview — not production-certified.** This installs the implemented Go API, PostgreSQL, React frontend, HTTPS reverse proxy and LiveKit media service; it does not automatically make guest invitations, webinar-scale conferencing, MFA or MCP production-ready. Review the script before running it with administrator privileges.

**One command** on a fresh Debian/Ubuntu server where you are already `root` (works even when `curl` is not installed):

```bash
apt-get update && apt-get install -y ca-certificates curl && curl -fsSL https://raw.githubusercontent.com/Ceyeberkepp/NovaNexus/main/scripts/install.sh -o /root/novanexus-install.sh && bash /root/novanexus-install.sh
```

This single command installs the bootstrap downloader if needed, then launches the installer. The installer automatically installs the remaining packages and configures **Docker's official APT repository** to install Engine, Buildx, Compose, and containerd. It then builds the Go backend and React frontend, starts PostgreSQL, Caddy HTTPS, LiveKit and the private Ollama AI service, and attempts to pull the starter model. **You do not manually configure Docker or the database.** On systems already containing `curl`, you may use only the download-and-run portion. Review the downloaded installer before running untrusted code as root.

**Video meetings:** Authenticated users can start/join rooms using the built-in camera, microphone, screen-sharing and leave controls. Room limits accept **1–1000** participants; this is a configured room limit, **not** a verified claim that a single host can sustain 1000 simultaneous audio/video streams. The installer publishes **7881/TCP**, **7882/UDP**, and **3478/UDP** (authenticated TURN/UDP fallback) for WebRTC media. These ports must be reachable from participants' devices; Docker and Caddy cannot fix an upstream firewall/router. Private-IP HTTPS must be trusted by client browsers for webcam and WebSocket usage. For high-capacity internet rooms you need appropriate SFU scaling, bandwidth engineering, TURN/NAT and real load testing. Guest access is not yet enabled.

**No domain required:** the installer detects the host IPv4 address and configures `https://SERVER_IP` using a private local TLS certificate authority. On other devices the root CA must be trusted to avoid certificate warnings. A public DNS name can be specified with `NOVANEXUS_DOMAIN` if preferred, with a publicly issued TLS certificate subject to DNS and port requirements. It does not automatically create DNS or modify upstream router/firewall settings.

**Note:** A container or VM must permit Docker and port 443; host-level restrictions cannot be bypassed by an installer. An existing installation is not overwritten.

For details see [INSTALL.md](INSTALL.md). **This is a development preview, not a production-certified installer.**
**Web GUI:** the installer prints `NovaNexus Web GUI: https://SERVER_IP/` at completion. **First login:** username `admin` with a unique randomly generated temporary password printed at installation (no setup code). You must change the password before opening the dashboard. The current bootstrap password is saved in the root-only `/opt/novanexus/.env`.

For installation details, supported environments and known blockers see [INSTALL.md](INSTALL.md). **Never use this development-preview installer on a production host until deployment and release validation are completed.**

## Project overview

| Area | Current state |
| --- | --- |
| Workspace interface | React UI prototype imported |
| Authentication and permissions | Go / PostgreSQL implementation merged; further security testing required |
| Administrator onboarding | Unique initial password with mandatory password change |
| Database | PostgreSQL container bundled with application |
| REST API | Go authentication/user-management API merged; broader APIs remain unimplemented |
| HTTPS | Caddy HTTPS proxy bundled; real-domain certificate test outstanding |
| One-command installation | Installer present on main; full fresh-host test outstanding |
| Messaging and channels | Not production-ready |
| Video calls and conferencing | Not production-ready |
| Calendar and scheduling | Not production-ready |
| MCP and extended integrations | Not implemented and verified |
| Audit logging, backup, recovery, and MFA | Release blockers |

**Do not interpret the UI prototype as a fully working service.** The existing backend and deployment foundation has been merged, but the broader service remains incomplete.

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

The foundational Go/HTTPS installer changes were merged in [production-hardening PR #2](https://github.com/Ceyeberkepp/NovaNexus/pull/2).

## Initial administrator

The development installer provisions the requested first-login credentials:

- **Username:** `admin`
- **Temporary password:** unique random password displayed by the installer (no setup code)
- **First-login requirement:** change the temporary password (minimum 8 characters) before the workspace dashboard becomes available

The known default credentials must **not** provide unrestricted access. Administrator recovery, MFA, and broader account security still require review before public deployment.

## Development

The imported frontend uses Vite, React, Tailwind CSS, and Lucide. For local frontend-only development on a trusted machine:

```bash
npm install
npm run dev
```

This runs the UI development server; it does **not** automatically deploy the Go API, PostgreSQL, or HTTPS and must **not** be exposed as a production workspace.

The Go API, deployment stack, first-login authentication, and container smoke tests were merged through [PR #2](https://github.com/Ceyeberkepp/NovaNexus/pull/2). They are still not a complete production-ready collaboration system.

## Security and source licensing

NovaNexus is intended to be **proprietary**, not an open-source project. Third-party packages retain their own licenses. A proprietary license notice alone does not make a public repository private or prevent people from viewing its source.

Before production deployment:

- Make the GitHub repository **private** if the source must not be publicly accessible.
- Apply branch protection, required checks/reviews, and maintainer MFA.
- Verify login, authorization, secret storage, backups, restoration, updates, and full TLS deployment.
- Complete end-to-end testing for every advertised subsystem.

See the merged [security and deployment work in PR #2](https://github.com/Ceyeberkepp/NovaNexus/pull/2).

## Roadmap

**Priority 1:** secure Go authentication and database-backed user administration, deployment validation, HTTPS, and the single-command installer.

**Priority 2:** persistent collaboration services, actual conferencing infrastructure, messaging, scheduling, and role-checked APIs.

**Priority 3:** MCP integrations, auditability, monitoring, backup/recovery, and release hardening.

---

**Status:** Active development. **No production release is certified.**
