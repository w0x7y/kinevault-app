-- Additional real-role assertions; synthetic fixtures and changes roll back.
begin;
do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.list_track_partitioned_documents(uuid,jsonb)',
    'public.save_track_partitioned_document(uuid,text,bigint,boolean,text[],jsonb)'
  ] loop
    if has_function_privilege('anon', signature, 'EXECUTE') then
      raise exception 'Anonymous RPC grant leaked';
    end if;
    if not has_function_privilege('authenticated', signature, 'EXECUTE') then
      raise exception 'Authenticated RPC grant absent';
    end if;
    if (select prosecdef from pg_proc where oid = signature::regprocedure) then
      raise exception 'History RPC unexpectedly bypasses caller privileges';
    end if;
  end loop;
  if has_table_privilege('anon', 'public.track_document_partitions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Anonymous partition grant leaked';
  end if;
  if has_table_privilege('authenticated', 'public.track_document_partitions', 'TRUNCATE') then
    raise exception 'Authenticated role can truncate all accounts';
  end if;
end;
$$;
insert into auth.users(id, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', '{}'),
  ('10000000-0000-0000-0000-000000000002', '{}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.save_track_partitioned_document('10000000-0000-0000-0000-000000000001',
  'kinevault-track.food-log.v1', 0, false, array[]::text[], '{}');
do $$
begin
  begin
    update public.track_document_partitions set user_id = '10000000-0000-0000-0000-000000000002';
    raise exception 'Owner reassignment bypassed WITH CHECK';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  if exists(select 1 from public.track_document_partitions) then
    raise exception 'Missing account identity exposed rows';
  end if;
  begin
    perform public.save_track_partitioned_document('10000000-0000-0000-0000-000000000001',
      'kinevault-track.food-log.v1', 1, true, array[]::text[], '{}');
    raise exception 'Missing account identity allowed a save';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
