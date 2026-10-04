-- Daily challenge and streaks (M6). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', 'authenticated', 'authenticated');
insert into public.profiles (id, username, avatar, tier) values
  ('00000000-0000-0000-0000-0000000000d1', 'daily_dee', 'fox', 'higher'),
  ('00000000-0000-0000-0000-0000000000d2', 'daily_friend', 'owl', 'foundation'),
  ('00000000-0000-0000-0000-0000000000d3', 'daily_stranger', 'cat', 'higher');
-- d1 and d2 have played a room together; d3 is a stranger
insert into public.rooms (id, code, host_id, mode, subject_id, tier)
  select '66666666-6666-6666-6666-666666666666', 'DAILYR', '00000000-0000-0000-0000-0000000000d1', 'room', id, 'higher'
  from public.subjects where slug = 'maths';
insert into public.room_players (room_id, user_id) values
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-0000000000d1'),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-0000000000d2');

create temp table q (questions jsonb, topic_id int, subject_id smallint);
grant all on q to authenticated;
insert into q
  select jsonb_build_array(
           jsonb_build_object('topic_id', t.id, 'generator_key', 'number.hcf', 'seed', 1, 'calculator', 'non-calc',
             'marks', 1, 'public_payload', '{"promptMd": "HCF of 4 and 6"}'::jsonb,
             'answer_spec', '{"kind": "integer", "value": 2}'::jsonb, 'solution', '{"steps": [], "final": "2"}'::jsonb),
           jsonb_build_object('topic_id', t.id, 'generator_key', 'number.lcm', 'seed', 2, 'calculator', 'non-calc',
             'marks', 1, 'public_payload', '{"promptMd": "LCM of 4 and 6"}'::jsonb,
             'answer_spec', '{"kind": "integer", "value": 12}'::jsonb, 'solution', '{"steps": [], "final": "12"}'::jsonb)),
         t.id, t.subject_id
  from public.topics t where t.slug = 'hcf-lcm';

create temp table ids (day uuid[]);
grant all on ids to authenticated;

-- ---------------------------------------------------------------- create
insert into ids select public.create_daily_challenge(public.daily_today(), (select subject_id from q), (select questions from q));
select is(cardinality((select day from ids)), 2, 'create_daily_challenge stores every question');
select is((select count(*)::int from public.question_secrets where instance_id in (select unnest(day) from ids)), 2,
  'secrets are stored with the instances');
select is((select tier from public.question_instances where id = (select day[1] from ids)), 'both',
  'daily instances suit both tiers');
select is(public.create_daily_challenge(public.daily_today(), (select subject_id from q), (select questions from q)),
  (select day from ids), 'a second call returns the same day');
select is((select count(*)::int from public.question_instances where generator_key in ('number.hcf', 'number.lcm')
           and tier = 'both'), 2, 'a second call adds no instances');
select throws_ok($$select public.create_daily_challenge(public.daily_today() + 1, 1::smallint, '[]')$$,
  '22023', null, 'a day needs questions');

-- ---------------------------------------------------------------- start
create temp table s (id uuid, who text);
grant all on s to authenticated;
insert into s select public.start_daily('00000000-0000-0000-0000-0000000000d1', public.daily_today(),
  jsonb_build_object('mode', 'daily', 'subject', 'maths', 'date', public.daily_today()::text, 'timed', false)), 'd1';
select results_eq($$select idx::int, instance_id from public.solo_session_questions
                    where session_id = (select id from s where who = 'd1') order by idx$$,
  $$select (i - 1)::int, (select day from ids)[i] from generate_series(1, 2) as i$$,
  'start_daily links the day''s questions in order');
select is((select (settings->>'count')::int from public.solo_sessions where id = (select id from s where who = 'd1')), 2,
  'the attempt records how many questions there are');
select is(public.start_daily('00000000-0000-0000-0000-0000000000d1', public.daily_today(),
  jsonb_build_object('mode', 'daily', 'subject', 'maths', 'date', public.daily_today()::text, 'timed', false)),
  (select id from s where who = 'd1'), 'starting again returns the same attempt');
select throws_ok($$select public.start_daily('00000000-0000-0000-0000-0000000000d1', public.daily_today() + 5,
  jsonb_build_object('mode', 'daily', 'date', (public.daily_today() + 5)::text))$$,
  'P0002', null, 'there is no attempt without a challenge');
select throws_ok($$select public.start_daily('00000000-0000-0000-0000-0000000000d1', public.daily_today(),
  '{"mode": "solo"}')$$, '22023', null, 'settings must be a daily for that date');

-- Two players share the same instances
insert into s select public.start_daily('00000000-0000-0000-0000-0000000000d2', public.daily_today(),
  jsonb_build_object('mode', 'daily', 'subject', 'maths', 'date', public.daily_today()::text, 'timed', false)), 'd2';
insert into s select public.start_daily('00000000-0000-0000-0000-0000000000d3', public.daily_today(),
  jsonb_build_object('mode', 'daily', 'subject', 'maths', 'date', public.daily_today()::text, 'timed', false)), 'd3';
select is((select count(*)::int from public.solo_session_questions where instance_id = (select day[1] from ids)), 3,
  'every attempt links the same first question');

-- d1: one right; d2: both right; d3: both right; d1 and d3 finish, d2 doesn't yet
select public.record_solo_answer((select id from s where who = 'd1'), '00000000-0000-0000-0000-0000000000d1',
  (select day[1] from ids), (select topic_id from q), '2', true, 1::smallint, 100, 1000, 1, false);
select public.record_solo_answer((select id from s where who = 'd1'), '00000000-0000-0000-0000-0000000000d1',
  (select day[2] from ids), (select topic_id from q), '24', false, 0::smallint, 0, 1000, 0, true);
select public.record_solo_answer((select id from s where who = 'd2'), '00000000-0000-0000-0000-0000000000d2',
  (select day[1] from ids), (select topic_id from q), '2', true, 1::smallint, 100, 1000, 1, false);
select public.record_solo_answer((select id from s where who = 'd3'), '00000000-0000-0000-0000-0000000000d3',
  (select day[1] from ids), (select topic_id from q), '2', true, 1::smallint, 100, 1000, 1, false);
select public.record_solo_answer((select id from s where who = 'd3'), '00000000-0000-0000-0000-0000000000d3',
  (select day[2] from ids), (select topic_id from q), '12', true, 1::smallint, 100, 1000, 2, true);

-- ---------------------------------------------------------------- streaks
-- d1 also finished the two days before yesterday, but not yesterday
insert into public.solo_sessions (user_id, settings, finished_at) values
  ('00000000-0000-0000-0000-0000000000d1', jsonb_build_object('mode', 'daily', 'date', (public.daily_today() - 2)::text), now()),
  ('00000000-0000-0000-0000-0000000000d1', jsonb_build_object('mode', 'daily', 'date', (public.daily_today() - 3)::text), now()),
  -- an unfinished attempt doesn't count
  ('00000000-0000-0000-0000-0000000000d1', jsonb_build_object('mode', 'daily', 'date', (public.daily_today() - 1)::text), null),
  -- a solo session doesn't count
  ('00000000-0000-0000-0000-0000000000d1', '{"mode": "solo"}', now());
select is(private.daily_streak('00000000-0000-0000-0000-0000000000d1', public.daily_today()), 1,
  'a missed day ends the streak');
select is(private.daily_streak('00000000-0000-0000-0000-0000000000d1', public.daily_today() - 1), 2,
  'yesterday''s streak is still alive until the day is over');
select is(private.daily_streak('00000000-0000-0000-0000-0000000000d1', public.daily_today() + 2), 0,
  'two days without playing is no streak');
update public.solo_sessions set finished_at = now()
  where user_id = '00000000-0000-0000-0000-0000000000d1' and settings->>'date' = (public.daily_today() - 1)::text;
select is(private.daily_streak('00000000-0000-0000-0000-0000000000d1', public.daily_today()), 4,
  'finishing every day builds the streak');
select is(private.daily_streak('00000000-0000-0000-0000-0000000000d2', public.daily_today()), 0,
  'an unfinished attempt is no streak');

-- ---------------------------------------------------------------- as players
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
set local role authenticated;

select is(public.my_daily_streak(), 4, 'players see their own streak');
select results_eq($$select username, points, correct, total, streak, is_me from public.daily_leaderboard()$$,
  $$values ('daily_dee'::text, 100, 1, 2, 4, true)$$,
  'the daily board shows friends who finished, never strangers or unfinished attempts');
select throws_ok($$select public.start_daily('00000000-0000-0000-0000-0000000000d1', public.daily_today(), '{}')$$,
  '42501', null, 'players cannot start attempts directly');
select throws_ok($$select public.create_daily_challenge(public.daily_today() + 9, 1::smallint, '[]')$$,
  '42501', null, 'players cannot create challenges');
select throws_ok($$select * from public.daily_challenges$$, '42501', null, 'the challenge table is server only');

reset role;
select * from finish();
rollback;
