-- Covers the shared role assignment foreign key for account deletion/updates.
create index roles_assigned_by_idx on public.roles (assigned_by);
