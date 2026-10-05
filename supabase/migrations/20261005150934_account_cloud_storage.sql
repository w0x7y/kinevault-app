-- Shared account identifiers match arielhagay10-ui/KineVault's core schema.
-- Apply to the verified empty project; do not replay the friend's full schema
-- over these tables without first reconciling its migration baseline.
create schema if not exists private;

create type public.app_role as enum ('user', 'reviewer', 'admin');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null
);
create index roles_role_idx on public.roles (role);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.subscriptions is
  'Server-managed account membership; no payment provider is configured.';

create table public.track_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  payload text,
  revision bigint not null default 1 check (revision > 0 and revision <= 9007199254740991),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key),
  constraint track_documents_allowed_key check (document_key in (
    'kinevault-track.profile.v1',
    'kinevault-track.exercise.v1',
    'kinevault-track.food-log.v1',
    'kinevault-track.custom-foods.v1',
    'kinevault-track.water-log.v1',
    'kinevault-track.water-goal.v1'
  )),
  constraint track_documents_json_payload check (
    payload is null or jsonb_typeof(payload::jsonb) = 'object'
  )
);
comment on column public.track_documents.payload is
  'Versioned application JSON serialized as text. SQL NULL is a deletion tombstone.';

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.track_documents enable row level security;

-- Do not rely on project-dependent default Data API grants.
revoke all on public.profiles, public.roles, public.subscriptions,
  public.track_documents from public, anon, authenticated;
grant select on public.profiles, public.roles, public.subscriptions,
  public.track_documents to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (user_id, document_key, payload, revision),
  update (payload, revision, updated_at) on public.track_documents to authenticated;
grant all on public.profiles, public.roles, public.subscriptions,
  public.track_documents to service_role;

create policy profiles_read_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy roles_read_own on public.roles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy subscriptions_read_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy track_documents_read_own on public.track_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy track_documents_insert_own on public.track_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy track_documents_update_own on public.track_documents
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function private.track_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.track_touch_updated_at()
  from public, anon, authenticated;
create trigger track_profile_updated_at before update on public.profiles
  for each row execute function private.track_touch_updated_at();
create trigger track_subscription_updated_at before update on public.subscriptions
  for each row execute function private.track_touch_updated_at();

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Metadata is used only for a descriptive name, never authorization.
  insert into public.profiles (user_id, display_name)
    values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 200), ''))
    on conflict (user_id) do nothing;
  insert into public.roles (user_id, role)
    values (new.id, 'user') on conflict (user_id) do nothing;
  insert into public.subscriptions (user_id, plan, status)
    values (new.id, 'free', 'active') on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_user()
  from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Existing accounts are harmlessly backfilled if one was created during setup.
insert into public.profiles (user_id)
  select id from auth.users on conflict (user_id) do nothing;
insert into public.roles (user_id, role)
  select id, 'user'::public.app_role from auth.users on conflict (user_id) do nothing;
insert into public.subscriptions (user_id)
  select id from auth.users on conflict (user_id) do nothing;

-- Compare-and-swap prevents a stale device overwriting a newer document.
-- Zero returned rows means a conflict. expected_revision=0 creates a new row.
create function public.save_track_document(
  p_user_id uuid,
  p_document_key text,
  p_payload text,
  p_expected_revision bigint
)
returns setof public.track_documents
language plpgsql security invoker set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- A request started under one account cannot save into another account if
  -- the SDK switches tokens before sending its queued network operation.
  if p_user_id is distinct from current_user_id then
    raise exception 'Account changed before document save' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
      or p_expected_revision >= 9007199254740991 then
    raise exception 'Invalid document revision' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    return query
      insert into public.track_documents (user_id, document_key, payload, revision)
        values (current_user_id, p_document_key, p_payload, 1)
        on conflict (user_id, document_key) do nothing
        returning *;
  else
    return query
      update public.track_documents
        set payload = p_payload, revision = revision + 1, updated_at = now()
        where user_id = current_user_id and document_key = p_document_key
          and revision = p_expected_revision
        returning *;
  end if;
end;
$$;
revoke execute on function public.save_track_document(uuid, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.save_track_document(uuid, text, text, bigint)
  to authenticated;
