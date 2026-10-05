-- A second subject (M9). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is((select count(*)::int from public.subjects where slug in ('maths', 'biology') and is_active), 2,
  'maths and biology are active subjects');
select is((select count(*)::int from public.topics t join public.subjects s on s.id = t.subject_id
           where s.slug = 'biology'), 23, 'biology has its 23 topics');
select is((select count(*)::int from public.topics b join public.topics m on m.slug = b.slug
           where b.subject_id = (select id from public.subjects where slug = 'biology')
             and m.subject_id = (select id from public.subjects where slug = 'maths')), 0,
  'no biology topic shares a slug with a maths topic');

-- Questions: higher-only on respiration, AQA-only on photosynthesis, a draft on ecosystems
create temp table t as
select (select id from public.subjects where slug = 'biology') as subject_id,
       (select id from public.topics where slug = 'respiration') as respiration,
       (select id from public.topics where slug = 'photosynthesis') as photosynthesis,
       (select id from public.topics where slug = 'ecosystems') as ecosystems;

insert into public.questions (id, subject_id, topic_id, tier, calculator, type, prompt_md, answer_spec, solution_md, status)
select '00000000-0000-0000-0000-00000000b101'::uuid, subject_id, respiration, 'higher', 'either', 'mcq', 'Q1',
       '{"kind": "mcq", "correctIndex": 0}'::jsonb, 'S', 'published' from t
union all
select '00000000-0000-0000-0000-00000000b102', subject_id, photosynthesis, 'both', 'either', 'mcq', 'Q2',
       '{"kind": "mcq", "correctIndex": 0}'::jsonb, 'S', 'published' from t
union all
select '00000000-0000-0000-0000-00000000b103', subject_id, ecosystems, 'both', 'either', 'mcq', 'Q3',
       '{"kind": "mcq", "correctIndex": 0}', 'S', 'draft' from t;
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

set local role anon;
select lives_ok($$select public.topics_with_questions('biology')$$, 'anyone can list available topics');
reset role;

select * from finish();
rollback;
