create unique index if not exists interviews_one_scheduled_per_application_idx
  on public.interviews (application_id)
  where status = 'scheduled';

comment on index public.interviews_one_scheduled_per_application_idx is
  'Prevents duplicate active interview invitations for one application while allowing cancelled history.';
