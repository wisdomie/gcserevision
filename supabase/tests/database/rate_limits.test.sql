-- Rate limiting (M8). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is(public.rate_limit_check('[{"key": "t:a", "window_seconds": 60, "max": 2}]'), 0, 'first hit is allowed');
select is(public.rate_limit_check('[{"key": "t:a", "window_seconds": 60, "max": 2}]'), 0, 'second hit is allowed');
select cmp_ok(public.rate_limit_check('[{"key": "t:a", "window_seconds": 60, "max": 2}]'), '>', 0,
  'third hit is blocked with a retry time');
select cmp_ok(public.rate_limit_check('[{"key": "t:a", "window_seconds": 60, "max": 2}]'), '<=', 60,
  'the retry time is within the window');
select is(public.rate_limit_check('[{"key": "t:b", "window_seconds": 60, "max": 2}]'), 0,
  'other keys have their own count');
select cmp_ok(
  public.rate_limit_check('[{"key": "t:c", "window_seconds": 60, "max": 5}, {"key": "t:a", "window_seconds": 60, "max": 2}]'),
  '>', 0, 'any blocked rule blocks the request');
select throws_ok($$select public.rate_limit_check('{"key": "x"}')$$, '22023', null, 'rules must be an array');

insert into private.rate_limits (key, window_start, hits) values ('t:old', now() - interval '2 days', 5);
select cmp_ok(public.prune_rate_limits(), '>=', 1, 'old windows are pruned');

set local role authenticated;
select throws_ok($$select public.rate_limit_check('[]')$$, '42501', null, 'players cannot call it');
reset role;

select * from finish();
rollback;
