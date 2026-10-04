-- Live rooms (PLAN.md M5, state machine in section 10).
--
-- Every transition is a Postgres function that locks the room row, checks the
-- room is in the expected state and index, and does nothing otherwise. Several
-- clients can call advance/next at once and only the first has an effect.
-- Only the service role (route handlers) can execute these functions.
--
-- Custom error codes raised here (mapped to messages in the API):
--   PR001 room not in lobby   PR002 room full        PR003 not a member
--   PR004 question closed     PR005 not allowed (not the host)

alter table public.rooms
  add column max_players smallint not null default 20 check (max_players between 2 and 20),
  add column reveal_started_at timestamptz,
  add column last_activity_at timestamptz not null default now(),
  -- Codes expire (become null) when a room goes idle; the room's history stays.
  alter column code drop not null;

alter table public.room_players
  -- The question index this player last answered: shows "locked in" without
  -- revealing whether they were right.
  add column answered_idx smallint not null default -1;

create index rooms_status_activity_idx on public.rooms (status, last_activity_at);

-- Clients get live updates for rooms they belong to (RLS applies to Realtime).
alter publication supabase_realtime add table public.rooms, public.room_players;

-- ---------------------------------------------------------------------------
-- create_room: room + all question instances + secrets + room_questions, and
-- the host as the first player. p_questions is a JSON array of
-- {topic_id, generator_key, seed, calculator, marks, public_payload, answer_spec, solution}.
-- ---------------------------------------------------------------------------
create function public.create_room(
  p_code text,
  p_host_id uuid,
  p_mode text,
  p_subject_id smallint,
  p_exam_board_id smallint,
  p_tier text,
  p_topic_ids integer[],
  p_seconds_per_question smallint,
  p_questions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_instance_id uuid;
  q record;
begin
  insert into public.rooms
    (code, host_id, mode, subject_id, exam_board_id, tier, topic_ids, question_count,
     seconds_per_question, max_players)
  values
    (p_code, p_host_id, p_mode, p_subject_id, p_exam_board_id, p_tier, p_topic_ids,
     jsonb_array_length(p_questions), p_seconds_per_question, case when p_mode = 'duel' then 2 else 20 end)
  returning id into v_room_id;

  for q in select value, ordinality - 1 as idx from jsonb_array_elements(p_questions) with ordinality loop
    insert into public.question_instances
      (subject_id, topic_id, generator_key, seed, tier, calculator, marks, public_payload)
    values
      (p_subject_id, (q.value->>'topic_id')::integer, q.value->>'generator_key', (q.value->>'seed')::bigint,
       p_tier, q.value->>'calculator', (q.value->>'marks')::smallint, q.value->'public_payload')
    returning id into v_instance_id;

    insert into public.question_secrets (instance_id, answer_spec, solution)
    values (v_instance_id, q.value->'answer_spec', q.value->'solution');

    insert into public.room_questions (room_id, idx, instance_id) values (v_room_id, q.idx, v_instance_id);
  end loop;

  insert into public.room_players (room_id, user_id) values (v_room_id, p_host_id);
  return v_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room: only in the lobby, only while there is space. Re-joining is a
-- no-op. Returns the number of players after joining.
-- ---------------------------------------------------------------------------
create function public.join_room(p_room_id uuid, p_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_count integer;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if exists (select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id) then
    return (select count(*) from public.room_players where room_id = p_room_id);
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room is not in the lobby' using errcode = 'PR001';
  end if;
  select count(*) into v_count from public.room_players where room_id = p_room_id;
  if v_count >= v_room.max_players then
    raise exception 'room is full' using errcode = 'PR002';
  end if;
  insert into public.room_players (room_id, user_id) values (p_room_id, p_user_id);
  update public.rooms set last_activity_at = now() where id = p_room_id;
  return v_count + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_room: lobby -> question 0. The host starts it; if the host has left
-- or deleted their account, any player can. p_user_id null = system start
-- (a duel starting itself when the second player joins). Returns false if the
-- room had already started.
-- ---------------------------------------------------------------------------
create function public.start_room(p_room_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'lobby' then
    return false;
  end if;
  if p_user_id is not null then
    if not exists (select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id) then
      raise exception 'not a member of this room' using errcode = 'PR003';
    end if;
    if v_room.host_id is not null and v_room.host_id <> p_user_id then
      raise exception 'only the host can start the game' using errcode = 'PR005';
    end if;
  end if;
  update public.rooms
  set status = 'question',
      current_index = 0,
      question_started_at = now(),
      question_ends_at = now() + make_interval(secs => v_room.seconds_per_question),
      reveal_started_at = null,
      last_activity_at = now()
  where id = p_room_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_room_answer: store an answer marked by the route handler. Holds a
-- share lock on the room so it can't interleave with finalize_question, and
-- rejects answers once the question has closed. The unique constraint on
-- answers (user, instance, room) rejects a second answer.
-- ---------------------------------------------------------------------------
create function public.record_room_answer(
  p_room_id uuid,
  p_user_id uuid,
  p_idx smallint,
  p_instance_id uuid,
  p_raw_answer text,
  p_is_correct boolean,
  p_marks_awarded smallint,
  p_points integer,
  p_time_ms integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for share;
  if v_room.status <> 'question' or v_room.current_index <> p_idx
     or not exists (select 1 from public.room_questions where room_id = p_room_id and idx = p_idx and instance_id = p_instance_id) then
    raise exception 'this question has closed' using errcode = 'PR004';
  end if;
  if not exists (select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'not a member of this room' using errcode = 'PR003';
  end if;

  insert into public.answers
    (user_id, instance_id, room_id, raw_answer, is_correct, marks_awarded, time_ms, points)
  values
    (p_user_id, p_instance_id, p_room_id, p_raw_answer, p_is_correct, p_marks_awarded, p_time_ms, p_points);

  update public.room_players set answered_idx = p_idx where room_id = p_room_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- finalize_question: question(idx) -> reveal(idx). Adds this question's points
-- to the scoreboard (scores change only here), updates streaks, XP and topic
-- stats, in one transaction. Idempotent: returns false if already done.
-- ---------------------------------------------------------------------------
create function public.finalize_question(p_room_id uuid, p_idx smallint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_instance_id uuid;
  v_topic_id integer;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'question' or v_room.current_index <> p_idx then
    return false;
  end if;
  select rq.instance_id, qi.topic_id into v_instance_id, v_topic_id
  from public.room_questions rq join public.question_instances qi on qi.id = rq.instance_id
  where rq.room_id = p_room_id and rq.idx = p_idx;

  -- Scores and streaks: a missing or wrong answer resets the streak
  update public.room_players rp
  set score = rp.score + coalesce(a.points, 0),
      streak = case when coalesce(a.is_correct, false) then rp.streak + 1 else 0 end
  from public.room_players p
  left join public.answers a
    on a.user_id = p.user_id and a.room_id = p_room_id and a.instance_id = v_instance_id
  where rp.room_id = p_room_id and p.room_id = p_room_id and p.user_id = rp.user_id;

  update public.profiles pr
  set xp = pr.xp + a.points
  from public.answers a
  where a.room_id = p_room_id and a.instance_id = v_instance_id and a.user_id = pr.id and a.points > 0;

  insert into public.topic_stats as ts (user_id, topic_id, attempts, correct, last_seen)
  select a.user_id, v_topic_id, 1, case when a.is_correct then 1 else 0 end, now()
  from public.answers a
  where a.room_id = p_room_id and a.instance_id = v_instance_id
  on conflict (user_id, topic_id) do update
    set attempts = ts.attempts + 1, correct = ts.correct + excluded.correct, last_seen = excluded.last_seen;

  update public.rooms
  set status = 'reveal', reveal_started_at = now(), last_activity_at = now()
  where id = p_room_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- next_question: reveal(idx) -> question(idx + 1), or finished after the last
-- question. Not before the reveal has shown for 5 seconds. Idempotent.
-- ---------------------------------------------------------------------------
create function public.next_question(p_room_id uuid, p_idx smallint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'reveal' or v_room.current_index <> p_idx
     or now() < v_room.reveal_started_at + interval '5 seconds' then
    return false;
  end if;
  if p_idx + 1 >= v_room.question_count then
    update public.rooms set status = 'finished', last_activity_at = now() where id = p_room_id;
  else
    update public.rooms
    set status = 'question',
        current_index = p_idx + 1,
        question_started_at = now(),
        question_ends_at = now() + make_interval(secs => v_room.seconds_per_question),
        reveal_started_at = null,
        last_activity_at = now()
    where id = p_room_id;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_room: removes the player. A leaving host hands over to the player who
-- joined next. An empty lobby is deleted; a game in progress keeps its history.
-- ---------------------------------------------------------------------------
create function public.leave_room(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  delete from public.room_players where room_id = p_room_id and user_id = p_user_id;
  if v_room.host_id = p_user_id then
    update public.rooms
    set host_id = (select user_id from public.room_players where room_id = p_room_id order by joined_at limit 1)
    where id = p_room_id;
  end if;
  if v_room.status = 'lobby' and not exists (select 1 from public.room_players where room_id = p_room_id) then
    delete from public.rooms where id = p_room_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- expire_idle_rooms: codes are single-use and expire after 3 hours idle
-- (PLAN.md 11). Unfinished idle games are closed. History is kept.
-- ---------------------------------------------------------------------------
create function public.expire_idle_rooms()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with expired as (
    update public.rooms
    set code = null, status = 'finished'
    where code is not null and last_activity_at < now() - interval '3 hours'
    returning 1
  )
  select count(*)::integer from expired;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_room(text, uuid, text, smallint, smallint, text, integer[], smallint, jsonb)',
    'join_room(uuid, uuid)',
    'start_room(uuid, uuid)',
    'record_room_answer(uuid, uuid, smallint, uuid, text, boolean, smallint, integer, integer)',
    'finalize_question(uuid, smallint)',
    'next_question(uuid, smallint)',
    'leave_room(uuid, uuid)',
    'expire_idle_rooms()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
