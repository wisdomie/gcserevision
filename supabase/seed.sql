-- Reference data: exam boards, subjects and the GCSE Maths topic taxonomy
-- (PLAN.md section 7). Loaded by `supabase db reset`.
--
-- Board rows carry only a slug and display name. Specification codes and
-- paper structures are deliberately not stored here until verified against
-- each board's current specification (PLAN.md 5.4).

insert into public.exam_boards (slug, name) values
  ('aqa', 'AQA'),
  ('edexcel', 'Pearson Edexcel'),
  ('ocr', 'OCR'),
  ('wjec-eduqas', 'WJEC Eduqas');

insert into public.subjects (slug, name, is_active) values
  ('maths', 'Mathematics', true);

-- Topics. Higher-only topics have min_tier = 'higher'; topics where a diagram
-- is essential have needs_diagram = true (deferred to M7).
insert into public.topics (subject_id, slug, name, strand, min_tier, needs_diagram, sort_order)
select s.id, t.slug, t.name, t.strand, t.min_tier, t.needs_diagram, t.sort_order
from public.subjects s
cross join (values
  -- Number
  ('place-value',               'Place value',                        'number',      'foundation', false, 100),
  ('four-operations',           'Four operations',                    'number',      'foundation', false, 101),
  ('factors-multiples-primes',  'Factors, multiples and primes',      'number',      'foundation', false, 102),
  ('hcf-lcm',                   'HCF and LCM',                        'number',      'foundation', false, 103),
  ('fractions',                 'Fractions',                          'number',      'foundation', false, 104),
  ('decimals',                  'Decimals',                           'number',      'foundation', false, 105),
  ('percentages',               'Percentages',                        'number',      'foundation', false, 106),
  ('powers-roots',              'Powers and roots',                   'number',      'foundation', false, 107),
  ('standard-form',             'Standard form',                      'number',      'foundation', false, 108),
  ('rounding-estimation',       'Rounding and estimation',            'number',      'foundation', false, 109),
  ('bounds',                    'Error intervals and bounds',         'number',      'higher',     false, 110),
  ('surds',                     'Surds',                              'number',      'higher',     false, 111),
  ('recurring-decimals',        'Recurring decimals',                 'number',      'higher',     false, 112),

  -- Algebra
  ('simplifying',               'Simplifying expressions',            'algebra',     'foundation', false, 200),
  ('expanding-factorising',     'Expanding and factorising',          'algebra',     'foundation', false, 201),
  ('substitution',              'Substitution',                       'algebra',     'foundation', false, 202),
  ('linear-equations',          'Linear equations',                   'algebra',     'foundation', false, 203),
  ('inequalities',              'Inequalities',                       'algebra',     'foundation', false, 204),
  ('sequences',                 'Sequences',                          'algebra',     'foundation', false, 205),
  ('straight-line-graphs',      'Straight-line graphs',               'algebra',     'foundation', true,  206),
  ('quadratics',                'Quadratics',                         'algebra',     'foundation', false, 207),
  ('completing-the-square',     'Completing the square',              'algebra',     'higher',     false, 208),
  ('simultaneous-equations',    'Simultaneous equations',             'algebra',     'foundation', false, 209),
  ('rearranging-formulae',      'Rearranging formulae',               'algebra',     'foundation', false, 210),
  ('functions',                 'Functions',                          'algebra',     'higher',     false, 211),
  ('algebraic-fractions',       'Algebraic fractions',                'algebra',     'higher',     false, 212),

  -- Ratio, proportion and rates of change
  ('ratio',                     'Ratio',                              'ratio',       'foundation', false, 300),
  ('proportion',                'Direct and inverse proportion',      'ratio',       'foundation', false, 301),
  ('compound-measures',         'Speed, density and pressure',        'ratio',       'foundation', false, 302),
  ('percentage-change',         'Percentage change',                  'ratio',       'foundation', false, 303),
  ('compound-interest',         'Compound interest',                  'ratio',       'foundation', false, 304),
  ('growth-decay',              'Growth and decay',                   'ratio',       'higher',     false, 305),

  -- Geometry and measures
  ('angles',                    'Angles',                             'geometry',    'foundation', false, 400),
  ('polygons',                  'Polygons',                           'geometry',    'foundation', false, 401),
  ('perimeter-area',            'Perimeter and area',                 'geometry',    'foundation', false, 402),
  ('circles',                   'Circles',                            'geometry',    'foundation', false, 403),
  ('volume-surface-area',       'Volume and surface area',            'geometry',    'foundation', false, 404),
  ('pythagoras',                'Pythagoras',                         'geometry',    'foundation', false, 405),
  ('trigonometry',              'Trigonometry',                       'geometry',    'foundation', false, 406),
  ('transformations',           'Transformations',                    'geometry',    'foundation', true,  407),
  ('similarity-congruence',     'Similarity and congruence',          'geometry',    'foundation', false, 408),
  ('vectors',                   'Vectors',                            'geometry',    'higher',     false, 409),
  ('circle-theorems',           'Circle theorems',                    'geometry',    'higher',     false, 410),
  ('constructions-loci',        'Constructions and loci',             'geometry',    'foundation', true,  411),

  -- Probability
  ('basic-probability',         'Basic probability',                  'probability', 'foundation', false, 500),
  ('tree-diagrams',             'Tree diagrams',                      'probability', 'foundation', true,  501),
  ('venn-diagrams',             'Venn diagrams',                      'probability', 'foundation', true,  502),
  ('conditional-probability',   'Conditional probability',            'probability', 'higher',     false, 503),

  -- Statistics
  ('averages',                  'Averages',                           'statistics',  'foundation', false, 600),
  ('charts-tables',             'Charts and tables',                  'statistics',  'foundation', true,  601),
  ('scatter-graphs',            'Scatter graphs',                     'statistics',  'foundation', true,  602),
  ('cumulative-frequency',      'Cumulative frequency',               'statistics',  'higher',     true,  603),
  ('histograms',                'Histograms',                         'statistics',  'higher',     true,  604),
  ('sampling',                  'Sampling',                           'statistics',  'foundation', false, 605)
) as t(slug, name, strand, min_tier, needs_diagram, sort_order)
where s.slug = 'maths';
