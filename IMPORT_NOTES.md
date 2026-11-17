# NovaNexus workspace import

This branch imports the original user-supplied single-file React UI as `src/App.jsx`, with Vite, React, Lucide and Tailwind CSS scaffolding.

## Local commands

```bash
npm install
npm run dev
npm run build
```

## Not yet production-ready

- `MOCK_*` arrays contain static sample users, meetings, policies, and audit events.
- The login form currently creates a demo administrator without verifying a password; **do not expose this branch as a live authenticated service**.
- Video participants and various messaging/calendar/admin actions are simulated or local-only. Real meeting signaling, secure authentication, authorization and backend persistence need implementation.
- Review UI behavior and run a successful build before merging. The import preserves the supplied code rather than claiming these features are complete.
