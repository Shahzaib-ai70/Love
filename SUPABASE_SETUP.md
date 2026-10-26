# Supabase Setup

Use this file to turn the `Memories` page from browser-local mode into permanent cloud storage.

## 1. Install env values

Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

After saving `.env`, restart the Vite server.

## 2. Auth settings

In Supabase:

- open `Authentication`
- use `Email` provider
- disable email confirmation for this project if you want instant signup from the website

This project turns usernames into hidden auth emails like `username@love-memories.app`.

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
  created_at timestamptz not null default timezone('utc', now())
);

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

Create a public storage bucket named `memory-media`, then run:

```sql
insert into storage.buckets (id, name, public)
values ('memory-media', 'memory-media', true)
on conflict (id) do nothing;

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
create policy "memory_media_read_public"
on storage.objects
for select
to public
using (bucket_id = 'memory-media');

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

## 5. Important admin note

The website now supports hidden admin routing, but a real secure cloud admin panel that can list all users should be built with:

- a backend API
- or Supabase Edge Functions with admin checks

Do not place a Supabase service role key in the frontend.
