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

To switch the `Memories` page from browser-local mode to permanent cloud mode, follow `SUPABASE_SETUP.md` and copy `.env.example` to `.env`.
