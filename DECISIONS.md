# Decisions

Judgement calls made where `PLAN.md` was ambiguous or reality differed (PLAN.md 17.5).

## M0

- **Next.js 16 `proxy.ts`.** Next.js 16 renamed the `middleware` file convention to `proxy`.
  Session refresh lives in `src/proxy.ts` → `src/lib/supabase/proxy.ts`.
- **System font stack instead of `next/font/google`.** Keeps builds independent of network
  access to Google Fonts and avoids any third-party request.
- **Supabase key names.** Kept the plan's `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY`. Supabase now also issues "publishable" (`sb_publishable_…`) and
  "secret" (`sb_secret_…`) keys; they are drop-in replacements and can be put in the same vars.
- **Grants as well as RLS.** The RLS migration revokes Supabase's default blanket grants to
  `anon`/`authenticated` and grants back only what PLAN.md 5.2 allows. Server-only tables
  (`questions`, `question_boards`, `question_instances`, `question_secrets`, `room_questions`,
  `answers`, `daily_challenges`) have no grants and no policies. Any new table or function
  must grant explicitly.
- **Public profile fields via a view.** RLS cannot restrict columns per row, so `profiles` is
  owner-only and other users read `public.public_profiles (id, username, avatar)`, a
  definer-rights view. `xp` is not client-writable (column-level grants).
- **Room membership check** uses a `security definer` helper, `private.is_room_member`, in a
  `private` schema not exposed by the Data API, to avoid recursive RLS on `room_players`.
- **`room_questions` and `daily_challenges` are server-only.** PLAN.md 5.2 doesn't list them;
  defaulting to the most restrictive option. Revisit in M5/M6 if clients need them.
- **`answers.raw_answer` is capped at 200 characters** in the schema too (PLAN.md 11).
- **Exam boards are seeded with slug and name only.** Specification codes and paper
  structures are not stored until verified against each board's current spec (PLAN.md 5.4).
- **Docker in the cloud sandbox.** `dockerd` runs, but pulling most Supabase images is
  blocked, so `supabase start` fails there. Migrations, seed and pgTAP RLS tests were verified
  against a standalone `supabase/postgres` container; CI runs the full stack.

## M1

- **Seed mixing for the RNG.** Raw mulberry32 gives strongly correlated first outputs for
  consecutive seeds (seeds 2 and 3 start 0.734 and 0.720, so they often produced the same
  question). `createRng` runs the seed through the MurmurHash3 finaliser first. The generator
  is still mulberry32 and still deterministic per seed.
- **`check(spec, raw, marks = 1)`.** PLAN.md 6.3 gives `check(spec, raw)` but also requires
  `marksAwarded`. A third argument passes the question's total marks; a single-part answer
  earns all of them or none. `multi` will split marks per part (M3).
- **MCQ answers are the option index** sent as a string (`"2"`).
- **Input type per answer kind** (`INPUT_TYPE_FOR_KIND`): integer/decimal/percentage →
  `numeric`; fraction → `fraction`; mcq → `mcq`; expression/solutions/ratio/standardForm →
  `expression` (free maths input); multi → `multi`.
- **Rounding specs store the unrounded value.** For `decimal` with `dp`/`sf`, the checker
  rounds `spec.value` itself, so generators store the original number. This lets the checker
  say "Check your rounding" when a player gives the right number at the wrong precision.
- **Fraction rules.** Negative denominators are normalised (`1/-2` = `-1/2`). A whole number
  is accepted when the answer is whole. Mixed numbers are accepted only with `allowMixed`, and
  their fractional part must be simplified when `mustBeSimplest`. Decimals are never accepted.
- **Kinds due in M3** (`expression`, `solutions`, `ratio`, `standardForm`, `multi`) are
  marked wrong with "This answer type can't be marked yet" rather than throwing.
- **Partial marks in live scoring.** PLAN.md 8 says "if not correct: points = 0" but also
  scales by `marksAwarded / totalMarks`. Interpreted as: points are earned whenever marks are
  awarded, scaled by the fraction of marks; the streak bonus needs a fully correct answer, and
  anything less than fully correct resets the streak.
- **Generator filter semantics.** `calculator: 'non-calc'` excludes calculator-only
  generators; a calculator session allows everything. `board: null` (mixed-board room) allows
  only generators tagged `'all'`.
- **One file per generator** under `generators/<strand>/` (e.g. `number/fractions-add.ts`)
  rather than one file per topic, since several generators share a topic.
- **The first 8 generators:** `number.fractions.add`, `number.fractions.multiply` (MCQ, with
  distractors from common mistakes), `number.percent.of`, `number.percent.change`,
  `number.round.dp`, `number.round.sf`, `number.hcf`, `number.lcm`. `number.percent.change`
  uses the seeded `percentage-change` topic (ratio strand).
- **Coverage threshold.** Vitest fails below 90% coverage of `src/lib/engine` (PLAN.md 15.5).

## M2

- **`solutions`, `ratio` and `standardForm` checkers moved forward from M3.** The remaining
  Phase 1 generators (equations, ratio, standard form) need them, and M2's done-criterion is
  an Algebra session. `expression` and `multi` stay in M3, and so do the expression-answer
  generators (simplify, expand, factorise, rearrange).
- **29 generators in M2** (the Phase 1 list minus the 6 expression-answer ones, which M3 adds).
  `number.prime-factors` and `algebra.nth-term` are multiple choice for now, with distractors
  from common mistakes, since their answers are expressions.
- **Probability answers accept unsimplified fractions** (`mustBeSimplest: false`), as GCSE
  mark schemes do. Decimal probabilities are not accepted yet.
- **Solo state lives in the database.** `solo_sessions.settings` stores the full plan
  (generator key and seed per question), so a session can be resumed and reproduced. A new
  server-only table, `solo_session_questions`, links each served instance to its slot and
  records when it was served (for timed scoring).
- **Two Postgres functions keep writes atomic:** `serve_solo_question` (instance + secret +
  link) and `record_solo_answer` (answer + session score + best streak + `topic_stats` +
  `xp`). Only the service role can execute them. The unique constraint on `answers` rejects
  a second answer to the same question.
- **Question selection** (PLAN.md 5.4): generators are filtered by tier, board and topic;
  Higher sessions are weighted by difficulty and Foundation sessions are uniform; the same
  generator is never served twice in a row when there's a choice. The hand-written
  `questions` bank is empty until the M8 importer, so selection only uses generators for now.
- **Solo timer: 60 seconds per question**, display only. The server measures time from
  `served_at`. Late answers still count, at the minimum speed factor.
- **Auth:** anonymous quick play (`signInAnonymously`) plus an email magic link via
  `/auth/callback` (PKCE code exchange). Upgrading an anonymous account to email is M4.
- **Profiles are written through RLS**, not the service role: `/api/profile` validates and
  filters the username, then inserts or updates as the user. Usernames are unique
  regardless of case.
- **Profanity filter** is a short built-in list with leetspeak folding: substrings for longer
  words, whole words only for short ones. It errs on the side of blocking (e.g. "Scunthorpe").
- **Service-role code stays in route handlers.** Pages read the user's own data with the
  user's client; solo state for the question loop comes from `GET /api/solo/[sessionId]`.
  ESLint blocks importing `lib/supabase/admin` or `lib/game/*-server` from pages and
  components.
- **E2E tests look up hidden answers with the service-role key** (test code only), so they
  can answer some questions correctly and check the marking end to end.
- **Docker in the cloud sandbox:** `dockerd` can be started by hand and Docker Hub pulls
  worked on a later attempt, so the full local stack can run there when the rate limit
  allows (see CLAUDE.md).
