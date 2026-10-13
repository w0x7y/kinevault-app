-- Transactional assertions for the demo catalog; run by scripts/validate-demo-catalog-postgres.sh.
begin;
do $$
begin
  if not has_table_privilege('anon', 'public.catalog_exercises', 'SELECT') then
    raise exception 'Anonymous read grant absent';
  end if;
  if not has_table_privilege('authenticated', 'public.catalog_exercises', 'SELECT') then
    raise exception 'Authenticated read grant absent';
  end if;
  if has_table_privilege('anon', 'public.catalog_exercises', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Anonymous write grant leaked';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_exercises', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Authenticated write grant leaked';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.catalog_exercises'::regclass) then
    raise exception 'Row level security disabled';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'exercise-demos' and public and file_size_limit = 10485760
      and allowed_mime_types = array['video/mp4', 'image/webp']
  ) then
    raise exception 'Demo bucket misconfigured';
  end if;
  -- Object writes must be stopped by RLS, not by a missing grant in the stand-in.
  if not has_table_privilege('anon', 'storage.objects', 'INSERT')
    or not has_table_privilege('authenticated', 'storage.objects', 'INSERT') then
    raise exception 'Storage object grants missing from the test setup';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'Storage object row level security disabled';
  end if;
end;
$$;

insert into public.catalog_exercises (id, slug, name, aliases, status, video_path, poster_path, credit) values
  ('3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192', 'dumbbell-shoulder-press', 'Dumbbell shoulder press',
   '{DB overhead press}', 'published',
   '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/0123456789abcdef.mp4',
   '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/fedcba9876543210.webp', 'Demonstration: KineVault.'),
  ('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', 'cable-lateral-raise', 'Cable lateral raise', '{}',
   'withdrawn', null, null, 'Demonstration: KineVault.');

do $$
begin
  begin
    insert into public.catalog_exercises (id, slug, name, status, credit)
    values ('11111111-2222-4333-8444-555555555555', 'no-media', 'No media', 'published', 'Credit');
    raise exception 'Published row without media accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.catalog_exercises (id, slug, name, status, video_path, poster_path, credit)
    values ('11111111-2222-4333-8444-555555555555', 'foreign-media', 'Foreign media', 'published',
      '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/0123456789abcdef.mp4',
      '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/fedcba9876543210.webp', 'Credit');
    raise exception 'Media under another exercise accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.catalog_exercises (id, slug, name, status, credit)
    values ('11111111-2222-4333-8444-555555555555', 'Bad Slug', 'Bad slug', 'withdrawn', 'Credit');
    raise exception 'Invalid slug accepted';
  exception when check_violation then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.catalog_exercises) <> 2 then
    raise exception 'Anonymous readers cannot see the catalog';
  end if;
  begin
    update public.catalog_exercises set name = 'Changed';
    raise exception 'Anonymous update accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
    values ('exercise-demos', '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/0123456789abcdef.mp4');
    raise exception 'Anonymous object write accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
do $$
begin
  if (select count(*) from public.catalog_exercises) <> 2 then
    raise exception 'Signed-in readers cannot see the catalog';
  end if;
  begin
    delete from public.catalog_exercises;
    raise exception 'Authenticated delete accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
    values ('exercise-demos', '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/0123456789abcdef.mp4');
    raise exception 'Authenticated object write accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
