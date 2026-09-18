begin;

-- Authorization is established before any review state is inspected. This
-- prevents an unauthorized caller from learning target workflow state.
create or replace function public.radar_approve_review(
  p_review_id uuid,
  p_expected_revision integer,
  p_public_note text,
  p_public_disclosure text,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid;
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
  work_row public.radar_work_items%rowtype;
  metrics_snapshot jsonb;
  evidence_snapshot jsonb;
  presentation jsonb;
  evidence_hash text;
begin
  if p_expected_revision is null then
    raise exception 'expected review revision is required' using errcode = '22023';
  end if;
  if length(coalesce(p_public_note, '')) > 2000
     or length(btrim(coalesce(p_public_disclosure, ''))) = 0
     or length(p_public_disclosure) > 2000
     or length(btrim(coalesce(p_action_key, ''))) = 0 then
    raise exception 'bounded editorial approval fields are required' using errcode = '22023';
  end if;
  perform private.radar_pause_guard(false);
  actor_id := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'APPROVED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision then
    raise exception 'stale review revision' using errcode = '40001';
  end if;
  if review_row.state <> 'PENDING' then
    raise exception 'review is not pending' using errcode = '55000';
  end if;
  select * into analysis_row from public.radar_analyses where id = review_row.analysis_id for share;
  select * into work_row from public.radar_work_items where id = analysis_row.work_item_id for share;
  if not found or work_row.sealed_at is null or work_row.input_hash is null
     or work_row.input_hash is distinct from private.radar_input_fingerprint(work_row.id)
     or work_row.screening_result <> 'PASS'
     or (select count(*) from public.radar_work_inputs where work_item_id = work_row.id) = 0
     or not analysis_row.public_eligibility
     or analysis_row.status not in ('EARLY', 'TRENDING', 'HIGH_RISK')
     or analysis_row.score is null
     or not isfinite(analysis_row.analyzed_at)
     or not isfinite(analysis_row.data_as_of)
     or analysis_row.expires_at is null
     or not isfinite(analysis_row.expires_at)
     or analysis_row.expires_at <= statement_timestamp()
     or not private.radar_methodology_is_approved(analysis_row.scoring_method_version)
     or not private.radar_freshness_policy_is_approved(analysis_row.freshness_policy_version)
     or not exists (select 1 from public.radar_evidence e where e.analysis_id = analysis_row.id and e.is_public) then
    raise exception 'analysis is not eligible for review approval' using errcode = '55000';
  end if;
  metrics_snapshot := private.radar_public_metrics_snapshot(analysis_row.id);
  evidence_snapshot := private.radar_public_evidence_snapshot(analysis_row.id);
  presentation := jsonb_build_object(
    'why_on_radar', left(coalesce(analysis_row.deterministic_data->>'why_on_radar', ''), 2000),
    'risk_summary', left(coalesce(analysis_row.risk_summary, ''), 2000),
    'metrics', metrics_snapshot,
    'evidence', evidence_snapshot
  );
  evidence_hash := encode(extensions.digest(convert_to(evidence_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  update public.radar_reviews
  set state = 'APPROVED', reviewed_by = actor_id, reviewed_at = statement_timestamp(),
      public_note = coalesce(p_public_note, ''), public_disclosure = p_public_disclosure,
      public_presentation = presentation, public_metrics_snapshot = metrics_snapshot,
      public_evidence_snapshot = evidence_snapshot, approval_analysis_version = analysis_row.version,
      approval_input_hash = analysis_row.input_hash, approval_methodology_hash = analysis_row.methodology_hash,
      approval_evidence_hash = evidence_hash, approval_score_snapshot = analysis_row.score::text,
      approved_at = statement_timestamp(), revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.reviewed', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'APPROVED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version, 'evidence_hash', evidence_hash),
    jsonb_build_object('schema_version', 2, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_approve_review(uuid, integer, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_approve_review(uuid, integer, text, text, text) to authenticated;

commit;
