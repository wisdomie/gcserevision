-- Rate limiting (PLAN.md 11): fixed-window counters shared by every server
-- instance. Keys are built by the app (src/lib/api/rate-limit.ts); IP
-- addresses are hashed before they get here. Rows are pruned after a day.

create table private.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table private.rate_limits enable row level security;
-- No grants and no policies: only the functions below touch it.

-- ---------------------------------------------------------------------------
-- rate_limit_check: counts one hit against every rule and returns 0 if all
-- are within their limits, otherwise the seconds until the tightest blocked
-- window resets. `p_rules` is an array of {key, window_seconds, max}.
-- ---------------------------------------------------------------------------

create function public.rate_limit_check(p_rules jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_window integer;
  v_start timestamptz;
  v_hits integer;
  v_retry integer := 0;
begin
  if jsonb_typeof(p_rules) <> 'array' then
    raise exception 'rules must be an array' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rules) loop
    v_window := (r->>'window_seconds')::integer;
    if v_window is null or v_window < 1 or (r->>'max')::integer is null then
      raise exception 'bad rate limit rule: %', r using errcode = '22023';
    end if;
    v_start := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);

    insert into private.rate_limits as rl (key, window_start, hits)
    values (r->>'key', v_start, 1)
    on conflict (key, window_start) do update set hits = rl.hits + 1
    returning hits into v_hits;

    if v_hits > (r->>'max')::integer then
      v_retry := greatest(
        v_retry,
        ceil(extract(epoch from (v_start + make_interval(secs => v_window) - now())))::integer,
        1
      );
    end if;
  end loop;

  return v_retry;
end;
$$;

-- prune_rate_limits: deletes windows older than a day. Run by the daily cron.
create function public.prune_rate_limits()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.rate_limits where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.rate_limit_check(jsonb) from public, anon, authenticated;
revoke all on function public.prune_rate_limits() from public, anon, authenticated;
grant execute on function public.rate_limit_check(jsonb) to service_role;
grant execute on function public.prune_rate_limits() to service_role;
