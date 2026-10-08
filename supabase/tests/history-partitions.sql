-- Standalone transactional assertions; run against a local migrated database.
-- No production data or accounts are changed, because the test rolls back.
begin;
insert into auth.users(id, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', '{}'::jsonb);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

do $$
declare
  owner uuid := '10000000-0000-0000-0000-000000000001';
  history_key text := 'kinevault-track.exercise.v1';
  changes jsonb := jsonb_build_object('library', '{"version":1,"exercises":[],"workouts":[]}',
    '2026-09', '{"version":2,"sessions":[],"order":{}}');
  result jsonb;
begin
  perform public.save_track_document(owner, history_key, '{"version":1,"exercises":[],"workouts":[],"sessions":[]}', 0);
  result := public.save_track_partitioned_document(owner, history_key, 1, false, array['library', '2026-09'], changes);
  if (result ->> 'revision')::bigint <> 2 then raise exception 'Legacy revision was not preserved'; end if;
  if public.save_track_partitioned_document(owner, history_key, 1, false, array['library'], '{}'::jsonb) is not null then
    raise exception 'Stale CAS accepted';
  end if;
  begin
    perform public.save_track_document(owner, history_key, '{}', 1);
    raise exception 'Old client overwrote migrated history';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.track_documents set payload = '{}' where user_id = owner and document_key = history_key;
    raise exception 'Direct legacy write bypassed migration guard';
  exception when object_not_in_prerequisite_state then null;
  end;
  -- A later invalid fragment must roll back an earlier fragment in the batch.
  begin
    perform public.save_track_partitioned_document(owner, history_key, 2, false, array['library', '2026-09', '2026-10'],
      jsonb_build_object('2026-09', '{"version":2,"sessions":["changed"],"order":{}}', '2026-10', '[]'));
    raise exception 'Corrupt fragment was accepted';
  exception when check_violation then null;
  end;
  if (select payload from public.track_document_partitions where user_id = owner and document_key = history_key and part_key = '2026-09')
    <> '{"version":2,"sessions":[],"order":{}}' then raise exception 'Failed transaction partially committed'; end if;
  if jsonb_array_length(public.list_track_partitioned_documents(owner, jsonb_build_object(history_key, 2))) <> 1 then
    raise exception 'Unchanged histories downloaded their fragments again';
  end if;
  result := public.save_track_partitioned_document(owner, history_key, 2, true, array[]::text[], '{}'::jsonb);
  if (result ->> 'revision')::bigint <> 3 then raise exception 'Deletion revision incorrect'; end if;
  if (select count(*) from public.track_document_partitions where user_id = owner and document_key = history_key) <> 1 then
    raise exception 'Deletion retained live fragments';
  end if;
  if public.save_track_partitioned_document(owner, history_key, 2, false, array['library', '2026-09'], changes) is not null then
    raise exception 'Stale save resurrected deleted history';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  if exists(select 1 from public.track_document_partitions) then raise exception 'Another account read private history'; end if;
  if public.list_track_partitioned_documents('10000000-0000-0000-0000-000000000001', '{}') <> '[]'::jsonb then
    raise exception 'RPC exposed another account';
  end if;
  begin
    perform public.save_track_partitioned_document('10000000-0000-0000-0000-000000000001', 'kinevault-track.food-log.v1', 0, false, array[]::text[], '{}');
    raise exception 'RPC wrote into another account';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.track_document_partitions(user_id, document_key, part_key, payload, revision)
      values('10000000-0000-0000-0000-000000000001', 'kinevault-track.food-log.v1', 'manifest', '{}', 1);
    raise exception 'RLS allowed an insert into another account';
  exception when insufficient_privilege then null;
  end;
  update public.track_document_partitions set payload = '{}' where user_id = '10000000-0000-0000-0000-000000000001';
  if found then raise exception 'RLS allowed another account update'; end if;
  delete from public.track_document_partitions where user_id = '10000000-0000-0000-0000-000000000001';
  if found then raise exception 'RLS allowed another account deletion'; end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.track_document_partitions;
    raise exception 'Anonymous history read allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_track_partitioned_documents('10000000-0000-0000-0000-000000000001', '{}');
    raise exception 'Anonymous history RPC allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
