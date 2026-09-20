begin;
\ir ../fixtures/analyzer.inc
select extensions.no_plan();
select public.set_token_analyzer_enabled(true);

-- Scoped observations must match one complete provider/chain/base/quote tuple.
reset role;
grant execute on function public.analyzer_validate_observation(jsonb,jsonb), public.analyzer_validate_manifest_current(jsonb,jsonb,jsonb,uuid) to service_role;
set local role service_role;
select extensions.lives_ok($$select public.analyzer_validate_observation(
  '{"key":"liquidity","label":"Pool liquidity","value":"100","state":"AVAILABLE","evidenceClass":"STRONG_SIGNAL","source":"dex-screener","observedAt":"2026-09-20T00:00:00Z","evidenceId":"pool-a-liq","identity":"0x0000000000000000000000000000000000000002","identityType":"POOL","tokenId":"ethereum:0x0000000000000000000000000000000000000001","provenance":[{"source":"dex-screener","kind":"PROVIDER_DERIVED","reference":"0x0000000000000000000000000000000000000002","referenceType":"POOL","capturedAt":"2026-09-20T00:00:00Z"}],"context":{"scope":"PAIR","chain":"ethereum","token":"0x0000000000000000000000000000000000000001","poolId":"0x0000000000000000000000000000000000000002","quoteAsset":"0x0000000000000000000000000000000000000003","timeWindow":null,"retrievedAt":"2026-09-20T00:00:00Z","completeness":"PARTIAL","classification":"PROVIDER_DERIVED","methodology":"DEX_SCREENER_PAIR"}}'::jsonb,
  '{"chain":"ethereum","tokenAddress":"0x0000000000000000000000000000000000000001","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000001","trustedPools":[{"provider":"dex-screener","chain":"ethereum","poolAddress":"0x0000000000000000000000000000000000000002","baseToken":"0x0000000000000000000000000000000000000001","quoteToken":"0x0000000000000000000000000000000000000003"}]}'::jsonb)$$,'Primary tuple is accepted');
select extensions.throws_ok($$select public.analyzer_validate_observation(
  '{"key":"liquidity","label":"Pool liquidity","value":"100","state":"AVAILABLE","evidenceClass":"STRONG_SIGNAL","source":"dex-screener","observedAt":"2026-09-20T00:00:00Z","evidenceId":"pool-a-liq","identity":"0x0000000000000000000000000000000000000002","identityType":"POOL","tokenId":"ethereum:0x0000000000000000000000000000000000000001","provenance":[{"source":"dex-screener","kind":"PROVIDER_DERIVED","reference":"0x0000000000000000000000000000000000000002","referenceType":"POOL","capturedAt":"2026-09-20T00:00:00Z"}],"context":{"scope":"PAIR","chain":"ethereum","token":"0x0000000000000000000000000000000000000001","poolId":"0x0000000000000000000000000000000000000002","quoteAsset":"0x0000000000000000000000000000000000000004","timeWindow":null,"retrievedAt":"2026-09-20T00:00:00Z","completeness":"PARTIAL","classification":"PROVIDER_DERIVED","methodology":"DEX_SCREENER_PAIR"}}'::jsonb,
  '{"chain":"ethereum","tokenAddress":"0x0000000000000000000000000000000000000001","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000001","trustedPools":[{"provider":"dex-screener","chain":"ethereum","poolAddress":"0x0000000000000000000000000000000000000002","baseToken":"0x0000000000000000000000000000000000000001","quoteToken":"0x0000000000000000000000000000000000000003"}]}'::jsonb)$$,'23P01',null,'Wrong quote tuple is rejected');

-- SQL persistence must recompute concentration instead of trusting value=1.
set local role authenticated;
update analyzer_case set r=public.analyzer_reserve_delivery(f->'input',f->'resolution');
set local role service_role;
update analyzer_case set f=jsonb_set(f,'{manifest,resolvedToken}',(select public.analyzer_attest_resolution(r->>'delivery_key',f->'input',f->'resolution',repeat('a',64),'token-analyzer-live-collector-v2')->'resolution'));
select extensions.throws_ok($$select public.analyzer_validate_manifest_current(
  jsonb_set((select f->'manifest' from analyzer_case),'{observations}', $observations$[
    {"key":"supply","label":"Supply","value":"1000","state":"AVAILABLE","evidenceClass":"VERIFIED_DATA","source":"chain","observedAt":"2026-09-20T00:00:00Z","evidenceId":"supply-1","identity":"0x0000000000000000000000000000000000000001","identityType":"TOKEN","tokenId":"ethereum:0x0000000000000000000000000000000000000001","provenance":[{"source":"chain","kind":"DIRECT_CHAIN","reference":"0x0000000000000000000000000000000000000001","referenceType":"TOKEN","capturedAt":"2026-09-20T00:00:00Z"}]},
    {"key":"concentration","label":"Share","value":"1","state":"AVAILABLE","evidenceClass":"STRONG_SIGNAL","source":"chain","observedAt":"2026-09-20T00:00:00Z","evidenceId":"conc-1","identity":"0x0000000000000000000000000000000000000001","identityType":"TOKEN","tokenId":"ethereum:0x0000000000000000000000000000000000000001","provenance":[{"source":"chain","kind":"DIRECT_CHAIN","reference":"0x0000000000000000000000000000000000000001","referenceType":"TOKEN","capturedAt":"2026-09-20T00:00:00Z"}],"context":{"scope":"TOKEN_AGGREGATE","chain":"ethereum","token":"0x0000000000000000000000000000000000000001","poolId":null,"quoteAsset":null,"timeWindow":null,"retrievedAt":"2026-09-20T00:00:00Z","completeness":"PARTIAL","classification":"OBJECTIVE_DERIVED","methodology":"TOP10_TOTAL_SUPPLY_SHARE","denominatorType":"TOTAL_SUPPLY","denominatorValue":"1000","returnedAccountCount":2,"requestedTopN":20,"metricTopN":10,"exclusions":[],"rawBalances":[{"address":"0x0000000000000000000000000000000000000001","balance":"100"},{"address":"0x0000000000000000000000000000000000000002","balance":"100"}]}}
  ]$observations$::jsonb),
  (select f->'input' from analyzer_case),(select f->'manifest'->'resolvedToken' from analyzer_case),(select (r->>'request_id')::uuid from analyzer_case))$$,'23P01',null,'Forged concentration ratio is rejected at trusted persistence');

select extensions.throws_ok($$select public.analyzer_attest_pump_lifecycle((select r->>'delivery_key' from analyzer_case),'{"mint":"0x0000000000000000000000000000000000000001","programId":"11111111111111111111111111111111","curveAddress":"11111111111111111111111111111111","decoderVersion":"invented","complete":true,"virtualTokenReserves":"1","virtualSolReserves":"1","realTokenReserves":"1","realSolReserves":"1"}'::jsonb)$$,'23P01',null,'Unapproved Pump lifecycle context is rejected');

select * from extensions.finish();
rollback;
