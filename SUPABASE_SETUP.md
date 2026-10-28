# Supabase Setup

Use this file to turn the `Memories` page from browser-local mode into permanent, per-account cloud storage and to enable the secured cloud admin page.

## 1. Install env values

Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

After saving `.env`, restart the Vite server and rebuild/redeploy the site. Until these values are configured, accounts and memories stay in the current browser and will not sync to another device.

## 2. Auth settings

In Supabase:

- open `Authentication`
- use `Email` provider
- disable email confirmation for this project if you want instant signup from the website

This project turns usernames into hidden auth emails like `username@love-memories.app`.
Cloud usernames must contain 3-32 letters, numbers, dots, underscores, or hyphens, and cloud passwords must contain at least 6 characters. Supabase sessions refresh automatically while their refresh token remains valid.

## 3. SQL tables

Run this SQL in the Supabase SQL editor:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.memory_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  text text not null default '',
  media_url text,
  media_path text,
  media_type text not null default 'text',
  media_file_name text,
  source_local_id text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.memory_entries
  add column if not exists source_local_id text;

create unique index if not exists memory_entries_user_source_local_id_key
  on public.memory_entries (user_id, source_local_id)
  where source_local_id is not null;

alter table public.memory_profiles enable row level security;
alter table public.memory_entries enable row level security;

drop policy if exists "profiles_select_own" on public.memory_profiles;
create policy "profiles_select_own"
on public.memory_profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.memory_profiles;
create policy "profiles_insert_own"
on public.memory_profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.memory_profiles;
create policy "profiles_update_own"
on public.memory_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "memories_select_own" on public.memory_entries;
create policy "memories_select_own"
on public.memory_entries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "memories_insert_own" on public.memory_entries;
create policy "memories_insert_own"
on public.memory_entries
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "memories_delete_own" on public.memory_entries;
create policy "memories_delete_own"
on public.memory_entries
for delete
to authenticated
using (auth.uid() = user_id);
```

## 4. Storage bucket

Create a private storage bucket named `memory-media`, then run:

```sql
insert into storage.buckets (id, name, public)
values ('memory-media', 'memory-media', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'memory-media';

drop policy if exists "memory_media_upload_own" on storage.objects;
create policy "memory_media_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'memory-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "memory_media_read_public" on storage.objects;
drop policy if exists "memory_media_read_own" on storage.objects;
create policy "memory_media_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memory-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "memory_media_delete_own" on storage.objects;
create policy "memory_media_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'memory-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

Media uploads in this bucket are private. The app creates short-lived signed URLs after the owner signs in.

## 5. Secure cloud admin

The admin page is available at:

```text
https://your-site-domain/love-vault-admin-2026
```

For local development, use `http://localhost:5173/love-vault-admin-2026`.

The admin page requires both a normal memory account login and an allowlisted Supabase user ID. Deploy the Edge Function from the repository root using the Supabase CLI:

```bash
supabase functions deploy admin-users
supabase secrets set ADMIN_USER_IDS=your-supabase-auth-user-uuid
```

For multiple admins, provide comma-separated user UUIDs. Find the account's UUID in Supabase Dashboard under Authentication > Users. Do not use a username or display name as the allowlist. The endpoint verifies the caller's Supabase session and checks that UUID on the server before using the service role. The admin view shows usernames and memory counts, not passwords or memory contents.

Never put `SUPABASE_SERVICE_ROLE_KEY` in the website's `.env` or frontend code; Supabase supplies it to the Edge Function server-side.

## 6. Move existing browser memories

Browser-local accounts and memories cannot sync automatically because they have never left the original browser. After Supabase is configured and deployed, on the original device:

1. Create a cloud account with the same username (and password if available), or sign in if that username already has a cloud account.
2. Open the Memories page and choose **Import memories from this device**.
3. Sign in with that cloud account on other devices; its imported memories will be available there.

The import matches the local account by username and is safe to retry. Keep access to the original browser until the import completes.
