-- KineVault exercise demonstrations, mirrored from the owner's local KineVault
-- stack by scripts/publish-catalog.mjs. Published demos are public; only the
-- service role writes rows or objects.
create table public.catalog_exercises (
  id uuid primary key,
  slug text not null unique
    check (char_length(slug) <= 200 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) <= 400 and btrim(name) <> ''),
  aliases text[] not null default '{}'
    check (cardinality(aliases) <= 50 and array_position(aliases, null) is null),
  muscle_group text not null default '' check (char_length(muscle_group) <= 400),
  equipment text not null default '' check (char_length(equipment) <= 400),
  status text not null check (status in ('published', 'withdrawn')),
  video_path text check (video_path ~ '^[0-9a-f-]{36}/[0-9a-f]{16}\.mp4$'),
  poster_path text check (poster_path ~ '^[0-9a-f-]{36}/[0-9a-f]{16}\.webp$'),
  credit text not null check (char_length(credit) between 1 and 1000),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint catalog_exercises_media_owner check (
    (video_path is null or starts_with(video_path, id::text || '/'))
    and (poster_path is null or starts_with(poster_path, id::text || '/'))),
  constraint catalog_exercises_published_media check (
    status <> 'published' or (video_path is not null and poster_path is not null))
);

alter table public.catalog_exercises enable row level security;
-- Do not rely on project-dependent default Data API grants.
revoke all on public.catalog_exercises from public, anon, authenticated;
grant select on public.catalog_exercises to anon, authenticated;
grant all on public.catalog_exercises to service_role;
create policy catalog_exercises_read on public.catalog_exercises
  for select to anon, authenticated using (true);

-- Public bucket: objects are served from /storage/v1/object/public without
-- signing. No storage.objects policies are added, so clients cannot write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-demos', 'exercise-demos', true, 10485760, array['video/mp4', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
