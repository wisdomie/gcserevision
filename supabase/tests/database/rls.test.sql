-- RLS and grant checks for PLAN.md section 5.2. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures (as the migration owner)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated');
insert into public.profiles (id, username, avatar, tier, xp) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'fox', 'higher', 50),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'panda', 'foundation', 10);
insert into public.rooms (id, code, host_id, mode, subject_id, tier)
  select '11111111-1111-1111-1111-111111111111', 'ABCDEF',
         '00000000-0000-0000-0000-00000000000a', 'room', id, 'higher'
  from public.subjects where slug = 'maths';
insert into public.room_players (room_id, user_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a');

-- Every public table has RLS enabled
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS is enabled on every public table');

-- Simulate a signed-in user. Sets both the legacy and current claim settings
-- read by auth.uid().
create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------- anon
set local role anon;
select ok((select count(*) from public.topics) > 0, 'anon can read topics');
select ok((select count(*) from public.exam_boards) = 4, 'anon can read exam boards');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.public_profiles', '42501', null, 'anon cannot read public_profiles');
select throws_ok('select * from public.question_secrets', '42501', null, 'anon cannot read question_secrets');
reset role;

-- ---------------------------------------------------------------- alice (room member)
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select results_eq('select username from public.profiles', $$values ('alice'::text)$$,
  'profiles: a user sees only their own row');
select results_eq($$select username from public.public_profiles
    where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')
    order by username$$,
  $$values ('alice'::text), ('bob'::text)$$, 'public_profiles lists other players'' usernames');
select is((select count(*)::int from public.rooms), 1, 'member can read their room');
select is((select count(*)::int from public.room_players), 1, 'member can read room players');
select throws_ok('select * from public.question_secrets', '42501', null, 'no client access to question_secrets');
select throws_ok('select * from public.question_instances', '42501', null, 'no client access to question_instances');
select throws_ok('select * from public.questions', '42501', null, 'no client access to questions');
select throws_ok('select * from public.answers', '42501', null, 'no client access to answers');
select throws_ok('select * from public.room_questions', '42501', null, 'no client access to room_questions');
select throws_ok('update public.profiles set xp = 99999', '42501', null, 'xp is not client-writable');
select lives_ok($$update public.profiles set avatar = 'tiger'$$, 'owner can update their avatar');
update public.profiles set username = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok($$insert into public.topics (subject_id, slug, name) values (1, 'x', 'x')$$,
  '42501', null, 'clients cannot write reference data');
reset role;
select is((select username from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'bob', 'a user cannot update someone else''s profile');

-- ---------------------------------------------------------------- bob (not a member)
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is((select count(*)::int from public.rooms), 0, 'non-member cannot see the room');
select is((select count(*)::int from public.room_players), 0, 'non-member cannot see room players');
select throws_ok($$insert into public.room_players (room_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'clients cannot join rooms directly');
reset role;

-- ---------------------------------------------------------------- carol (new user)
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select throws_ok($$insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000a', 'evil')$$,
  '42501', null, 'cannot create a profile for another user');
select lives_ok($$insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000c', 'carol')$$,
  'a user can create their own profile');
reset role;

select * from finish();
rollback;
