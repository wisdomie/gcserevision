-- Solo mode tables and functions (M2). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated');
insert into public.profiles (id, username, tier) values
  ('00000000-0000-0000-0000-0000000000a1', 'solo_tester', 'higher');
insert into public.solo_sessions (id, user_id, settings) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000a1', '{}');

create temp table t (instance_id uuid, topic_id int);
grant all on t to authenticated;
insert into t (topic_id) select id from public.topics where slug = 'fractions';

-- ---------------------------------------------------------------- serve
update t set instance_id = public.serve_solo_question(
  '33333333-3333-3333-3333-333333333333', 0::smallint,
  (select id from public.subjects where slug = 'maths'), (select topic_id from t),
  'number.fractions.add', 42, 'higher', 'non-calc', 2::smallint,
  '{"promptMd": "Work out 1/2 + 1/3"}', '{"kind": "fraction", "num": 5, "den": 6, "mustBeSimplest": true}',
  '{"steps": [], "final": "5/6"}');

select isnt((select instance_id from t), null, 'serve_solo_question returns an instance id');
select is((select count(*)::int from public.question_secrets where instance_id = (select instance_id from t)), 1,
  'the secret is stored with the instance');
select is((select idx::int from public.solo_session_questions where instance_id = (select instance_id from t)), 0,
  'the instance is linked to the session slot');
select throws_ok($$select public.serve_solo_question(
  '33333333-3333-3333-3333-333333333333', 0::smallint, 1::smallint, (select topic_id from t),
  'number.fractions.add', 43, 'higher', 'non-calc', 2::smallint, '{}', '{}', '{}')$$,
  '23505', null, 'the same slot cannot be served twice');

-- ---------------------------------------------------------------- record
select lives_ok($$select public.record_solo_answer(
  '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000a1',
  (select instance_id from t), (select topic_id from t), '5/6', true, 2::smallint, 200, 4000, 1, false)$$,
  'record_solo_answer stores a marked answer');
select is((select score from public.solo_sessions where id = '33333333-3333-3333-3333-333333333333'), 200,
  'session score increases');
select is((select streak_best from public.solo_sessions where id = '33333333-3333-3333-3333-333333333333'), 1,
  'best streak is updated');
select is((select xp from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 200, 'XP increases');
select results_eq(
  $$select attempts, correct from public.topic_stats
    where user_id = '00000000-0000-0000-0000-0000000000a1' and topic_id = (select topic_id from t)$$,
  $$values (1, 1)$$, 'topic stats are created');

select throws_ok($$select public.record_solo_answer(
  '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000a1',
  (select instance_id from t), (select topic_id from t), '1/2', false, 0::smallint, 0, 4000, 0, false)$$,
  '23505', null, 'a second answer to the same question is rejected');
select is((select score from public.solo_sessions where id = '33333333-3333-3333-3333-333333333333'), 200,
  'a rejected answer changes nothing');

select throws_ok($$select public.record_solo_answer(
  '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-00000000dead',
  (select instance_id from t), (select topic_id from t), '1', false, 0::smallint, 0, 0, 0, false)$$,
  'P0002', null, 'another user cannot answer in this session');

-- ---------------------------------------------------------------- client access
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok('select * from public.solo_session_questions', '42501', null,
  'clients cannot read solo_session_questions');
select throws_ok($$select public.record_solo_answer(
  '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000a1',
  (select instance_id from t), (select topic_id from t), '1', true, 2::smallint, 99999, 0, 99, false)$$,
  '42501', null, 'clients cannot call record_solo_answer');
select throws_ok($$select public.serve_solo_question(
  '33333333-3333-3333-3333-333333333333', 5::smallint, 1::smallint, 1, 'x', 1, 'higher', 'calc', 1::smallint, '{}', '{}', '{}')$$,
  '42501', null, 'clients cannot call serve_solo_question');
select is((select score from public.solo_sessions where id = '33333333-3333-3333-3333-333333333333'), 200,
  'the owner can still read their own session');
reset role;

select * from finish();
rollback;
