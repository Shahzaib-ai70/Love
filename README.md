# Love Memories

A romantic React + Vite website with:

- intro page with live heart name preview
- separate pages for home, memories, messages, and heart maker
- 100+ love messages
- private memory accounts stored in the SQL API database
- username-based partner invitations and private one-to-one chat
- a hidden admin panel for account details, saved memories, attachments, and partner chats
- VPS deployment guide for Nginx

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

See `DEPLOY_VPS.md`.

## Memory accounts and partner chat

Accounts and saved memories are stored in the SQL database used by the API. Partners can
invite each other by username; chat is enabled only after the recipient accepts. The API
must be running and its database must be persistent for accounts, memories, and chats to
work across devices. Existing browser-only memories can be imported from the original device.

## Admin

The admin panel is at `/love-vault-admin-2026` on your deployed site. Set `ADMIN_USER_ID`
in the API environment to the UUID of the authorized account. The admin can view all
account and partner details, saved memory content and attachments, and chat messages.
Passwords and session credentials are never exposed. See `DEPLOY_VPS.md` for deployment
configuration.
