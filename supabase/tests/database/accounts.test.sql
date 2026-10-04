-- Leaderboards and account deletion (M4). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Players: A hosts a room with B; C plays solo only.
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', 'authenticated', 'authenticated');
insert into public.profiles (id, username, avatar, tier) values
  ('00000000-0000-0000-0000-0000000000f1', 'lb_alice', 'fox', 'higher'),
  ('00000000-0000-0000-0000-0000000000f2', 'lb_bob', 'panda', 'higher'),
  ('00000000-0000-0000-0000-0000000000f3', 'lb_cara', 'owl', 'higher');

insert into public.rooms (id, code, host_id, mode, subject_id, tier)
  select '44444444-4444-4444-4444-444444444444', 'LBROOM', '00000000-0000-0000-0000-0000000000f1', 'room', id, 'higher'
  from public.subjects where slug = 'maths';
insert into public.room_players (room_id, user_id) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000f1'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000f2');
insert into public.solo_sessions (id, user_id, settings) values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-0000000000f3', '{}'),
  ('55555555-5555-5555-5555-555555555556', '00000000-0000-0000-0000-0000000000f1', '{}');

insert into public.question_instances (id, subject_id, topic_id, tier, calculator, marks, public_payload)
  select ('66666666-6666-6666-6666-66666666666' || n)::uuid, s.id, t.id, 'higher', 'either', 1, '{}'
  from public.subjects s, public.topics t, generate_series(1, 5) n
  where s.slug = 'maths' and t.slug = 'fractions';

insert into public.answers (user_id, instance_id, room_id, solo_session_id, raw_answer, is_correct, points, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', '66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444444', null, '1', true, 300, now()),
  ('00000000-0000-0000-0000-0000000000f2', '66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444444', null, '1', true, 500, now()),
  ('00000000-0000-0000-0000-0000000000f3', '66666666-6666-6666-6666-666666666662', null, '55555555-5555-5555-5555-555555555555', '1', true, 100, now()),
  -- last month: must not count this week
  ('00000000-0000-0000-0000-0000000000f3', '66666666-6666-6666-6666-666666666663', null, '55555555-5555-5555-5555-555555555555', '1', true, 10000, now() - interval '35 days');
insert into public.topic_stats (user_id, topic_id, attempts, correct)
  select '00000000-0000-0000-0000-0000000000f1', id, 3, 2 from public.topics where slug = 'fractions';

create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- Only look at this test's players (other data may exist locally)
create temp view lb as
  select * from public.weekly_leaderboard('everyone', 100) where username like 'lb_%';
grant select on lb to authenticated;

-- ---------------------------------------------------------------- leaderboards
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;

select results_eq($$select username, points from lb order by points desc$$,
  $$values ('lb_bob'::text, 500::bigint), ('lb_alice'::text, 300::bigint), ('lb_cara'::text, 100::bigint)$$,
  'weekly leaderboard ranks this week''s points only');
select results_eq($$select username from public.weekly_leaderboard('friends', 100) order by rank$$,
  $$values ('lb_bob'::text), ('lb_alice'::text)$$,
  'friends leaderboard has the caller and people they played with');
select is((select is_me from lb where username = 'lb_alice'), true, 'the caller''s row is marked');
select results_eq($$select username from public.played_with()$$, $$values ('lb_bob'::text)$$,
  'played_with lists room-mates');
select is((select count(*)::int from public.weekly_leaderboard('everyone', 100) where id is null), 0,
  'every row has a player');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000000f3');
set local role authenticated;
select results_eq($$select username from public.weekly_leaderboard('friends', 100)$$, $$values ('lb_cara'::text)$$,
  'a player with no room-mates sees only themselves among friends');
select ok(exists(select 1 from public.weekly_leaderboard('everyone', 1) where username = 'lb_cara' and is_me),
  'the caller''s own row is included even outside the limit');
select is((select count(*)::int from public.played_with()), 0, 'no room-mates, no friends');
reset role;

set local role anon;
select throws_ok($$select * from public.weekly_leaderboard()$$, '42501', null, 'signed-out users cannot read leaderboards');
reset role;

-- ---------------------------------------------------------------- account deletion
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';

select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'deleting the account deletes the profile');
select is((select count(*)::int from public.answers where user_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'and their answers');
select is((select count(*)::int from public.topic_stats where user_id = '00000000-0000-0000-0000-0000000000f1')
        + (select count(*)::int from public.solo_sessions where user_id = '00000000-0000-0000-0000-0000000000f1')
        + (select count(*)::int from public.room_players where user_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'and their stats, sessions and room memberships');
select is((select host_id from public.rooms where id = '44444444-4444-4444-4444-444444444444'), null,
  'a room they hosted stays, without a host');
select is((select count(*)::int from public.answers where user_id = '00000000-0000-0000-0000-0000000000f2'), 1,
  'other players keep their answers in that room');
select is((select count(*)::int from public.room_players where room_id = '44444444-4444-4444-4444-444444444444'), 1,
  'other players stay in that room');

select * from finish();
rollback;
