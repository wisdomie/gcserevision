-- Solo mode (PLAN.md M2).

-- ---------------------------------------------------------------------------
-- Questions served in a solo session, in order. Server only.
-- ---------------------------------------------------------------------------

create table public.solo_session_questions (
  session_id uuid not null references public.solo_sessions(id) on delete cascade,
  idx smallint not null check (idx >= 0),
  instance_id uuid not null unique references public.question_instances(id) on delete cascade,
  served_at timestamptz not null default now(),
  primary key (session_id, idx)
);

alter table public.solo_session_questions enable row level security;
-- No grants and no policies: only the service role can read or write it.

create index answers_solo_session_created_idx
  on public.answers (solo_session_id, created_at desc)
  where solo_session_id is not null;

-- Usernames are unique regardless of case ("Alex" and "alex" clash).
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- serve_solo_question: create an instance, its secret, and link it to the
-- session at `p_idx`, in one transaction. Returns the instance id.
-- ---------------------------------------------------------------------------

create function public.serve_solo_question(
  p_session_id uuid,
  p_idx smallint,
  p_subject_id smallint,
  p_topic_id integer,
  p_generator_key text,
  p_seed bigint,
  p_tier text,
  p_calculator text,
  p_marks smallint,
  p_public_payload jsonb,
  p_answer_spec jsonb,
  p_solution jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_instance_id uuid;
begin
  insert into public.question_instances
    (subject_id, topic_id, generator_key, seed, tier, calculator, marks, public_payload)
  values
    (p_subject_id, p_topic_id, p_generator_key, p_seed, p_tier, p_calculator, p_marks, p_public_payload)
  returning id into v_instance_id;

  insert into public.question_secrets (instance_id, answer_spec, solution)
  values (v_instance_id, p_answer_spec, p_solution);

  -- The primary key (session_id, idx) stops two requests serving the same slot.
  insert into public.solo_session_questions (session_id, idx, instance_id)
  values (p_session_id, p_idx, v_instance_id);

  return v_instance_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_solo_answer: store a marked answer and update the session score,
-- best streak, topic stats and XP in one transaction. The unique constraint on
-- answers (user, instance, session) rejects a second answer to a question.
-- ---------------------------------------------------------------------------

create function public.record_solo_answer(
  p_session_id uuid,
  p_user_id uuid,
  p_instance_id uuid,
  p_topic_id integer,
  p_raw_answer text,
  p_is_correct boolean,
  p_marks_awarded smallint,
  p_points integer,
  p_time_ms integer,
  p_streak integer,
  p_finish boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.solo_sessions
  set score = score + p_points,
      streak_best = greatest(streak_best, p_streak),
      finished_at = case when p_finish then now() else finished_at end
  where id = p_session_id and user_id = p_user_id and finished_at is null;

  if not found then
    raise exception 'solo session % is not active for this user', p_session_id
      using errcode = 'P0002';
  end if;

  insert into public.answers
    (user_id, instance_id, solo_session_id, raw_answer, is_correct, marks_awarded, time_ms, points)
  values
    (p_user_id, p_instance_id, p_session_id, p_raw_answer, p_is_correct, p_marks_awarded, p_time_ms, p_points);

  insert into public.topic_stats as ts (user_id, topic_id, attempts, correct, last_seen)
  values (p_user_id, p_topic_id, 1, case when p_is_correct then 1 else 0 end, now())
  on conflict (user_id, topic_id) do update
    set attempts = ts.attempts + 1,
        correct = ts.correct + excluded.correct,
        last_seen = excluded.last_seen;

  update public.profiles set xp = xp + p_points where id = p_user_id;
end;
$$;

-- Only route handlers (service role) may call these.
revoke all on function public.serve_solo_question(uuid, smallint, smallint, integer, text, bigint, text, text, smallint, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.record_solo_answer(uuid, uuid, uuid, integer, text, boolean, smallint, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.serve_solo_question(uuid, smallint, smallint, integer, text, bigint, text, text, smallint, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.record_solo_answer(uuid, uuid, uuid, integer, text, boolean, smallint, integer, integer, integer, boolean) to service_role;
