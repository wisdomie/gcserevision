# GCSE Past Paper Game: Build Plan

> **For Claude Code:** This is the source of truth for the project. Read it fully before writing code. Work through the milestones in order (section 14). After finishing each milestone, tick its checkboxes in this file, commit, and summarise what changed. Where this plan says "verify", check the library's current documentation first, because APIs change and this plan was written from memory.

---

## 1. Product summary

A mobile-first web game where GCSE students practise exam-style questions and compete with friends.

- **Launch subject:** GCSE Mathematics only. The architecture must make adding other subjects (Biology, Chemistry, Physics, English, etc.) a data change plus new question content, not a rewrite.
- **Exam boards:** AQA, Edexcel (Pearson), OCR, WJEC/Eduqas. Each player picks a board and tier (Foundation or Higher). Questions are tailored to that choice.
- **Core loop:** pick settings, answer questions, get instant marking with worked solutions, earn points, climb leaderboards.
- **Modes (in build order):**
  1. **Solo practice:** untimed or timed, with a worked solution after each question.
  2. **Live room:** 2–20 friends join with a 6-character code. Everyone gets the same question at the same time and faster correct answers score more.
  3. **Duel:** a 2-player live room that starts automatically when both are in.
  4. **Daily challenge:** the same 5 questions for everyone each day, with a friends leaderboard and streaks.

### Non-goals (for now)
- No teacher or classroom admin tools.
- No payments, ads or third-party tracking.
- No native mobile app (responsive web only; make it PWA-installable late on).
- No AI marking in v1. Maths is auto-marked by code. AI marking is a later phase for other subjects.

## 2. Content and copyright rules (important)

- **Do not copy real past-paper questions or mark schemes** from AQA, Edexcel, OCR or WJEC into the app or repo. They are copyrighted.
- Questions are either:
  - **Generated:** parameterised TypeScript generators that produce unlimited fresh questions (the main source), or
  - **Hand-written originals** in the *style* of GCSE questions, stored in the database.
- Questions may use exam-board *terminology and command words* (Work out, Show that, Simplify, Expand, Factorise, Solve, Estimate), because those are not copyrightable content.
- Board tailoring is done through **tags and filters** (section 5.4), not by reproducing board papers.

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js** (latest stable, App Router) + **TypeScript** (`strict: true`) | Server route handlers for the API |
| Styling | **Tailwind CSS** | Mobile-first, dark and light mode via CSS variables |
| Database, auth, realtime | **Supabase** (Postgres, Auth, Realtime) | Use the Supabase CLI for local dev and migrations |
| Hosting | **Vercel** (app) + Supabase cloud (data) | Free tiers are enough to start |
| Maths rendering | **KaTeX** | Render all maths from LaTeX strings |
| Maths input | **MathLive** (`mathlive`) | Web component; fall back to a plain text input toggle |
| Maths parsing and equivalence | **@cortex-js/compute-engine** (parses LaTeX, works with MathLive) and/or **mathjs** | Verify current API before using |
| Validation | **zod** | For all API inputs and the `AnswerSpec` type |
| Tests | **Vitest** (unit and property tests), **Playwright** (e2e) | |
| Package manager | **pnpm** | |
| Lint and format | ESLint, Prettier | Enforce in CI |
| CI | GitHub Actions: lint, typecheck, test, build | |

### 3.1 Repository layout

```
/
├─ PLAN.md
├─ README.md
├─ package.json
├─ .env.example
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/           # SQL migrations, timestamped
│  └─ seed.sql              # boards, subjects, topics
├─ src/
│  ├─ app/                  # Next.js routes (section 9)
│  │  ├─ (marketing)/
│  │  ├─ (auth)/
│  │  ├─ play/
│  │  ├─ rooms/
│  │  ├─ leaderboard/
│  │  ├─ profile/
│  │  └─ api/
│  ├─ components/
│  │  ├─ ui/                # buttons, cards, inputs
│  │  ├─ math/              # <Math/>, <MathInput/>
│  │  └─ game/              # <QuestionCard/>, <Timer/>, <Scoreboard/>
│  ├─ lib/
│  │  ├─ supabase/          # browser client, server client, service-role client
│  │  ├─ engine/
│  │  │  ├─ rng.ts          # seeded PRNG (mulberry32)
│  │  │  ├─ types.ts        # AnswerSpec, GeneratedQuestion, PublicQuestion
│  │  │  ├─ answers/        # normalise.ts, check.ts, expression.ts
│  │  │  ├─ generators/     # registry.ts + one folder per strand
│  │  │  └─ scoring.ts
│  │  └─ game/              # room state machine helpers, server clock
│  └─ types/
└─ tests/
   ├─ engine/               # checker + generator property tests
   └─ e2e/                  # Playwright
```

### 3.2 Environment variables (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, never exposed to the client
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3.3 GitHub and Claude cloud workflow

The project lives in a **private GitHub repository** so it can be worked on from Claude Code on the web (Claude's cloud compute) as well as locally. The repo is the single source of truth, and the local folder and cloud sessions both sync through it.

**Repo setup**
- Private repo, default branch `main`. Commit `PLAN.md` first so every session starts with it.
- Add a `.gitignore` before the first install (`node_modules`, `.next`, `.env*` except `.env.example`, `supabase/.branches`, `supabase/.temp`, `playwright-report`, `test-results`, `.vercel`).
- **Never commit secrets.** Only `.env.example` (empty values) goes in the repo. Real keys live in Vercel, Supabase, and the Claude cloud environment's own secret/environment-variable settings.
- Add a short `CLAUDE.md` at the repo root (created in M0) that says: "Read PLAN.md first; follow section 17", plus the commands for install, dev, test, lint and typecheck, so each fresh cloud session knows how to run the project.

**Branches and pull requests**
- `main` is protected: changes arrive by pull request, and CI (section 3 / M0) must pass before merge.
- One branch per milestone or sub-task, named like `m1-engine-core`, `m2-solo-mode`. Cloud sessions push to their branch and open a PR. The user reviews and merges.
- Small, reviewable PRs. Do not mix unrelated milestones in one PR.

**What works in a cloud session, and what to plan for** (verify against current Claude Code on the web docs)
- Cloud sessions start from a fresh clone, so everything needed to run the project must be in the repo or the environment config: lockfile committed, setup commands documented in `CLAUDE.md`.
- Outbound network access is limited by an allowlist. npm and GitHub work. Check that `*.supabase.co` is reachable, and if not, add it to the environment's allowed domains.
- **Docker is probably unavailable in the cloud sandbox**, so `supabase start` (local Supabase) may not run there. Plan for this:
  - Unit and property tests (the `engine/`) need no database and run anywhere. Write most logic as pure functions (already the plan).
  - Integration tests that need Postgres run in **GitHub Actions** (which has Docker, using the Supabase CLI) and/or against a **hosted Supabase "dev" project** whose keys are set as environment variables in the cloud environment.
  - Keep a separate hosted Supabase project for dev and one for production, never share keys.
- Playwright E2E needs a browser. Use the pre-installed Chromium where available, otherwise run E2E in GitHub Actions.
- The user can start a cloud session from the repo, hand it a milestone ("do M1 from PLAN.md"), and come back to a PR.

**GitHub Actions workflows** (`.github/workflows/`)
- `ci.yml`: on every PR and push to `main`: install (pnpm, cached), lint, typecheck, unit and property tests, build.
- `integration.yml`: starts local Supabase with the Supabase CLI, applies migrations and seed, runs integration and Playwright tests.
- Optional: Vercel's GitHub integration for automatic preview deployments per PR.

## 4. Architecture principles

1. **Answers never reach the client before they are due.** The client receives a `PublicQuestion` (prompt, input type, options, marks). Answer specs and worked solutions live in a server-only table and are revealed only after a question closes (live) or after submission (solo).
2. **The server marks everything.** The client sends the raw answer string. A route handler runs the shared answer checker using the service-role client and returns the result.
3. **The server owns the clock.** Live-room timing uses server timestamps (`question_started_at`, `question_ends_at`). Clients display a countdown from a measured server-time offset but never decide timing.
4. **Subjects, boards and topics are data.** No `if (subject === 'maths')` in game logic. Question types and generators are looked up by key from a registry.
5. **Pure game logic is isolated.** Scoring, answer checking, generators and the room state machine are pure functions with unit tests, with no Supabase or React imports.
6. **Deterministic generators.** `generate(rng)` with a seeded RNG, so the same seed always yields the same question. The seed is stored so a question can be reproduced for debugging.

## 5. Data model

### 5.1 Tables (Postgres)

Write these as migrations under `supabase/migrations/`. Enable RLS on every table.

```sql
-- Reference data
create table exam_boards (
  id smallint generated always as identity primary key,
  slug text unique not null,            -- 'aqa' | 'edexcel' | 'ocr' | 'wjec-eduqas'
  name text not null
);

create table subjects (
  id smallint generated always as identity primary key,
  slug text unique not null,            -- 'maths'
  name text not null,
  is_active boolean not null default false
);

create table topics (
  id integer generated always as identity primary key,
  subject_id smallint not null references subjects(id),
  parent_id integer references topics(id),
  slug text not null,                   -- 'fractions'
  name text not null,                   -- 'Fractions'
  strand text,                          -- 'number' | 'algebra' | 'ratio' | 'geometry' | 'probability' | 'statistics'
  min_tier text not null default 'foundation' check (min_tier in ('foundation','higher')),
  needs_diagram boolean not null default false,
  sort_order int not null default 0,
  unique (subject_id, slug)
);

-- Hand-written question bank (generated questions live in code)
create table questions (
  id uuid primary key default gen_random_uuid(),
  subject_id smallint not null references subjects(id),
  topic_id integer not null references topics(id),
  tier text not null check (tier in ('foundation','higher','both')),
  calculator text not null check (calculator in ('calc','non-calc','either')),
  type text not null,                   -- 'mcq' | 'numeric' | 'expression' | ...
  marks smallint not null default 1,
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  prompt_md text not null,              -- markdown with $...$ LaTeX
  options jsonb,                        -- for mcq
  answer_spec jsonb not null,           -- AnswerSpec (section 6.2)
  solution_md text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table question_boards (          -- empty = valid for ALL boards
  question_id uuid references questions(id) on delete cascade,
  exam_board_id smallint references exam_boards(id),
  primary key (question_id, exam_board_id)
);

-- Users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  avatar text,                          -- emoji or preset key, no uploads
  exam_board_id smallint references exam_boards(id),
  tier text check (tier in ('foundation','higher')),
  xp integer not null default 0,
  created_at timestamptz not null default now()
);

-- Question instances: one concrete question as shown to players
create table question_instances (       -- PUBLIC payload (readable by game participants via API only)
  id uuid primary key default gen_random_uuid(),
  subject_id smallint not null references subjects(id),
  topic_id integer not null references topics(id),
  source_question_id uuid references questions(id),
  generator_key text,                   -- e.g. 'number.fractions.add'
  seed bigint,
  tier text not null,
  calculator text not null,
  marks smallint not null,
  public_payload jsonb not null,        -- PublicQuestion
  created_at timestamptz not null default now()
);

create table question_secrets (         -- SERVER ONLY: no client RLS policies at all
  instance_id uuid primary key references question_instances(id) on delete cascade,
  answer_spec jsonb not null,
  solution jsonb not null               -- { steps: string[], final: string }
);

-- Solo
create table solo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  settings jsonb not null,              -- subject, board, tier, topics, count, timed
  score integer not null default 0,
  streak_best integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Live rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code char(6) unique not null,
  host_id uuid not null references profiles(id),
  mode text not null check (mode in ('room','duel')),
  subject_id smallint not null references subjects(id),
  exam_board_id smallint references exam_boards(id),   -- null = mixed boards
  tier text not null check (tier in ('foundation','higher')),
  topic_ids integer[] not null default '{}',           -- empty = all topics
  question_count smallint not null default 10,
  seconds_per_question smallint not null default 30,
  status text not null default 'lobby'
    check (status in ('lobby','question','reveal','finished')),
  current_index smallint not null default -1,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table room_players (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score integer not null default 0,     -- updated only at reveal (no mid-question leaks)
  streak smallint not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table room_questions (
  room_id uuid references rooms(id) on delete cascade,
  idx smallint not null,
  instance_id uuid not null references question_instances(id),
  primary key (room_id, idx)
);

-- Answers (both modes)
create table answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  instance_id uuid not null references question_instances(id),
  room_id uuid references rooms(id) on delete cascade,
  solo_session_id uuid references solo_sessions(id) on delete cascade,
  raw_answer text not null,
  is_correct boolean not null,
  marks_awarded smallint not null default 0,
  time_ms integer,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  check ((room_id is not null) <> (solo_session_id is not null)),
  unique (user_id, instance_id, room_id),                -- one answer per live question
  unique (user_id, instance_id, solo_session_id)
);

-- Aggregates for "weak topics" and leaderboards
create table topic_stats (
  user_id uuid references profiles(id) on delete cascade,
  topic_id integer references topics(id),
  attempts integer not null default 0,
  correct integer not null default 0,
  last_seen timestamptz,
  primary key (user_id, topic_id)
);

-- Phase 5
create table daily_challenges (
  challenge_date date primary key,
  subject_id smallint not null references subjects(id),
  instance_ids uuid[] not null
);
```

### 5.2 Row Level Security (RLS) rules

- `exam_boards`, `subjects`, `topics`: readable by everyone, no client writes.
- `questions`: **no client access** (server only). Players only ever see `question_instances.public_payload` through API routes.
- `question_secrets`: **no policies**, so only the service-role key can touch it.
- `profiles`: any authenticated user can read `id, username, avatar` (for leaderboards). Only the owner can insert or update their own row. Never expose email.
- `rooms`, `room_players`: readable by members of that room (a user with a `room_players` row), plus a lookup-by-code through an API route for joining. Writes only through API routes (service role).
- `answers`: clients cannot read or write directly. Reveal data is returned through API routes only for closed questions.
- `solo_sessions`, `topic_stats`: owner read only. Writes through API routes.

### 5.3 Realtime

- Subscribe clients to Postgres changes on `rooms` (filtered by `id`) and `room_players` (filtered by `room_id`).
- Use Supabase **Broadcast** for ephemeral "player X locked in an answer" events. These carry no correctness info.
- Scores in `room_players` change **only** during the reveal transition, so the live scoreboard cannot leak who is right mid-question.

### 5.4 Board and tier tailoring

- Each question (hand-written or generator) declares: `tier` (`foundation` | `higher` | `both`), `calculator` (`calc` | `non-calc` | `either`) and `boards` (a list of board slugs, or `all`).
- **Selection query for a game:** `subject = X AND topic IN (...) AND (tier = chosen OR tier = 'both') AND (boards = 'all' OR chosen board IN boards)`. For a Foundation player, Higher-only topics are excluded entirely. A Higher player gets both tiers, weighted toward harder difficulties.
- **Mixed-board rooms** (`exam_board_id = null`) use only questions tagged `all` boards.
- Most Maths content is identical across boards because it all comes from the same DfE content. Board-specific tagging is for differences in notation, formula-sheet assumptions and paper style. Keep the board lists accurate but do not invent differences.
- **Verify before seeding:** current specification codes and paper structures for each board (for example AQA 8300, Edexcel 1MA1, OCR J560 and J567). Do not hard-code claims about calculator-paper structure without checking each board's current spec.

## 6. Question engine

### 6.1 Types (`src/lib/engine/types.ts`)

```ts
export type Tier = 'foundation' | 'higher';
export type CalcMode = 'calc' | 'non-calc' | 'either';
export type BoardSlug = 'aqa' | 'edexcel' | 'ocr' | 'wjec-eduqas';

export interface Rng {
  next(): number;                       // [0,1)
  int(min: number, max: number): number; // inclusive
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
}

export interface GeneratedQuestion {
  promptMd: string;                     // markdown + $LaTeX$
  inputType: 'mcq' | 'numeric' | 'expression' | 'fraction' | 'multi';
  options?: string[];                   // mcq only (already shuffled)
  answerSpec: AnswerSpec;
  solution: { steps: string[]; final: string };  // markdown + LaTeX
}

export interface QuestionGenerator {
  key: string;                          // 'number.fractions.add'
  topicSlug: string;
  tiers: Tier[];                        // which tiers it is suitable for
  calculator: CalcMode;
  marks: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  boards: BoardSlug[] | 'all';
  needsDiagram?: boolean;
  generate(rng: Rng): GeneratedQuestion;
}

// What the client is allowed to see
export interface PublicQuestion {
  instanceId: string;
  promptMd: string;
  inputType: GeneratedQuestion['inputType'];
  options?: string[];
  marks: number;
  calculator: CalcMode;
  topicName: string;
}
```

### 6.2 `AnswerSpec` (zod discriminated union)

```ts
type AnswerSpec =
  | { kind: 'mcq'; correctIndex: number }
  | { kind: 'integer'; value: number }
  | { kind: 'decimal'; value: number; dp?: number; sf?: number; tolerance?: number; unit?: string }
  | { kind: 'fraction'; num: number; den: number; mustBeSimplest: boolean; allowMixed?: boolean }
  | { kind: 'percentage'; value: number }
  | { kind: 'expression'; latex: string; variables: string[]; form?: 'any' | 'expanded' | 'factorised' | 'simplified' }
  | { kind: 'solutions'; variable: string; values: number[] }   // order-independent set, e.g. x = 2 or x = -3
  | { kind: 'ratio'; parts: number[] }
  | { kind: 'standardForm'; mantissa: number; exponent: number }
  | { kind: 'multi'; parts: { label: string; spec: AnswerSpec }[]; marksPerPart?: number[] };
```

### 6.3 Answer checker (`src/lib/engine/answers/`)

`check(spec: AnswerSpec, raw: string): { correct: boolean; marksAwarded: number; feedback?: string }`

**Normalisation (applies to every kind):** trim; collapse whitespace; convert the Unicode minus `−` to `-`; replace `×`/`x` between numbers with `*` where context is numeric; strip thousands commas in numbers; strip a leading `£`/`$` and trailing `%`/units when the spec expects them; accept `x = 3` as `3` when the spec has a `variable`.

**Behaviour rules:**
- **integer / decimal:** parse the number. Accept if numerically equal within `tolerance` (default 0). If `dp`/`sf` is set, the correct answer is the rounded value; accept it with or without trailing zeros. A more precise or less precise answer is incorrect (rounding is usually the point of the question).
- **fraction:** accept `a/b`, mixed numbers (if allowed) and LaTeX `\frac{a}{b}`. If `mustBeSimplest`, an unsimplified equivalent is **incorrect** and the feedback says "Simplify your answer". If not required, accept any equivalent. Never accept a decimal when a fraction is demanded unless the spec allows it.
- **percentage:** accept with or without `%`.
- **expression:** parse the player's LaTeX (from MathLive) and the reference. Equivalence is tested by **evaluating both at 8 or more random numeric points** (avoid singularities, compare with a relative tolerance of about 1e-9). Then apply the `form` constraint: `expanded` means no product of sums remains, `factorised` means the top-level structure is a product and it is not just a sum, `simplified` means like terms are combined. Form checking is best-effort; document its limits and keep the tests strict.
- **solutions:** parse values from `x=2 or x=-3`, `2, -3`, `-3 and 2`. The set must match exactly, in any order, with no extras.
- **mcq:** compare the selected index.
- **multi:** check each part and award partial marks.
- Never throw on garbage input. Return `{ correct: false, feedback: 'Could not read your answer' }`.

**Required test cases** (add many more, in `tests/engine/check.test.ts`):

| Spec | Input | Expected |
|---|---|---|
| fraction 1/2, simplest | `1/2`, `\frac{1}{2}` | correct |
| fraction 1/2, simplest | `2/4` | incorrect, feedback "Simplify" |
| fraction 1/2, not required | `2/4` | correct |
| fraction 1/2 | `0.5` | incorrect (decimal not allowed) |
| decimal 3.14 (2 dp) | `3.14`, `3.140` | correct |
| decimal 3.14 (2 dp) | `3.1`, `3.142` | incorrect |
| integer -7 | `−7`, `-7`, ` -7 ` | correct |
| integer 1000 | `1,000` | correct |
| expression `2x+4` (any form) | `4+2x`, `2(x+2)` | correct |
| expression `2(x+2)` (factorised) | `2x+4` | incorrect (wrong form) |
| expression `x^2-4` (expanded) | `(x-2)(x+2)` | incorrect (wrong form) |
| solutions x ∈ {2, -3} | `x=2 or x=-3`, `-3, 2` | correct |
| solutions x ∈ {2, -3} | `2` | incorrect |
| standardForm 4.5×10^3 | `4.5 \times 10^{3}`, `4.5e3` | correct |
| any | `""`, `abc`, `1/0` | incorrect, no throw |

### 6.4 Generators

- One file per generator in `src/lib/engine/generators/<strand>/<topic>.ts`. Register each in `registry.ts`, which exposes `getGenerator(key)`, `listGenerators(filter)`.
- **Quality rules every generator must obey** (enforced by the property test in section 12):
  - Deterministic for a given seed.
  - Numbers are "nice" (no ugly recurring decimals unless the question is about them; no negative areas; fractions reduce sensibly).
  - The `solution.final` passes the checker for `answerSpec`.
  - MCQ options are unique, plausible distractors based on **common mistakes** (e.g. add the denominators instead of finding a common one), and the correct answer appears exactly once.
  - Difficulty is honest: level 1 is a single step, level 5 is multi-step.
  - No question text is copied from any exam paper.

**Phase 1 generator list (about 24, all text-only, no diagrams needed):**

| Strand | Topic | Generator keys |
|---|---|---|
| Number | Fractions | `number.fractions.add`, `number.fractions.multiply`, `number.fractions.divide`, `number.fractions.of-amount` |
| Number | Percentages | `number.percent.of`, `number.percent.change`, `number.percent.reverse` (higher) |
| Number | HCF/LCM/primes | `number.hcf`, `number.lcm`, `number.prime-factors` |
| Number | Rounding | `number.round.dp`, `number.round.sf`, `number.estimate` |
| Number | Powers and standard form | `number.indices.laws`, `number.standard-form.convert`, `number.standard-form.calc` |
| Algebra | Expressions | `algebra.simplify`, `algebra.expand.single`, `algebra.expand.double`, `algebra.factorise.common`, `algebra.factorise.quadratic` |
| Algebra | Equations | `algebra.solve.linear-two-step`, `algebra.solve.unknown-both-sides`, `algebra.solve.quadratic` (higher) |
| Algebra | Other | `algebra.substitute`, `algebra.nth-term`, `algebra.rearrange` |
| Ratio | Ratio and proportion | `ratio.share`, `ratio.simplify`, `ratio.speed-distance-time` |
| Probability | Basics | `probability.single-event`, `probability.two-events-and` |
| Statistics | Averages | `stats.mean`, `stats.median-range`, `stats.mean-from-total` |

## 7. Maths topic taxonomy (seed data)

Seed `topics` from the DfE GCSE Maths strands. Mark `min_tier = 'higher'` on higher-only topics and `needs_diagram = true` where a diagram is essential (these are deferred to Milestone 7).

- **Number:** place value, four operations, factors/multiples/primes, HCF and LCM, fractions, decimals, percentages, powers and roots, standard form, rounding and estimation, error intervals and bounds (higher), surds (higher), recurring decimals (higher).
- **Algebra:** simplifying, expanding and factorising, substitution, linear equations, inequalities, sequences, straight-line graphs *(diagram)*, quadratics (factorise, solve, formula), completing the square (higher), simultaneous equations, rearranging formulae, functions (higher), algebraic fractions (higher).
- **Ratio, proportion and rates of change:** ratio, direct and inverse proportion, speed/density/pressure, percentage change, compound interest, growth and decay (higher).
- **Geometry and measures:** angles, polygons, perimeter and area, circles, volume and surface area, Pythagoras, trigonometry, transformations *(diagram)*, similarity and congruence, vectors (higher), circle theorems (higher), constructions and loci *(diagram)*.
- **Probability:** basic probability, tree diagrams *(diagram)*, Venn diagrams *(diagram)*, conditional probability (higher).
- **Statistics:** averages, charts and tables *(diagram)*, scatter graphs *(diagram)*, cumulative frequency (higher, *diagram*), histograms (higher, *diagram*), sampling.

## 8. Scoring (`src/lib/engine/scoring.ts`, pure and unit-tested)

**Live rooms and duels**
```
if not correct:           points = 0
fraction_of_time = clamp(elapsed_ms / (seconds_per_question * 1000), 0, 1)
base   = round(1000 * (1 - 0.5 * fraction_of_time))   // 1000 down to 500
partial = marksAwarded / totalMarks                    // multi-mark questions
streakBonus = min(500, 100 * max(0, streakAfterThisAnswer - 2))
points = round(base * partial) + (correct ? streakBonus : 0)
```
- `elapsed_ms` = server receive time minus `question_started_at`, minus a 300 ms latency grace (floored at 0).
- Answers received after `question_ends_at` plus a 500 ms grace are rejected.
- A wrong or missing answer resets the streak to 0.
- Duel tie-break: lower total `time_ms` across correct answers wins.

**Solo:** `points = 100 * marksAwarded + streakBonus`. If the optional timer is on, apply the same time formula. Solo sessions update `topic_stats` and `profiles.xp`.

## 9. Screens and routes

| Route | Purpose |
|---|---|
| `/` | Landing page: one-line pitch, "Play now", "Join a room" code box |
| `/login` | Sign in or sign up (section 11) |
| `/onboarding` | Pick username, avatar, exam board, tier. Editable later in `/profile` |
| `/play` | Hub: Solo, Create room, Join room, Daily challenge, Topic stats |
| `/play/solo` | Setup: topics (multi-select by strand), question count, timed toggle |
| `/play/solo/[sessionId]` | The question loop, then a results summary |
| `/rooms/new` | Host settings: board (or mixed), tier, topics, count, seconds per question |
| `/rooms/[code]` | One page, four states driven by `rooms.status`: lobby, question, reveal, finished |
| `/leaderboard` | Friends (people you have played with), weekly XP, daily streaks |
| `/profile` | Edit board, tier, avatar. Topic strengths and weaknesses |

**UX requirements**
- Mobile-first with large tap targets (at least 44px) and no horizontal scroll at 360px width.
- `<MathInput>` has a visible toggle to a plain text field, and the answer box matches `inputType`.
- Show the worked solution after each solo answer. In live rooms, show the correct answer and a short solution at reveal.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`. Colour is never the only indicator of correct or wrong.
- Everything is keyboard-operable with visible focus states. Use semantic HTML and ARIA labels on the timer and scoreboard.
- Friendly, encouraging copy suitable for 14–16-year-olds. No dark patterns or guilt-trip streak messaging.

## 10. API routes (Next.js route handlers, `src/app/api/`)

All inputs validated with zod. All routes require an authenticated user unless noted. Use the service-role client only inside route handlers.

| Method and path | Purpose |
|---|---|
| `POST /api/solo/start` | Create a `solo_sessions` row and the first instance. Returns a `PublicQuestion` |
| `POST /api/solo/answer` | `{ sessionId, instanceId, raw }` returns `{ correct, marksAwarded, points, solution, next?: PublicQuestion }` |
| `POST /api/rooms` | Create a room. Generates a 6-character code from an unambiguous alphabet (no `O/0/I/1/L`). Pre-generates all `question_instances` and `room_questions` |
| `POST /api/rooms/join` | `{ code }` adds a `room_players` row (reject if the room is not in lobby, is full, or the code is unknown) |
| `POST /api/rooms/[code]/start` | Host only. Moves to `question` with `current_index = 0` and sets `question_started_at/ends_at` |
| `POST /api/rooms/[code]/answer` | `{ instanceId, raw }`. Validates room status, instance match, deadline. Inserts the answer (unique constraint blocks duplicates), marks it, stores points. Returns only `{ accepted: true }` |
| `POST /api/rooms/[code]/advance` | Idempotent. Takes `{ fromIndex }`. Succeeds if the question timer has expired **or** all players have answered. Callable by **any** player, so a host disconnect cannot stall the game. Calls the DB function `finalize_question(room_id, idx)` to add points to `room_players` and move to `reveal` |
| `GET /api/rooms/[code]/reveal` | Only returns data for questions already closed: correct answer, solution, each player's result and points |
| `POST /api/rooms/[code]/next` | Idempotent. After a reveal period (about 6 s) moves to the next question or `finished` |
| `POST /api/rooms/[code]/leave` | Remove self from the room |
| `GET /api/time` | Returns server `Date.now()` for client clock-offset calibration |

**Room state machine**
```
lobby --start--> question(idx) --(timer expired | all answered)--> reveal(idx)
reveal(idx) --(idx+1 < count)--> question(idx+1)
reveal(idx) --(idx+1 == count)--> finished
```
- `finalize_question` and `advance` must be **idempotent** (guard on `current_index` and `status`) because several clients may call them at once.
- Write `finalize_question` as a Postgres function so score updates and the status change happen in one transaction.

## 11. Auth, privacy and safety

- **Auth:** use Supabase Auth with **anonymous sign-in** for "quick play" (name only), plus an optional upgrade to email magic link or Google so streaks and stats persist. Verify the current Supabase anonymous-auth support.
- Users are mostly 14–16. Follow the UK **Children's Code** (age-appropriate design) principles: collect the minimum data, no behavioural tracking or ads, no public profiles beyond username and avatar, high privacy defaults, no chat or free-text messaging between players in v1.
- Usernames pass a profanity filter. Avatars are presets or emoji, with no image uploads.
- Add a short privacy notice page and a "delete my account and data" button that cascades the deletes.
- **Rate limiting:** limit answer submission and room creation per user and IP. Reject answers over 200 characters.
- **Anti-cheat:** answers and solutions are server-only until closed. Per-user unique answer constraint. Scores update only at reveal. Do not trust any client timing.
- Room codes are single-use per game and expire when a room finishes or after 3 hours idle (cleanup scheduled job).

## 12. Testing strategy

1. **Unit tests (Vitest):** answer checker (the table in 6.3 and more), scoring edge cases, RNG determinism, state-machine transitions.
2. **Generator property tests**, run for every registered generator over 500 seeds:
   - Same seed gives the identical question.
   - `inputType` matches `answerSpec.kind`.
   - `solution.final` passes `check(answerSpec, solution.final)`.
   - MCQ: 4 unique options, exactly one correct, none duplicated after normalisation.
   - Prompt contains no `NaN`, `undefined`, `Infinity` or `-0`.
   - Numeric answers are within sane bounds (e.g. under 1e6, and non-negative where the context requires).
3. **Integration tests:** API routes against a local Supabase (answer too late is rejected, double submit is rejected, non-host cannot start, `advance` called twice is safe, answers are not readable via the client).
4. **E2E (Playwright):** solo flow, and a two-browser-context live-room flow (create, join, play 3 questions, see the winner).
5. **CI gate:** lint, typecheck, unit and property tests, and build must pass before merge.

## 13. Deployment

- Create the Supabase project and apply migrations (`supabase db push`).
- Create the Vercel project and set the environment variables from section 3.2.
- Preview deployments per branch, with the production branch protected.
- Add basic error monitoring (e.g. Sentry free tier) in Milestone 8, with PII scrubbing.

## 14. Milestones (work in this order)

Each milestone ends with: tests passing, checklist ticked here, and a commit.

### M0: Project setup
- [x] Connect the project folder to the GitHub repo (section 3.3): `git init` or clone, add `.gitignore`, commit `PLAN.md`, push `main`
- [ ] Add `CLAUDE.md` (pointer to this plan plus run/test commands) and protect `main` (PRs plus passing CI required)
  - `CLAUDE.md` done. **User action:** protect `main` in GitHub settings (require PR + `CI` check).
- [x] Initialise Next.js + TypeScript (strict) + Tailwind + ESLint + Prettier with pnpm
- [x] Add Vitest and Playwright config; GitHub Actions `ci.yml` and `integration.yml` (section 3.3)
- [x] `supabase init`; local Supabase running; `.env.example`
  - Verified by `integration.yml` (full stack, `db reset`, pgTAP RLS tests). The cloud sandbox can't pull the Supabase images, so run database work in CI there.
- [x] Migrations for all tables in section 5.1, with RLS per section 5.2
- [x] `seed.sql`: the four exam boards, the `maths` subject (active), the topic taxonomy from section 7
- [x] Supabase clients (browser, server, service-role) in `src/lib/supabase/`
- [ ] Deploy an empty app to Vercel
  - **User action:** import the repo in Vercel and set the env vars from section 3.2.

**Done when:** the repo is on GitHub with `main` protected, a fresh clone runs with the commands in `CLAUDE.md`, the app deploys, CI is green, and `supabase db reset` rebuilds the database with seed data.

### M1: Engine core
- [x] `rng.ts` (mulberry32) with `int`, `pick`, `shuffle`
- [x] `types.ts` and zod schema for `AnswerSpec`
- [x] Answer checker for `integer`, `decimal`, `fraction`, `percentage`, `mcq`, with tests from 6.3
- [x] `scoring.ts` with tests
- [x] Generator registry and the first 8 generators (fractions, percentages, rounding, HCF/LCM)
- [x] Generator property test harness running over all registered generators

**Done when:** all unit and property tests pass over 500 seeds per generator.

### M2: Solo mode, MVP
- [x] Auth plus `/onboarding` (username, avatar, board, tier)
- [x] `/play/solo` setup, session start/answer routes, question loop UI with `<Math>` rendering
- [x] Question selection by board, tier and topic (section 5.4)
- [x] Worked solution shown after each answer; results summary screen
- [x] Update `topic_stats` and `xp`
- [x] Remaining Phase 1 generators (about 24 total)
  - 29 generators. The 6 expression-answer ones (simplify, expand, factorise, rearrange) come with the expression checker in M3; see DECISIONS.md.

**Done when:** a new user can sign up, choose AQA Higher, play a 10-question Algebra session, and see correct marking and solutions on a phone-sized screen.

### M3: Maths input and expression checking
- [x] `<MathInput>` with MathLive and a text-input toggle
- [x] `expression`, `solutions`, `standardForm`, `ratio` and `multi` checkers with tests, including the form constraints
- [x] Add expression-answer generators (expand, factorise, simplify, rearrange)

**Done when:** the checker test table passes in full and typing `2x+4`, `4+2x` and `2(x+2)` behaves as specified.

### M4: Accounts, profiles and leaderboards
- [ ] `/profile` (edit board and tier), weak-topic view from `topic_stats`
- [ ] Weekly XP leaderboard and a "people I've played with" friends list
- [ ] Account deletion and the privacy page

**Done when:** a user can see their strongest and weakest topics and delete their account and data.

### M5: Live rooms
- [ ] Room creation, join by code, lobby with a live player list (Realtime)
- [ ] Server clock offset and `<Timer>`
- [ ] Question, reveal and finished states per the state machine in section 10
- [ ] `answer`, `advance`, `next`, `reveal`, `leave` routes; `finalize_question` DB function
- [ ] Live scoreboard updated at reveal, with podium on finish
- [ ] Duel mode on top of the room code path
- [ ] Integration and two-browser E2E tests

**Done when:** 4 real phones can play a 10-question room with no desyncs, with a host who closes their tab mid-game not stalling it.

### M6: Daily challenge and streaks
- [ ] Scheduled job (Supabase cron or Vercel cron) creates `daily_challenges` each day
- [ ] Daily play screen, results, friends leaderboard, streak counter (a daily attempt is a `solo_sessions` row with `settings.mode = 'daily'`, one per user per date, so `answers` keeps its solo/room constraint)
- [ ] Shareable result card (a text summary the user can copy)

### M7: Diagrams and geometry/statistics topics
- [ ] A diagram component (inline SVG, or JSXGraph) with a typed `diagram` field on `GeneratedQuestion`
- [ ] Generators for angles, Pythagoras, area, trigonometry, straight-line graphs, charts, scatter graphs

### M8: Polish and hardening
- [ ] PWA manifest and offline shell
- [ ] Sound effects (mutable), subtle animations (respecting reduced motion)
- [ ] Rate limiting, error monitoring, accessibility audit (axe), Lighthouse pass on mobile
- [ ] Hand-written word-problem bank (about 100 originals) loaded via a CSV importer script

### M9: Second subject (proof the architecture works)
- [ ] Add Biology (or Chemistry) rows to `subjects` and `topics`
- [ ] Multiple-choice and keyword-match question types for recall-style questions
- [ ] Optional: AI-marked longer answers through the Claude API, with a per-user daily cap, caching and a clear "marked by AI" label

## 15. Definition of done for the MVP (M0–M5)

1. A new user can sign up, choose an exam board and tier, and play solo Maths on their phone.
2. Questions are correctly tailored to the selected tier, and to the board where tagged.
3. A group of friends can join a live room by code, play, and see a final leaderboard.
4. All marking is server-side, and answers cannot be read from the client before a question closes.
5. CI is green, with at least 90% coverage of the `engine/` directory.

## 16. Open decisions (default shown, confirm with the user if it matters)

- **Project name:** working title "Past Paper Game". Ask before branding.
- **Auth methods:** anonymous quick-play plus email magic link. Add Google later if wanted.
- **Max players per room:** default 20.
- **Hosting accounts:** assume the user will create their own Supabase and Vercel accounts and paste in the keys.
- **Real past-paper content:** excluded by default (section 2). Revisit only if the user obtains permission.

## 17. Working agreement for Claude Code

1. Start with M0. Do not skip ahead, and do not build live rooms before the engine is tested.
2. Make small commits with clear messages, one per checklist item or small group of items. Work on a branch per milestone and open a pull request into `main`; do not push directly to `main`.
3. Before using Next.js, Supabase, MathLive, Compute Engine or Playwright APIs, **check the current docs**. Do not rely on memory.
4. Never put the service-role key or any answer spec in client-side code or the browser bundle. Add a test or lint check for this.
5. When a requirement here is ambiguous or conflicts with reality (e.g. a library no longer works that way), choose the simplest sensible option, note the decision in a `DECISIONS.md` file, and continue.
6. Keep this file updated: tick boxes as work completes and add anything learned.
