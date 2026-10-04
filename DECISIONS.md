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

## M3

- **Own expression parser instead of Compute Engine or mathjs.** The form checks (expanded,
  factorised, simplified) need the structure exactly as the player wrote it, and library
  parsers canonicalise (reorder or distribute) or read implicit multiplication differently.
  `src/lib/engine/answers/expression.ts` is a small recursive-descent parser for typed text
  and MathLive LaTeX (`\frac`, `\left(`, `\cdot`, `^{}`, `\sqrt`, `\pi`, Greek letters).
- **Equivalence is numeric**, as PLAN.md 6.3 says: both expressions must agree (relative
  tolerance 1e-9) at 8 random points from a fixed seed, skipping points where either is
  undefined.
- **Form rules** (best effort, documented in `expression.ts`):
  - expanded = no product, power or negation of a sum, and like terms collected (GCSE
    "expand and simplify");
  - factorised = top level is a product (or a power of a bracket), and no bracket has a
    common factor left in it;
  - simplified = like terms collected, at most one number and one power of each letter per
    term.
- **A leading "x =" is accepted** on expression answers, so "make x the subject" can be
  answered as `x = (y-2)/3`.
- **Multi-part answers arrive as a JSON array of strings.** Marks are split by
  `marksPerPart`, or as evenly as possible. No generator uses `multi` yet, so its UI comes
  with the first one.
- **MathLive set-up:**
  - It's used for `expression` and `fraction` answers; numeric answers keep a plain box.
    There's a visible toggle to a plain text box, and the choice is remembered (localStorage).
  - Fonts come from the KaTeX stylesheet (`fontsDirectory = null`), and there are no sounds.
  - `mathModeSpace` is a thin space, so "1 1/2" stays a mixed number instead of becoming
    11/2. A browser probe found this; the real MathLive outputs are pinned in
    `tests/engine/expression.test.ts`.
- **MathLive timing fixes found by repeated E2E runs:**
  - options are set on MathLive's `mount` event, and the field is hidden until then;
  - typing is never echoed back into the field;
  - Enter submits the field's live value rather than possibly stale React state.
    One remaining quirk is MathLive's, not ours: clicking an already focused field and typing
    within milliseconds drops the first key. Tests rely on the auto-focus instead.
- **Follow-up:** a GCSE-specific on-screen keyboard layout. The default layout includes keys
  GCSE students don't need (∀, i, integrals).

## M4

- **Strongest and weakest topics** need at least 3 answers on a topic to be judged; fewer
  are listed as "not enough answers yet". A topic is never both strongest and weakest.
  The weak list links to solo practice with that topic ticked (`/play/solo?topics=…`).
- **Weekly leaderboard:**
  - XP earned from answers since Monday 00:00 UK time, ranked with ties sharing a rank;
  - top 20, plus the player's own row if they're outside it;
  - the global board shows only username, avatar and weekly XP, and only to signed-in
    players.
  - It is served by `security definer` functions (`weekly_leaderboard`, `played_with`), so
    `answers` stays unreadable to clients.
- **Friends = people you've shared a live room with** (PLAN.md 9). The list is empty until
  rooms ship in M5.
- **Daily streak leaderboard** waits for the daily challenge in M6.
- **Account deletion:** `POST /api/account/delete` (typed "DELETE" confirmation) deletes the
  auth user with the service role; the database cascades to profile, sessions, answers,
  stats and room memberships.
  - `rooms.host_id` is now nullable with `on delete set null`, so deleting a host keeps other
    players' rooms and answers. Any player can already advance a room (PLAN.md 10).
- **Guests can add an email** from their profile (`auth.updateUser`), which keeps their
  progress on the same account.
- **`/profile` and `/leaderboard` share the signed-in layout with `/play`**, via an `(app)`
  route group. The onboarding form is now a shared `ProfileForm`.
- **Header XP** refreshes when a solo session ends. Next keeps shared layouts across
  client-side navigation, so XP earned elsewhere (another tab) shows on the next full page
  load.
- **Privacy notice** is plain English for 14–16-year-olds and is linked from every page. It
  is not legal advice: before launch it needs the operator's name and contact details, and a
  review against the UK Children's Code.
