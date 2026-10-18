-- Per-account limit for the delete-account Edge Function. Each attempt can
-- check a password, so a stolen session must not get unlimited guesses.
create table private.account_deletion_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index account_deletion_attempts_user_time
  on private.account_deletion_attempts (user_id, attempted_at);
alter table private.account_deletion_attempts enable row level security;
revoke all on private.account_deletion_attempts from public, anon, authenticated;

-- Records one attempt and returns false once the account made 5 in the past hour.
create function public.record_account_deletion_attempt(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  recent integer;
begin
  -- Serializes one account's concurrent attempts so none slips past the count.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from private.account_deletion_attempts
    where user_id = p_user_id and attempted_at < now() - interval '1 hour';
  select count(*) into recent
    from private.account_deletion_attempts where user_id = p_user_id;
  if recent >= 5 then
    return false;
  end if;
  insert into private.account_deletion_attempts (user_id) values (p_user_id);
  return true;
end;
$$;
revoke execute on function public.record_account_deletion_attempt(uuid)
  from public, anon, authenticated;
grant execute on function public.record_account_deletion_attempt(uuid) to service_role;
