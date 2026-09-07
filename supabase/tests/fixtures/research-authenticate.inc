-- One principal per test file/backend. No production auth helper changes.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"owner"}}',true);
set local role authenticated;
