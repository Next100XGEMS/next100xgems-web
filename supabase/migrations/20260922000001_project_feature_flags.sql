begin;

-- Project Platform Phase 1 — fail-closed feature flags (PP1-0).
-- Defaults false; console/claims/corrections stay unavailable until staff enable.

insert into public.feature_flags (key, enabled)
values
  ('project_console_enabled', false),
  ('project_claims_enabled', false),
  ('project_corrections_enabled', false)
on conflict (key) do nothing;

commit;
