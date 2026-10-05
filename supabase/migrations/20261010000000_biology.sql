-- A second subject: GCSE Biology (PLAN.md M9).
--
-- Reference data lives in a migration rather than seed.sql because the seed
-- only runs on a project's first deploy. Maths is inserted here too (if
-- missing) so subject ids are the same however the database was built.
--
-- Topics follow the content shared by the AQA, Edexcel and OCR Biology and
-- Combined Science specifications, grouped into strands. Questions are all
-- hand-written (content/questions/biology.csv).

insert into public.subjects (slug, name, is_active) values
  ('maths', 'Mathematics', true),
  ('biology', 'Biology', true)
on conflict (slug) do nothing;

insert into public.topics (subject_id, slug, name, strand, min_tier, needs_diagram, sort_order)
select s.id, t.slug, t.name, t.strand, 'foundation', false, t.sort_order
from public.subjects s
cross join (values
  -- Cell biology
  ('cell-structure',          'Cell structure',                   'cell-biology',  1000),
  ('microscopy',              'Microscopy',                       'cell-biology',  1001),
  ('cell-division',           'Cell division and stem cells',     'cell-biology',  1002),
  ('transport-in-cells',      'Diffusion, osmosis and active transport', 'cell-biology', 1003),
  -- Organisation
  ('digestion-enzymes',       'Digestion and enzymes',            'organisation',  1100),
  ('heart-and-blood',         'The heart and blood',              'organisation',  1101),
  ('non-communicable-disease','Non-communicable disease',         'organisation',  1102),
  ('plant-organisation',      'Plant tissues and transport',      'organisation',  1103),
  -- Infection and response
  ('communicable-disease',    'Communicable disease',             'infection',     1200),
  ('immunity-vaccination',    'Immunity and vaccination',         'infection',     1201),
  ('drugs-and-medicines',     'Drugs and medicines',              'infection',     1202),
  -- Bioenergetics
  ('photosynthesis',          'Photosynthesis',                   'bioenergetics', 1300),
  ('respiration',             'Respiration',                      'bioenergetics', 1301),
  -- Homeostasis and response
  ('nervous-system',          'The nervous system',               'homeostasis',   1400),
  ('hormones-blood-glucose',  'Hormones and blood glucose',       'homeostasis',   1401),
  ('reproductive-hormones',   'Hormones in reproduction',         'homeostasis',   1402),
  -- Inheritance, variation and evolution
  ('dna-and-reproduction',    'DNA and reproduction',             'inheritance',   1500),
  ('genetic-inheritance',     'Genetic inheritance',              'inheritance',   1501),
  ('evolution',               'Variation and evolution',          'inheritance',   1502),
  ('classification',          'Classification',                   'inheritance',   1503),
  -- Ecology
  ('ecosystems',              'Ecosystems and adaptations',       'ecology',       1600),
  ('material-cycles',         'Cycles and decomposition',         'ecology',       1601),
  ('biodiversity',            'Biodiversity and human impact',    'ecology',       1602)
) as t(slug, name, strand, sort_order)
where s.slug = 'biology'
on conflict (subject_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- topics_with_questions: the slugs of a subject's topics that have published
-- hand-written questions for a tier and board, so the topic picker can show
-- bank-only topics without reading the questions themselves. `p_board` null
-- means mixed boards (only questions valid for every board).
-- ---------------------------------------------------------------------------

create function public.topics_with_questions(
  p_subject text,
  p_tier text default null,
  p_board text default null
)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.slug
  from public.questions q
  join public.topics t on t.id = q.topic_id
  join public.subjects s on s.id = t.subject_id
  where s.slug = p_subject
    and q.status = 'published'
    and (p_tier is null or q.tier in ('both', p_tier))
    and (
      not exists (select 1 from public.question_boards qb where qb.question_id = q.id)
      or (
        p_board is not null
        and exists (
          select 1 from public.question_boards qb
          join public.exam_boards b on b.id = qb.exam_board_id
          where qb.question_id = q.id and b.slug = p_board
        )
      )
    );
$$;

revoke all on function public.topics_with_questions(text, text, text) from public;
grant execute on function public.topics_with_questions(text, text, text) to anon, authenticated, service_role;
