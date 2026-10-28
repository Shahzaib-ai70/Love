# Love Memories

A romantic React + Vite website with:

- intro page with live heart name preview
- separate pages for home, memories, messages, and heart maker
- 100+ love messages
- hidden separate admin route
- browser-local memories now prepared for Supabase cloud saving
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

## Permanent Memories

To switch the `Memories` page from browser-local mode to permanent, per-account cloud mode, follow `SUPABASE_SETUP.md` and copy `.env.example` to `.env`. Existing browser-only memories can be imported from the original device after cloud setup.

## Admin

Cloud admin URL: `/love-vault-admin-2026` on your deployed site. Configure the authorized admin account and deploy its Supabase Edge Function as described in `SUPABASE_SETUP.md`.
