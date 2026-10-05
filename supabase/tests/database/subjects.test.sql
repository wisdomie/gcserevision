-- A second subject (M9). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select is((select count(*)::int from public.subjects where slug in ('maths', 'biology') and is_active), 2,
  'maths and biology are active subjects');
select is((select count(*)::int from public.topics t join public.subjects s on s.id = t.subject_id
           where s.slug = 'biology'), 33, 'biology has 33 topics');
select is((select count(*)::int from public.topics t join public.subjects s on s.id = t.subject_id
           where s.slug = 'biology' and t.separate_only), 10, '10 of them are Triple only');
select is((select count(*)::int from public.topics where separate_only and subject_id =
           (select id from public.subjects where slug = 'maths')), 0, 'no maths topic is separate only');
select is((select count(*)::int from public.topics b join public.topics m on m.slug = b.slug
           where b.subject_id = (select id from public.subjects where slug = 'biology')
             and m.subject_id = (select id from public.subjects where slug = 'maths')), 0,
  'no biology topic shares a slug with a maths topic');

-- Only this test's questions count, whatever has been imported (rolled back at the end)
update public.questions set status = 'draft';

-- Questions: higher-only on respiration, AQA-only on photosynthesis, a draft on ecosystems
create temp table t as
select (select id from public.subjects where slug = 'biology') as subject_id,
       (select id from public.topics where slug = 'respiration') as respiration,
       (select id from public.topics where slug = 'photosynthesis') as photosynthesis,
       (select id from public.topics where slug = 'ecosystems') as ecosystems,
       (select id from public.topics where slug = 'plant-hormones') as plant_hormones;

insert into public.questions (id, subject_id, topic_id, tier, calculator, type, prompt_md, answer_spec, solution_md, status)
select '00000000-0000-0000-0000-00000000b101'::uuid, subject_id, respiration, 'higher', 'either', 'mcq', 'Q1',
       '{"kind": "mcq", "correctIndex": 0}'::jsonb, 'S', 'published' from t
union all
select '00000000-0000-0000-0000-00000000b102', subject_id, photosynthesis, 'both', 'either', 'mcq', 'Q2',
       '{"kind": "mcq", "correctIndex": 0}'::jsonb, 'S', 'published' from t
union all
select '00000000-0000-0000-0000-00000000b103', subject_id, ecosystems, 'both', 'either', 'mcq', 'Q3',
       '{"kind": "mcq", "correctIndex": 0}'::jsonb, 'S', 'draft' from t
union all
select '00000000-0000-0000-0000-00000000b104', subject_id, plant_hormones, 'both', 'either', 'mcq', 'Q4',
       '{"kind": "mcq", "correctIndex": 0}'::jsonb, 'S', 'published' from t;
insert into public.question_boards (question_id, exam_board_id)
select '00000000-0000-0000-0000-00000000b102', id from public.exam_boards where slug = 'aqa';

select set_eq($$select public.topics_with_questions('biology', 'higher', 'aqa')$$,
  array['respiration', 'photosynthesis'], 'higher AQA players see both published topics');
select set_eq($$select public.topics_with_questions('biology', 'foundation', 'aqa')$$,
  array['photosynthesis'], 'higher-only questions are hidden from foundation');
select set_eq($$select public.topics_with_questions('biology', 'higher', 'ocr')$$,
  array['respiration'], 'board-only questions are hidden from other boards');
select set_eq($$select public.topics_with_questions('biology', 'higher')$$,
  array['respiration'], 'mixed boards only count questions valid for every board');
select ok(not exists (select 1 from public.topics_with_questions('biology', 'higher', 'aqa') s where s = 'ecosystems'),
  'drafts are ignored');
select set_eq($$select public.topics_with_questions('biology', 'higher', 'aqa', 'separate')$$,
  array['respiration', 'photosynthesis', 'plant-hormones'], 'Triple students also see Triple-only topics');

-- Science settings: players set their own, separately from maths
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated');
insert into public.profiles (id, username, avatar, tier, exam_board_id)
select '00000000-0000-0000-0000-0000000000d1', 'dana', 'fox', 'higher', id from public.exam_boards where slug = 'aqa';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.profiles set science_tier = 'foundation', science_course = 'combined',
  science_board_id = (select id from public.exam_boards where slug = 'edexcel')
  where id = '00000000-0000-0000-0000-0000000000d1'$$, 'a player can set their science settings');
reset role;
select results_eq($$select tier, science_tier, science_course from public.profiles
  where id = '00000000-0000-0000-0000-0000000000d1'$$,
  $$values ('higher'::text, 'foundation'::text, 'combined'::text)$$, 'science and maths tiers are separate');
select throws_ok($$update public.profiles set science_course = 'triple'
  where id = '00000000-0000-0000-0000-0000000000d1'$$, '23514', null, 'only combined or separate courses');

set local role anon;
select lives_ok($$select public.topics_with_questions('biology')$$, 'anyone can list available topics');
reset role;

select * from finish();
rollback;
