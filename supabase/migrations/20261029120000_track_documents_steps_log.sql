-- Logged steps sync as an Account tracking document. Phone steps are read on the
-- device and never stored, so they have no key. Older app builds reject a cloud
-- document key they don't know; see docs/supabase-setup.md before applying.
alter table public.track_documents
  drop constraint track_documents_allowed_key,
  add constraint track_documents_allowed_key check (document_key in (
    'kinevault-track.profile.v1',
    'kinevault-track.exercise.v1',
    'kinevault-track.food-log.v1',
    'kinevault-track.custom-foods.v1',
    'kinevault-track.water-log.v1',
    'kinevault-track.water-goal.v1',
    'kinevault-track.steps-log.v1'
  ));
