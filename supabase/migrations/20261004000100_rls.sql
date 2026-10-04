-- Row Level Security (PLAN.md section 5.2).
--
-- Defence in depth: Supabase grants every privilege on new public tables to
-- anon and authenticated by default. We revoke those, grant back only what a
-- client legitimately needs, and enable RLS on every table. Tables with no
-- policy are reachable only with the service-role key (route handlers).

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.exam_boards        enable row level security;
alter table public.subjects           enable row level security;
alter table public.topics             enable row level security;
alter table public.questions          enable row level security;
alter table public.question_boards    enable row level security;
alter table public.profiles           enable row level security;
alter table public.question_instances enable row level security;
alter table public.question_secrets   enable row level security;
alter table public.solo_sessions      enable row level security;
alter table public.rooms              enable row level security;
alter table public.room_players       enable row level security;
alter table public.room_questions     enable row level security;
alter table public.answers            enable row level security;
alter table public.topic_stats        enable row level security;
alter table public.daily_challenges   enable row level security;

-- ---------------------------------------------------------------------------
-- Start from zero client privileges
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

-- Future objects also start with no client privileges; each migration must
-- grant explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- Note: EXECUTE for PUBLIC is a global default and cannot be revoked per schema,
-- so every new function must `revoke all ... from public` itself.

-- ---------------------------------------------------------------------------
-- Helpers (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

-- security definer so the room_players policy does not recurse into itself.
create function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_room_member(uuid) from public;
grant execute on function private.is_room_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reference data: readable by everyone, no client writes
-- ---------------------------------------------------------------------------

grant select on public.exam_boards, public.subjects, public.topics to anon, authenticated;

create policy "exam_boards readable by everyone" on public.exam_boards
  for select to anon, authenticated using (true);
create policy "subjects readable by everyone" on public.subjects
  for select to anon, authenticated using (true);
create policy "topics readable by everyone" on public.topics
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Server-only tables: no grants, no policies
--   questions, question_boards, question_instances, question_secrets,
--   room_questions, answers, daily_challenges
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Profiles
--   Owner reads/inserts/updates their own row. xp is never client-writable.
--   Other users see only id, username, avatar via public.public_profiles.
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant insert (id, username, avatar, exam_board_id, tier) on public.profiles to authenticated;
grant update (username, avatar, exam_board_id, tier) on public.profiles to authenticated;

create policy "profiles owner select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles owner insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles owner update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Deliberately a definer-rights view (security_invoker off): it exposes only
-- the three public columns of every profile, bypassing the owner-only policy.
create view public.public_profiles as
  select id, username, avatar from public.profiles;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Rooms: readable by members; writes via API routes (service role) only
-- ---------------------------------------------------------------------------

grant select on public.rooms, public.room_players to authenticated;

create policy "rooms readable by members" on public.rooms
  for select to authenticated using (private.is_room_member(id));
create policy "room_players readable by members" on public.room_players
  for select to authenticated using (private.is_room_member(room_id));

-- ---------------------------------------------------------------------------
-- Owner read only; writes via API routes
-- ---------------------------------------------------------------------------

grant select on public.solo_sessions, public.topic_stats to authenticated;

create policy "solo_sessions owner select" on public.solo_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "topic_stats owner select" on public.topic_stats
  for select to authenticated using ((select auth.uid()) = user_id);
