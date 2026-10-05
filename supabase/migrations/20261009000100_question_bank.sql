-- Hand-written question bank (PLAN.md M8). Questions are written in
-- content/questions/*.csv and loaded with `pnpm import:questions`, which
-- upserts by slug. The structured solution matches generated questions.

alter table public.questions
  add column slug text unique,
  add column solution jsonb;

create index questions_published_topic_idx on public.questions (topic_id) where status = 'published';
