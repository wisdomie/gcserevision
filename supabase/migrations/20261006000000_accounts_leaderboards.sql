-- Accounts and leaderboards (PLAN.md M4).

-- ---------------------------------------------------------------------------
-- Account deletion: deleting auth.users cascades to profiles and everything
-- the player owns. A deleted host must not take other players' rooms and
-- answers with them, so the room keeps going without a host.
-- ---------------------------------------------------------------------------

alter table public.rooms alter column host_id drop not null;
alter table public.rooms drop constraint rooms_host_id_fkey;
alter table public.rooms
  add constraint rooms_host_id_fkey foreign key (host_id) references public.profiles(id) on delete set null;

create index answers_user_created_idx on public.answers (user_id, created_at desc);
create index answers_created_idx on public.answers (created_at);

-- ---------------------------------------------------------------------------
-- Leaderboard week: starts Monday 00:00 UK time.
-- ---------------------------------------------------------------------------

create function public.leaderboard_week_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', now() at time zone 'Europe/London') at time zone 'Europe/London';
$$;

-- ---------------------------------------------------------------------------
-- played_with(): people the caller has shared a live room with. Exposes only
-- the public profile fields.
-- ---------------------------------------------------------------------------

create function public.played_with()
returns table (id uuid, username text, avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.username, p.avatar
  from public.room_players me
  join public.room_players other on other.room_id = me.room_id and other.user_id <> me.user_id
  join public.profiles p on p.id = other.user_id
  where me.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- weekly_leaderboard(scope, limit): points earned since the week started.
-- scope 'everyone' ranks all players; 'friends' ranks the caller and the
-- people they've played with. Always includes the caller's own row if they
-- have points this week. Exposes only username, avatar and points.
-- ---------------------------------------------------------------------------

create function public.weekly_leaderboard(p_scope text default 'everyone', p_limit integer default 20)
returns table (rank bigint, id uuid, username text, avatar text, points bigint, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  totals as (
    select a.user_id, sum(a.points)::bigint as points
    from public.answers a
    where a.created_at >= public.leaderboard_week_start()
      and a.points > 0
      and (
        p_scope = 'everyone'
        or a.user_id = (select id from me)
        or a.user_id in (select f.id from public.played_with() f)
      )
    group by a.user_id
  ),
  ranked as (
    select t.user_id, t.points, rank() over (order by t.points desc) as rank
    from totals t
  )
  select r.rank, p.id, p.username, p.avatar, r.points, p.id = (select id from me)
  from ranked r
  join public.profiles p on p.id = r.user_id
  where r.rank <= least(greatest(p_limit, 1), 100) or p.id = (select id from me)
  order by r.rank, p.username;
$$;

revoke all on function public.leaderboard_week_start() from public, anon, authenticated;
revoke all on function public.played_with() from public, anon, authenticated;
revoke all on function public.weekly_leaderboard(text, integer) from public, anon, authenticated;
grant execute on function public.leaderboard_week_start() to authenticated, service_role;
grant execute on function public.played_with() to authenticated, service_role;
grant execute on function public.weekly_leaderboard(text, integer) to authenticated, service_role;
