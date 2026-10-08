-- Review and apply before setting EXPO_PUBLIC_TRACK_PARTITIONS=true.
-- v1 rows remain frozen recovery copies after a log first migrates.
create table public.track_document_partitions (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (document_key in ('kinevault-track.food-log.v1', 'kinevault-track.exercise.v1')),
  part_key text not null,
  payload text not null check (jsonb_typeof(payload::jsonb) = 'object'),
  revision bigint not null check (revision > 0 and revision <= 9007199254740991),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key, part_key),
  constraint track_partition_allowed_part check (
    part_key = 'manifest' or part_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or document_key = 'kinevault-track.exercise.v1' and part_key = 'library'
  )
);
alter table public.track_document_partitions enable row level security;
revoke all on public.track_document_partitions from public, anon, authenticated;
grant select, insert, update, delete on public.track_document_partitions to authenticated;
grant all on public.track_document_partitions to service_role;
create policy track_partitions_read_own on public.track_document_partitions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy track_partitions_insert_own on public.track_document_partitions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy track_partitions_update_own on public.track_document_partitions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy track_partitions_delete_own on public.track_document_partitions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- A single SELECT provides one snapshot, including its manifest and changed
-- fragments. Returning a JSON array avoids PostgREST's maximum row count
-- truncating a first download with many historical months.
create function public.list_track_partitioned_documents(p_user_id uuid, p_known_revisions jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(partition) order by document_key, part_key), '[]'::jsonb)
  from public.track_document_partitions as partition
  where user_id = p_user_id and p_user_id = (select auth.uid())
    and (part_key = 'manifest' or revision > coalesce((p_known_revisions ->> document_key)::bigint, 0));
$$;
revoke execute on function public.list_track_partitioned_documents(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.list_track_partitioned_documents(uuid, jsonb) to authenticated;

-- One aggregate revision preserves existing explicit conflict behavior and
-- atomically commits month moves, deletion, library changes, and active timers.
create function public.save_track_partitioned_document(
  p_user_id uuid, p_document_key text, p_expected_revision bigint,
  p_deleted boolean, p_parts text[], p_changes jsonb
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  current_revision bigint;
  next_revision bigint;
  saved_at timestamptz := now();
  fragment record;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Account changed before history save' using errcode = '42501';
  end if;
  if p_document_key is null or p_document_key not in ('kinevault-track.food-log.v1', 'kinevault-track.exercise.v1')
    or p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991
    or p_deleted is null or p_parts is null or p_changes is null or jsonb_typeof(p_changes) <> 'object'
    or cardinality(p_parts) <> (select count(distinct part) from unnest(p_parts) as part)
    or exists (select 1 from unnest(p_parts) as part where part is null or not (
      part ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or part = 'library' and p_document_key = 'kinevault-track.exercise.v1'))
    or p_deleted and (cardinality(p_parts) <> 0 or p_changes <> '{}'::jsonb)
    or not p_deleted and p_document_key = 'kinevault-track.exercise.v1' and not ('library' = any(p_parts))
    or exists (select 1 from jsonb_each(p_changes) as change where not (change.key = any(p_parts)) or jsonb_typeof(change.value) <> 'string') then
    raise exception 'Invalid history change' using errcode = '22023';
  end if;
  -- Serialize legacy and partitioned writers, including creation when no row
  -- exists yet. A hash collision only serializes unrelated saves harmlessly.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || '/' || p_document_key, 0));
  select revision into current_revision from public.track_document_partitions
    where user_id = p_user_id and document_key = p_document_key and part_key = 'manifest';
  if current_revision is null then
    select revision into current_revision from public.track_documents
      where user_id = p_user_id and document_key = p_document_key;
  end if;
  if coalesce(current_revision, 0) <> p_expected_revision then return null; end if;
  next_revision := p_expected_revision + 1;
  for fragment in select key, value #>> '{}' as payload from jsonb_each(p_changes) loop
    insert into public.track_document_partitions(user_id, document_key, part_key, payload, revision, updated_at)
      values (p_user_id, p_document_key, fragment.key, fragment.payload, next_revision, saved_at)
      on conflict (user_id, document_key, part_key) do update
        set payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at;
  end loop;
  if exists (select 1 from unnest(p_parts) as required where not exists (
    select 1 from public.track_document_partitions where user_id = p_user_id and document_key = p_document_key and part_key = required)) then
    raise exception 'Missing history fragment' using errcode = '22023';
  end if;
  delete from public.track_document_partitions where user_id = p_user_id and document_key = p_document_key
    and part_key <> 'manifest' and not (part_key = any(p_parts));
  insert into public.track_document_partitions(user_id, document_key, part_key, payload, revision, updated_at)
    values (p_user_id, p_document_key, 'manifest', jsonb_build_object('version', 2, 'deleted', p_deleted, 'parts', to_jsonb(p_parts))::text, next_revision, saved_at)
    on conflict (user_id, document_key, part_key) do update
      set payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at;
  return jsonb_build_object('revision', next_revision, 'updated_at', saved_at);
end;
$$;
revoke execute on function public.save_track_partitioned_document(uuid, text, bigint, boolean, text[], jsonb) from public, anon, authenticated;
grant execute on function public.save_track_partitioned_document(uuid, text, bigint, boolean, text[], jsonb) to authenticated;

-- Guard direct legacy table writes too. Older builds retain pending edits on
-- their device, and must upgrade before they can resolve and upload them.
create function private.guard_migrated_track_history()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.document_key in ('kinevault-track.food-log.v1', 'kinevault-track.exercise.v1') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || '/' || new.document_key, 0));
    if exists (select 1 from public.track_document_partitions where user_id = new.user_id
      and document_key = new.document_key and part_key = 'manifest') then
      raise exception 'This history uses monthly storage. Upgrade the app to sync pending edits.' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_migrated_track_history() from public, anon, authenticated;
create trigger guard_migrated_track_history before insert or update on public.track_documents
  for each row execute function private.guard_migrated_track_history();
