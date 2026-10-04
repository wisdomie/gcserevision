-- Live room functions (M5). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- Players: host (c1), guest (c2), outsider (c3)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated');
insert into public.profiles (id, username, tier) values
  ('00000000-0000-0000-0000-0000000000c1', 'room_host', 'higher'),
  ('00000000-0000-0000-0000-0000000000c2', 'room_guest', 'higher'),
  ('00000000-0000-0000-0000-0000000000c3', 'room_outsider', 'higher');

create temp table t (room_id uuid, duel_id uuid, topic_id int, subject_id smallint);
grant all on t to authenticated;
insert into t (topic_id, subject_id)
  select tp.id, s.id from public.topics tp join public.subjects s on s.id = tp.subject_id
  where s.slug = 'maths' and tp.slug = 'fractions';

create function pg_temp.questions(n int) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'topic_id', (select topic_id from t), 'generator_key', 'number.hcf', 'seed', i,
    'calculator', 'non-calc', 'marks', 1,
    'public_payload', jsonb_build_object('promptMd', 'Q' || i),
    'answer_spec', jsonb_build_object('kind', 'integer', 'value', i),
    'solution', jsonb_build_object('steps', '[]'::jsonb, 'final', i::text)))
  from generate_series(1, n) i;
$$;

-- ---------------------------------------------------------------- create
update t set room_id = public.create_room('TSTRMA', '00000000-0000-0000-0000-0000000000c1', 'room',
  (select subject_id from t), null, 'higher', '{}', 30::smallint, pg_temp.questions(2));
select is((select question_count::int from public.rooms where id = (select room_id from t)), 2, 'room has its questions');
select is((select count(*)::int from public.room_questions rq join public.question_secrets qs using (instance_id)
           where rq.room_id = (select room_id from t)), 2, 'each question has a stored secret');
select is((select count(*)::int from public.room_players where room_id = (select room_id from t)), 1, 'the host is the first player');
select throws_ok($$select public.create_room('TSTRMA', '00000000-0000-0000-0000-0000000000c2', 'room',
  (select subject_id from t), null, 'higher', '{}', 30::smallint, pg_temp.questions(1))$$,
  '23505', null, 'room codes are unique');

-- ---------------------------------------------------------------- join and start
select is(public.join_room((select room_id from t), '00000000-0000-0000-0000-0000000000c2'), 2, 'a guest joins the lobby');
select is(public.join_room((select room_id from t), '00000000-0000-0000-0000-0000000000c2'), 2, 're-joining is a no-op');
select throws_ok($$select public.start_room((select room_id from t), '00000000-0000-0000-0000-0000000000c2')$$,
  'PR005', null, 'only the host can start');
select throws_ok($$select public.start_room((select room_id from t), '00000000-0000-0000-0000-0000000000c3')$$,
  'PR003', null, 'non-members cannot start');
select is(public.start_room((select room_id from t), '00000000-0000-0000-0000-0000000000c1'), true, 'the host starts the game');
select is(public.start_room((select room_id from t), '00000000-0000-0000-0000-0000000000c1'), false, 'starting twice is harmless');
select results_eq($$select status, current_index::int from public.rooms where id = (select room_id from t)$$,
  $$values ('question'::text, 0)$$, 'the first question is live');
select throws_ok($$select public.join_room((select room_id from t), '00000000-0000-0000-0000-0000000000c3')$$,
  'PR001', null, 'nobody can join after the start');

-- ---------------------------------------------------------------- answers
create function pg_temp.instance(idx int) returns uuid language sql as $$
  select instance_id from public.room_questions where room_id = (select room_id from t) and room_questions.idx = $1;
$$;
select lives_ok($$select public.record_room_answer((select room_id from t), '00000000-0000-0000-0000-0000000000c1',
  0::smallint, pg_temp.instance(0), '1', true, 1::smallint, 900, 3000)$$, 'the host answers');
select throws_ok($$select public.record_room_answer((select room_id from t), '00000000-0000-0000-0000-0000000000c1',
  0::smallint, pg_temp.instance(0), '2', false, 0::smallint, 0, 4000)$$, '23505', null, 'a second answer is rejected');
select throws_ok($$select public.record_room_answer((select room_id from t), '00000000-0000-0000-0000-0000000000c2',
  0::smallint, pg_temp.instance(1), '1', true, 1::smallint, 900, 3000)$$, 'PR004', null, 'an answer to another question is rejected');
select throws_ok($$select public.record_room_answer((select room_id from t), '00000000-0000-0000-0000-0000000000c3',
  0::smallint, pg_temp.instance(0), '1', true, 1::smallint, 900, 3000)$$, 'PR003', null, 'non-members cannot answer');
select is((select answered_idx::int from public.room_players where room_id = (select room_id from t)
           and user_id = '00000000-0000-0000-0000-0000000000c1'), 0, 'the host shows as locked in');
select is((select score from public.room_players where room_id = (select room_id from t)
           and user_id = '00000000-0000-0000-0000-0000000000c1'), 0, 'scores do not change before the reveal');

-- ---------------------------------------------------------------- finalize and next
select is(public.next_question((select room_id from t), 0::smallint), false, 'next does nothing during a question');
select is(public.finalize_question((select room_id from t), 0::smallint), true, 'the question closes');
select is(public.finalize_question((select room_id from t), 0::smallint), false, 'closing twice is harmless');
select results_eq($$select u.username, rp.score, rp.streak::int from public.room_players rp
    join public.profiles u on u.id = rp.user_id where rp.room_id = (select room_id from t) order by u.username$$,
  $$values ('room_guest'::text, 0, 0), ('room_host'::text, 900, 1)$$,
  'scores and streaks update at the reveal; a missing answer scores 0');
select is((select xp from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 900, 'XP is added');
select is((select attempts from public.topic_stats where user_id = '00000000-0000-0000-0000-0000000000c1'), 1, 'topic stats are updated');
select throws_ok($$select public.record_room_answer((select room_id from t), '00000000-0000-0000-0000-0000000000c2',
  0::smallint, pg_temp.instance(0), '1', true, 1::smallint, 900, 3000)$$, 'PR004', null, 'late answers are rejected after the reveal');
select is(public.next_question((select room_id from t), 0::smallint), false, 'the reveal shows for at least 5 seconds');

update public.rooms set reveal_started_at = now() - interval '10 seconds' where id = (select room_id from t);
select is(public.next_question((select room_id from t), 0::smallint), true, 'then the next question starts');
select is(public.next_question((select room_id from t), 0::smallint), false, 'moving on twice is harmless');
select results_eq($$select status, current_index::int from public.rooms where id = (select room_id from t)$$,
  $$values ('question'::text, 1)$$, 'question 2 is live');
select public.finalize_question((select room_id from t), 1::smallint);
update public.rooms set reveal_started_at = now() - interval '10 seconds' where id = (select room_id from t);
select public.next_question((select room_id from t), 1::smallint);
select is((select status from public.rooms where id = (select room_id from t)), 'finished', 'the game finishes after the last question');

-- ---------------------------------------------------------------- leave, expiry, access
update t set duel_id = public.create_room('TSTDUE', '00000000-0000-0000-0000-0000000000c1', 'duel',
  (select subject_id from t), null, 'higher', '{}', 20::smallint, pg_temp.questions(3));
select public.join_room((select duel_id from t), '00000000-0000-0000-0000-0000000000c2');
select throws_ok($$select public.join_room((select duel_id from t), '00000000-0000-0000-0000-0000000000c3')$$,
  'PR002', null, 'a duel is full with two players');
select public.leave_room((select duel_id from t), '00000000-0000-0000-0000-0000000000c1');
select is((select host_id from public.rooms where id = (select duel_id from t)), '00000000-0000-0000-0000-0000000000c2'::uuid,
  'a leaving host hands over to the next player');

update public.rooms set last_activity_at = now() - interval '4 hours' where id = (select room_id from t);
select ok(public.expire_idle_rooms() >= 1, 'idle rooms expire');
select is((select code from public.rooms where id = (select room_id from t)), null, 'an expired room loses its code but keeps its history');

set local role authenticated;
select throws_ok($$select public.finalize_question((select room_id from t), 0::smallint)$$, '42501', null,
  'clients cannot call room functions');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}', true);
select results_eq($$select username, points from public.weekly_leaderboard('friends', 100) order by points desc$$,
  $$values ('room_host'::text, 900::bigint), ('room_guest'::text, 0::bigint)$$,
  'friends include room-mates with no XP yet');
reset role;

select * from finish();
rollback;
