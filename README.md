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

### Meeting numbers, direct calls and settings

- **Meeting numbers:** NovaNexus reserves unique random eight-digit numbers in PostgreSQL. Join links have the form \`https://10.5.5.51/12345678\` on local IP installs. The number is a sample; the app generates a new one when starting each meeting.
- **Custom meeting links:** In **Admin → Meetings → Public meeting link domain**, an administrator can select an existing HTTPS origin such as \`https://nexu.cyverax.com\`. Links will then end in \`/12345678\` on that domain. The URL setting does not register DNS, deploy a tunnel, open firewalls or configure TURN/WebRTC media; those must already be working. The video service needs reachable media ports or an appropriate relay.
- **Chat calls:** Calling a member creates a private ringing record and shows Accept / Decline in the recipient's workspace. Both users join automatically after acceptance; declining does not enter a room. Ringing calls expire automatically.
- **Video controls:** The meeting toolbar has a bottom-right **More (three dots)** menu for device settings, link copying, local recording and host-managed breakout rooms. The host can create breakouts, assign members and remove rooms. Assigned members are redirected through authenticated tokens.
- **Recording:** The built-in browser recorder saves a WebM recording of the screen/window selected by the user, when browser permissions allow. Screen audio depends on the browser and the selected capture source; this is not server-side recording, cloud archiving or a recording of every independent feed.
- **Chat appearance:** Chat Settings → Display preserves the original themes and now adds solid, aurora, dots, grid and waves backgrounds.
- **Password reset:** Admin → Users lets an administrator choose and confirm a new password of at least eight characters (no generated password), after confirming the administrator's own password. Previous sessions are revoked and the member must change that password at next sign-in.

## One-click installation (Ubuntu / Debian)

> **Development preview — not production-certified.** This installs the implemented Go API, PostgreSQL, React frontend, HTTPS reverse proxy and LiveKit media service; it does not automatically make guest invitations, webinar-scale conferencing, MFA or MCP production-ready. Review the script before running it with administrator privileges.

**One command** on a fresh Debian/Ubuntu server where you are already `root` (works even when `curl` is not installed):

```bash
apt-get update && apt-get install -y ca-certificates curl && curl -fsSL https://raw.githubusercontent.com/Ceyeberkepp/NovaNexus/main/scripts/install.sh -o /root/novanexus-install.sh && bash /root/novanexus-install.sh
```

This single command installs the bootstrap downloader if needed, then launches the installer. The installer automatically installs the remaining packages and configures **Docker's official APT repository** to install Engine, Buildx, Compose, and containerd. It then builds the Go backend and React frontend, starts PostgreSQL, Caddy HTTPS, LiveKit and the private Ollama AI service, and attempts to pull the starter model. **You do not manually configure Docker or the database.** On systems already containing `curl`, you may use only the download-and-run portion. Review the downloaded installer before running untrusted code as root.

**Video meetings:** Authenticated users can start/join rooms using the built-in camera, microphone, screen-sharing and leave controls. Room limits accept **1–1000** participants; this is a configured room limit, **not** a verified claim that a single host can sustain 1000 simultaneous audio/video streams. The installer publishes **7881/TCP** and **7882/UDP** for WebRTC media. These ports must be reachable from participants' devices; Docker and Caddy cannot fix an upstream firewall/router. Private-IP HTTPS must be trusted by client browsers for webcam and WebSocket usage. For high-capacity internet rooms you need appropriate SFU scaling, bandwidth engineering, TURN/NAT and real load testing. Guest access is not yet enabled.

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
