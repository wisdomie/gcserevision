-- The friends leaderboard lists everyone you've played with, including those
-- with no XP yet this week (PLAN.md 9: "people I've played with").
create or replace function public.weekly_leaderboard(p_scope text default 'everyone', p_limit integer default 20)
returns table (rank bigint, id uuid, username text, avatar text, points bigint, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  people as (
    select (select id from me) as user_id where p_scope = 'friends'
    union
    select f.id from public.played_with() f where p_scope = 'friends'
  ),
  earned as (
    select a.user_id, sum(a.points)::bigint as points
    from public.answers a
    where a.created_at >= public.leaderboard_week_start()
      and a.points > 0
      and (p_scope = 'everyone' or a.user_id in (select user_id from people))
    group by a.user_id
  ),
  totals as (
    select e.user_id, e.points from earned e where p_scope = 'everyone'
    union all
    select p.user_id, coalesce(e.points, 0) from people p left join earned e on e.user_id = p.user_id
    where p_scope = 'friends'
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
