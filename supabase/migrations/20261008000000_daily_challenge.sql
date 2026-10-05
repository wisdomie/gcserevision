-- Daily challenge and streaks (PLAN.md M6).
--
-- A day's challenge is five shared question instances in `daily_challenges`.
-- A player's attempt is a `solo_sessions` row with settings.mode = 'daily',
-- one per player per date, linked to those same instances, so `answers` keeps
-- its solo/room constraint and the solo answer route marks it.

-- ---------------------------------------------------------------------------
-- Shared instances: a daily instance is linked to every player's attempt, so
-- an instance is unique within a session rather than across all sessions.
-- ---------------------------------------------------------------------------

alter table public.solo_session_questions drop constraint solo_session_questions_instance_id_key;
alter table public.solo_session_questions
  add constraint solo_session_questions_session_instance_key unique (session_id, instance_id);
create index solo_session_questions_instance_idx on public.solo_session_questions (instance_id);

-- One daily attempt per player per date.
create unique index solo_sessions_daily_idx
  on public.solo_sessions (user_id, (settings->>'date'))
  where settings->>'mode' = 'daily';

-- ---------------------------------------------------------------------------
-- create_daily_challenge: store a day's questions (instances and secrets) and
-- the challenge row, once. Concurrent callers for the same date wait on a lock
-- and get the first caller's instances, so no orphan instances are left.
-- `p_questions` is an array of
--   {topic_id, generator_key, seed, calculator, marks, public_payload, answer_spec, solution}.
-- ---------------------------------------------------------------------------

create function public.create_daily_challenge(p_date date, p_subject_id smallint, p_questions jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
  q jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('daily_challenge'), (p_date - date '2000-01-01'));

  select instance_ids into v_ids from public.daily_challenges where challenge_date = p_date;
  if found then
    return v_ids;
  end if;

  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'a daily challenge needs at least one question' using errcode = '22023';
  end if;

  v_ids := '{}';
  for q in select value from jsonb_array_elements(p_questions) loop
    insert into public.question_instances
      (subject_id, topic_id, generator_key, seed, tier, calculator, marks, public_payload)
    values
      (p_subject_id, (q->>'topic_id')::integer, q->>'generator_key', (q->>'seed')::bigint, 'both',
       q->>'calculator', (q->>'marks')::smallint, q->'public_payload')
    returning id into v_id;

    insert into public.question_secrets (instance_id, answer_spec, solution)
    values (v_id, q->'answer_spec', q->'solution');

    v_ids := v_ids || v_id;
  end loop;

  insert into public.daily_challenges (challenge_date, subject_id, instance_ids)
  values (p_date, p_subject_id, v_ids);

  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_daily: the player's attempt at a date's challenge, created on first
-- call with every question linked in order. Returns the session id, and the
-- existing one if they've already started.
-- ---------------------------------------------------------------------------

create function public.start_daily(p_user_id uuid, p_date date, p_settings jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_session_id uuid;
begin
  if p_settings->>'mode' is distinct from 'daily' or p_settings->>'date' is distinct from p_date::text then
    raise exception 'daily settings must match the date' using errcode = '22023';
  end if;

  select instance_ids into v_ids from public.daily_challenges where challenge_date = p_date;
  if not found then
    raise exception 'no daily challenge for %', p_date using errcode = 'P0002';
  end if;

  insert into public.solo_sessions (user_id, settings)
  values (p_user_id, p_settings || jsonb_build_object('count', cardinality(v_ids)))
  on conflict (user_id, (settings->>'date')) where settings->>'mode' = 'daily' do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id into v_session_id from public.solo_sessions
    where user_id = p_user_id and settings->>'mode' = 'daily' and settings->>'date' = p_date::text;
    return v_session_id;
  end if;

  insert into public.solo_session_questions (session_id, idx, instance_id)
  select v_session_id, (i - 1)::smallint, v_ids[i]
  from generate_subscripts(v_ids, 1) as i;

  return v_session_id;
end;
$$;

revoke all on function public.create_daily_challenge(date, smallint, jsonb) from public, anon, authenticated;
revoke all on function public.start_daily(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.create_daily_challenge(date, smallint, jsonb) to service_role;
grant execute on function public.start_daily(uuid, date, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- The UK date today: days roll over at midnight UK time.
-- ---------------------------------------------------------------------------

create function public.daily_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/London')::date;
$$;

-- ---------------------------------------------------------------------------
-- private.daily_streak: how many days in a row a player has finished the
-- daily, counting back from today, or from yesterday if they haven't played
-- yet today (the streak is still alive until the day is over).
-- ---------------------------------------------------------------------------

create function private.daily_streak(p_user_id uuid, p_today date)
returns integer
language sql
stable
set search_path = ''
as $$
  with days as (
    select distinct (s.settings->>'date')::date as d
    from public.solo_sessions s
    where s.user_id = p_user_id
      and s.settings->>'mode' = 'daily'
      and s.finished_at is not null
      and (s.settings->>'date')::date <= p_today
  ),
  anchor as (
    select max(d) as d from days where d >= p_today - 1
  ),
  runs as (
    -- consecutive days, newest first, share the same d + row number
    select d, d + (row_number() over (order by d desc))::integer as run
    from days
    where d <= (select d from anchor)
  )
  select count(*)::integer
  from runs
  where run = (select d from anchor) + 1;
$$;

revoke all on function private.daily_streak(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- my_daily_streak(): the caller's current daily streak.
-- ---------------------------------------------------------------------------

create function public.my_daily_streak()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.daily_streak((select auth.uid()), public.daily_today());
$$;

-- ---------------------------------------------------------------------------
-- daily_leaderboard(date): the caller and the people they've played with who
-- finished that date's daily, ranked by points. Includes each player's
-- current streak. Exposes only username, avatar, points, correct count and
-- streak, never answers.
-- ---------------------------------------------------------------------------

create function public.daily_leaderboard(p_date date default null)
returns table (
  rank bigint,
  id uuid,
  username text,
  avatar text,
  points integer,
  correct integer,
  total integer,
  streak integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  day as (select coalesce(p_date, public.daily_today()) as d),
  people as (
    select (select id from me) as user_id
    union
    select f.id from public.played_with() f
  ),
  attempts as (
    select s.id as session_id, s.user_id, s.score,
           (s.settings->>'count')::integer as total
    from public.solo_sessions s
    where s.user_id in (select user_id from people)
      and s.settings->>'mode' = 'daily'
      and s.settings->>'date' = (select d from day)::text
      and s.finished_at is not null
  ),
  scored as (
    select a.user_id, a.score, a.total,
           (select count(*) from public.answers x where x.solo_session_id = a.session_id and x.is_correct)::integer as correct
    from attempts a
  )
  select rank() over (order by s.score desc, s.correct desc),
         p.id, p.username, p.avatar, s.score, s.correct, s.total,
         private.daily_streak(p.id, public.daily_today()),
         p.id = (select id from me)
  from scored s
  join public.profiles p on p.id = s.user_id
  where (select id from me) is not null
  order by 1, p.username;
$$;

revoke all on function public.my_daily_streak() from public, anon;
revoke all on function public.daily_leaderboard(date) from public, anon;
grant execute on function public.my_daily_streak() to authenticated;
grant execute on function public.daily_leaderboard(date) to authenticated;
