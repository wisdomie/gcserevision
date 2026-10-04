-- Initial schema for Past Paper Game (PLAN.md section 5.1).
-- RLS is enabled on every table in the next migration.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.exam_boards (
  id smallint generated always as identity primary key,
  slug text unique not null,            -- 'aqa' | 'edexcel' | 'ocr' | 'wjec-eduqas'
  name text not null
);

create table public.subjects (
  id smallint generated always as identity primary key,
  slug text unique not null,            -- 'maths'
  name text not null,
  is_active boolean not null default false
);

create table public.topics (
  id integer generated always as identity primary key,
  subject_id smallint not null references public.subjects(id),
  parent_id integer references public.topics(id),
  slug text not null,
  name text not null,
  strand text,                          -- 'number' | 'algebra' | 'ratio' | 'geometry' | 'probability' | 'statistics'
  min_tier text not null default 'foundation' check (min_tier in ('foundation','higher')),
  needs_diagram boolean not null default false,
  sort_order int not null default 0,
  unique (subject_id, slug)
);

-- ---------------------------------------------------------------------------
-- Hand-written question bank (generated questions live in code)
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id smallint not null references public.subjects(id),
  topic_id integer not null references public.topics(id),
  tier text not null check (tier in ('foundation','higher','both')),
  calculator text not null check (calculator in ('calc','non-calc','either')),
  type text not null,                   -- 'mcq' | 'numeric' | 'expression' | ...
  marks smallint not null default 1,
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  prompt_md text not null,              -- markdown with $...$ LaTeX
  options jsonb,                        -- for mcq
  answer_spec jsonb not null,           -- AnswerSpec (PLAN.md 6.2)
  solution_md text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table public.question_boards (   -- no rows for a question = valid for ALL boards
  question_id uuid references public.questions(id) on delete cascade,
  exam_board_id smallint references public.exam_boards(id),
  primary key (question_id, exam_board_id)
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  avatar text,                          -- emoji or preset key, no uploads
  exam_board_id smallint references public.exam_boards(id),
  tier text check (tier in ('foundation','higher')),
  xp integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Question instances: one concrete question as shown to players
-- ---------------------------------------------------------------------------

create table public.question_instances (
  id uuid primary key default gen_random_uuid(),
  subject_id smallint not null references public.subjects(id),
  topic_id integer not null references public.topics(id),
  source_question_id uuid references public.questions(id),
  generator_key text,                   -- e.g. 'number.fractions.add'
  seed bigint,
  tier text not null,
  calculator text not null,
  marks smallint not null,
  public_payload jsonb not null,        -- PublicQuestion
  created_at timestamptz not null default now()
);

create table public.question_secrets (  -- SERVER ONLY: no client RLS policies at all
  instance_id uuid primary key references public.question_instances(id) on delete cascade,
  answer_spec jsonb not null,
  solution jsonb not null               -- { steps: string[], final: string }
);

-- ---------------------------------------------------------------------------
-- Solo
-- ---------------------------------------------------------------------------

create table public.solo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  settings jsonb not null,              -- subject, board, tier, topics, count, timed
  score integer not null default 0,
  streak_best integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Live rooms
-- ---------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code char(6) unique not null,
  host_id uuid not null references public.profiles(id),
  mode text not null check (mode in ('room','duel')),
  subject_id smallint not null references public.subjects(id),
  exam_board_id smallint references public.exam_boards(id),   -- null = mixed boards
  tier text not null check (tier in ('foundation','higher')),
  topic_ids integer[] not null default '{}',                  -- empty = all topics
  question_count smallint not null default 10,
  seconds_per_question smallint not null default 30,
  status text not null default 'lobby'
    check (status in ('lobby','question','reveal','finished')),
  current_index smallint not null default -1,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  score integer not null default 0,     -- updated only at reveal (no mid-question leaks)
  streak smallint not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.room_questions (
  room_id uuid references public.rooms(id) on delete cascade,
  idx smallint not null,
  instance_id uuid not null references public.question_instances(id),
  primary key (room_id, idx)
);

-- ---------------------------------------------------------------------------
-- Answers (both modes)
-- ---------------------------------------------------------------------------

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  instance_id uuid not null references public.question_instances(id),
  room_id uuid references public.rooms(id) on delete cascade,
  solo_session_id uuid references public.solo_sessions(id) on delete cascade,
  raw_answer text not null check (char_length(raw_answer) <= 200),
  is_correct boolean not null,
  marks_awarded smallint not null default 0,
  time_ms integer,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  check ((room_id is not null) <> (solo_session_id is not null)),
  unique (user_id, instance_id, room_id),                -- one answer per live question
  unique (user_id, instance_id, solo_session_id)
);

-- ---------------------------------------------------------------------------
-- Aggregates for "weak topics" and leaderboards
-- ---------------------------------------------------------------------------

create table public.topic_stats (
  user_id uuid references public.profiles(id) on delete cascade,
  topic_id integer references public.topics(id),
  attempts integer not null default 0,
  correct integer not null default 0,
  last_seen timestamptz,
  primary key (user_id, topic_id)
);

-- ---------------------------------------------------------------------------
-- Daily challenge (M6)
-- ---------------------------------------------------------------------------

create table public.daily_challenges (
  challenge_date date primary key,
  subject_id smallint not null references public.subjects(id),
  instance_ids uuid[] not null
);

-- ---------------------------------------------------------------------------
-- Indexes on foreign keys and common lookups
-- ---------------------------------------------------------------------------

create index topics_parent_id_idx on public.topics (parent_id);
create index questions_topic_id_idx on public.questions (topic_id);
create index questions_selection_idx on public.questions (subject_id, status, tier);
create index question_boards_exam_board_id_idx on public.question_boards (exam_board_id);
create index profiles_exam_board_id_idx on public.profiles (exam_board_id);
create index question_instances_topic_id_idx on public.question_instances (topic_id);
create index solo_sessions_user_id_idx on public.solo_sessions (user_id);
create index rooms_host_id_idx on public.rooms (host_id);
create index room_players_user_id_idx on public.room_players (user_id);
create index room_questions_instance_id_idx on public.room_questions (instance_id);
create index answers_instance_id_idx on public.answers (instance_id);
create index answers_room_id_idx on public.answers (room_id) where room_id is not null;
create index answers_solo_session_id_idx on public.answers (solo_session_id) where solo_session_id is not null;
create index topic_stats_topic_id_idx on public.topic_stats (topic_id);
