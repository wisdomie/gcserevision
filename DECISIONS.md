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

## M5

- **Every room transition is a Postgres function** (`create_room`, `join_room`, `start_room`,
  `record_room_answer`, `finalize_question`, `next_question`, `leave_room`,
  `expire_idle_rooms`). Each locks the room row and checks the status and question index, so
  repeated or simultaneous calls do nothing. Only the service role can run them.
- **Any player moves the game on.** Each player's page calls `advance` when the timer runs
  out and `next` when the reveal is over (with a little random spread), so a host who closes
  their tab doesn't stall the game. The last player to answer closes the question straight
  away from the answer route.
- **Closing on time waits for the late-answer grace.** Answers count until 500 ms after the
  deadline (PLAN.md 8), so `advance` only closes a question after that, using the app
  server's clock.
- **Reveal lasts 6 seconds** (`REVEAL_MS`); the database refuses to move on before 5, to allow
  for clock differences between the app server and the database.
- **"Locked in" uses `room_players.answered_idx`** (the last question a player answered)
  through Postgres Changes, instead of a separate Broadcast message. It carries no hint of
  correctness, and it means one subscription covers everything.
- **Realtime plus polling.** Clients subscribe to `rooms` and `room_players` changes (RLS
  limits them to members) and refetch `GET /api/rooms/[code]` on each change. They also
  refetch every 3 seconds, so a missed realtime message can't leave a phone stuck.
- **Server clock offset** comes from three calls to `GET /api/time`, keeping the one with the
  shortest round trip. The `<Timer>` counts down to the server's `question_ends_at`.
- **Nobody sees other players' typed answers.** The reveal shows each player's result and
  points, and only your own answer text: free text from other players would be a way to
  message each other (PLAN.md 11).
- **The duel tie-break time counts closed questions only**, so the ranking can't leak who got
  the open question right.
- **A room needs 2 players to start.** A duel starts by itself when its second player joins.
- **A leaving host hands over** to the player who joined next. An empty lobby is deleted; a
  game in progress keeps its history.
- **Room codes stay on finished rooms** until they go idle, so the podium page keeps working.
  Joining is lobby-only, so a code can still only be used for one game. Idle rooms (3 hours)
  lose their code and are closed by `expire_idle_rooms`, which runs each time a room is
  created rather than on a schedule: no cron extension or extra service needed.
- **Room settings:** mode (room or duel), the host's board or mixed boards, tier, topics,
  5/10/15/20 questions and 20/30/45/60 seconds per question (the API allows 3–20 and
  10–90 for tests).
- **Signed-out room links** (`/rooms/CODE`) go to `/login?next=/rooms/CODE`; the `next` path
  is carried through quick play and onboarding (checked with `safeRedirectPath`).
- **XP and topic stats** from live rooms are added when each question closes, in the same
  transaction as the scores.
- Rate limiting of room creation and answers is left to M8 with the rest of the rate limiting.
- **Friends leaderboard includes room-mates with 0 XP this week**, so the friends tab isn't
  empty straight after a first game where nobody scored.
- **Presence is a follow-up:** a player who leaves without pressing "Leave" still counts towards
  "everyone answered", so their questions wait for the full timer. It's slower but never stuck.
  Realtime Presence could drop them from the count (M8).

## M6

- **Creating each day's challenge:**
  - It's a Vercel Cron job (`vercel.json`, 00:05 UTC) calling `GET /api/cron/daily`.
  - The question generators are TypeScript, so Supabase cron (SQL) can't create questions.
  - The route needs `Authorization: Bearer $CRON_SECRET`; with no secret configured, it
    refuses every request.
  - It makes today's and tomorrow's challenges, so nobody waits at midnight. If the job hasn't
    run, the first player of the day creates the challenge.
  - `create_daily_challenge` takes a lock per date and keeps the first set of questions, so
    racing requests can't make two versions of a day or leave stray questions.
- **A random seed per day, not a date-based seed.** The generators are open source, so a
  date-based seed would let anyone work out a day's answers in advance.
- **The same five questions for everyone:**
  - only generators valid for both tiers and every board, with no diagrams (32 today);
  - five different topics, easiest first;
  - instances are stored with tier `both`.
- **An attempt is a `solo_sessions` row with `settings.mode = 'daily'`** (PLAN.md M6):
  - a partial unique index allows one per player per date;
  - all five shared instances are linked when the attempt starts. `solo_session_questions`
    is now unique per session instead of per instance, so every player links the same
    instances;
  - answers go through the solo answer route, so marking, worked solutions, XP and topic
    stats work exactly as in solo;
  - it's untimed, with one go a day.
- **Days roll over at midnight UK time**, like the weekly leaderboard.
- **Streak = days in a row with a finished daily.**
  - It stays alive until the end of the next day, so "2 days" is still shown the morning
    after.
  - An unfinished attempt doesn't count.
  - The copy is positive: "Play today to keep it going". It never warns about losing a streak
    (PLAN.md 11).
- **Friends board for the daily:**
  - you and the people you've played a room with who have finished today, ranked by points;
  - shown on the results screen once you've finished, and on a "Today" tab on
    `/leaderboard`;
  - each row shows points, the number correct and the player's streak, never answers;
  - this tab covers PLAN.md's "daily streaks" leaderboard.
- **Share card** is plain text: date, 🟩/⬜ per question, score and streak (if 2 or more). It
  never includes questions or answers. "Copy result" uses the clipboard and falls back to
  asking the player to select the text.
- **CI** sets a random `CRON_SECRET` per run so the E2E test can call the cron route.
- **Before launch** set `CRON_SECRET` in Vercel; Vercel then sends it to the cron route.

## M7

- **Diagrams are typed data drawn as inline SVG**, not JSXGraph and not stored SVG strings.
  - A `Diagram` (`src/lib/engine/diagram.ts`) is one of:
    - `geometry`: shapes, labels, right-angle marks and angle arcs;
    - `graph`: coordinate grids with lines or scatter points;
    - `bar`: bar charts.
  - Generators produce the data and `src/components/math/Diagram.tsx` draws it. There is no
    new dependency and nothing runs in the browser beyond React.
  - Data can't carry script, unlike stored SVG.
  - It travels in the public question (`public_payload.diagram`), so a diagram must never
    reveal the answer. The unknown is labelled `x`, and the property tests check that no
    label equals the answer.
- **Accessibility:** every diagram has required `alt` text, read out instead of the picture
  (`role="img"`). For charts the alt text lists the data, because that's what the question
  is about.
- **Geometry is drawn close to the real shape but captioned "Not drawn accurately"**, as on
  exam papers. Triangles use their true proportions, and very long, thin shapes are
  redrawn.
- **Size:** diagrams draw at 1 unit = 1px and shrink only to fit, so text is the same size
  in every diagram. Labels in narrow corners are pushed out to clear both lines.
- **Coordinate grids use equal scales**, so gradients look right; scatter graphs and bar
  charts fill the space instead.
- **Units:**
  - answers accept or leave off the unit, and `cm²` can be typed as `cm^2` or `cm2`;
  - degrees can be typed `°`, `^\circ` or `\degree` (the maths keyboard);
  - lengths and angles are rounded to 1 dp where the answer isn't whole, with the same
    "check your rounding" feedback as before.
- **Diagram questions are now included everywhere by default** (solo, rooms, daily). Topics
  with generators appear in the topic picker automatically. `includeDiagrams: false` still
  leaves them out.
- **New generators (9, 44 in total):**
  - missing angles (triangle, straight line, around a point);
  - area of rectangles, triangles, parallelograms and trapezia;
  - Pythagoras (hypotenuse and shorter side);
  - trigonometry (missing side and missing angle);
  - straight-line graphs (gradient, or choose the equation);
  - bar charts (total, difference, mode);
  - scatter graphs (type of correlation).
  - All are for both tiers and every board. The trigonometry and Pythagoras questions are
    calculator questions, so they're left out of non-calculator sessions.
- **Not yet:**
  - transformations, constructions, tree and Venn diagrams, cumulative frequency and
    histograms. They still have no generators, so they stay hidden in the topic picker;
  - lines of best fit and estimates from scatter graphs.

## M8

- **Rate limiting:**
  - Fixed-window counters live in Postgres (`private.rate_limits`, `rate_limit_check`), so
    every serverless instance shares them. An in-memory limiter would only see one instance.
  - Limits are per user and per IP (`src/lib/api/limits.ts`):
    - answers: 30 a minute per player;
    - creating rooms: 10 per 10 minutes;
    - joining: 20 per 10 minutes, which stops code guessing;
    - starting sessions: 30 per 10 minutes;
    - room nudges: 120 a minute.
  - Per-IP limits are at least 10 times the per-player ones, because a whole class can share
    a school's IP address.
  - IPs are stored only as an HMAC (`RATE_LIMIT_SECRET`) for a day; the daily cron prunes old
    windows.
  - A blocked request gets a 429, a `Retry-After` header and a friendly message. If the
    limiter itself errors, the request goes through rather than locking players out.
- **Error monitoring:**
  - Sentry (`@sentry/nextjs`) is on only when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are
    set. The browser SDK is loaded separately, so it isn't in the main bundle.
  - Every event passes through `scrubEvent`, which drops:
    - the user, cookies, request bodies (answers), extra data and server name;
    - every header except the user agent;
    - query strings, console breadcrumbs and email addresses in messages.
  - There's no tracing or session replay (Children's Code: no behavioural tracking).
  - API 500s are reported from `errorResponse`. Page crashes show a friendly error page that
    reports the error.
- **Installable app:**
  - `app/manifest.ts` with standard and maskable icons, drawn from `scripts/icon.svg` by
    `scripts/make-icons.mjs`.
  - The service worker (`public/sw.js`) loads pages from the network and shows `/offline`
    when that fails.
    - It redirects to `/offline?from=<page>` rather than serving the offline page at the
      failed page's address. Otherwise Next's router can render a stale prefetched copy of
      that page.
    - "Try again" goes back to `from`, checked with `safeRedirectPath`.
  - It caches hashed build assets so the offline page keeps its styles. It never caches API
    responses, because marking must be live.
  - It's registered only in production builds.
  - The header shows "Paper Game" on narrow phones so the new sound button fits.
- **Sound effects** are made with the Web Audio API, so there are no audio files:
  - right, partly right, wrong, finished and won;
  - quiet, and on by default, with a 🔊/🔇 toggle in the header remembered on the device.
- **Animations:** a pop-in for feedback, reveals and results, and a rising podium. They only
  run with `motion-safe:`, and the global reduced-motion rule stays.
  - A "shake" for wrong answers was dropped: it felt like a telling-off.
- **Word-problem bank:**
  - 250 hand-written originals in `content/questions/*.csv` (PLAN.md 2: in the style of
    GCSE questions, never copied):
    - 26 topics, at least 6 questions each, both tiers, difficulties 1–5;
    - integer, decimal, money, fraction, percentage, ratio, standard form, expression,
      equation-solution and multiple-choice answers.
    - The first 110 (`word-problems.csv`) leaned on number, ratio and statistics. The second
      140 (`word-problems-2.csv`) fill the thin topics (algebra, geometry, powers, standard
      form, sequences, bounds) and add straight-line and scatter graphs.
    - Tiers follow the DfE subject content: Higher-only content (quadratic formula,
      completing the square, sine and cosine rules, ½ab sin C, 3D Pythagoras, bounds
      calculations, fractional indices, perpendicular gradients, algebraic fractions,
      factorising $ax^2 + bx + c$, quadratic nth terms, triple brackets, subject appearing
      twice) is tagged `higher`. Error intervals, negative and zero indices, standard form,
      simple factorising, trig ratios and exact values are in both tiers.
    - Answers were computed by a script, not by hand, and an independent review re-checked
      each question's maths and tier. Questions too close to an existing one (same context
      and method) were replaced.
    - Tables are written as KaTeX arrays, because prompts are plain text with inline maths.
    - Algebra answers use the same markers as generated questions. `form` (expanded,
      factorised or simplified) and `variable` are optional CSV columns, so the first file
      didn't change.
  - `pnpm import:questions` validates every row and checks each final answer with the real
    marker, then upserts by slug. Rows removed from the CSV go back to draft, because old
    games still point at them.
  - CI loads the bank before the E2E tests.
  - **In games, each bank question is a one-question "generator"** (`bank:<id>`), so tier,
    board, calculator and topic filtering are shared with generated questions. When
    planning, each topic's bank counts as one choice beside that topic's generators, so
    roughly a fifth to a third of questions are word problems rather than most of them.
    There are no repeats in a session while unused ones remain.
  - It's used in solo, rooms and the daily (both-tier questions only).
  - Instances record `generator_key = 'bank:<id>'`, and the room and daily database
    functions didn't change.
  - Bank questions only use topics that already have generators, so the topic picker shows
    them without the service role on the page.
- **Accessibility audit:**
  - `tests/e2e/a11y.spec.ts` runs axe (WCAG 2.1 A and AA) on every main screen in light and
    dark mode: signed-out pages, hub, solo setup, question with a diagram, feedback, results,
    daily, every leaderboard tab, profile, new room, lobby and room question.
  - It found one real problem: answer options that are only maths had no accessible name.
    They now get a spoken version (`mathToSpeech`, e.g. "1 over 2").
  - MathLive's field and on-screen keyboard are third-party and left out of the audit. Its
    keyboard has a low-contrast key; the plain text box is always available instead.
- **Lighthouse (mobile, production build, local):**

  | Page           | Performance | Accessibility | Best practices | SEO |
  | -------------- | ----------- | ------------- | -------------- | --- |
  | `/login`       | 99          | 100           | 100            | 100 |
  | `/play`        | 97          | 100           | 100            | 100 |
  | solo question  | 95          | 100           | 100            | 100 |
  | `/leaderboard` | 100         | 100           | 100            | 100 |
  | `/play/daily`  | 94          | 100           | 100            | 100 |
  - Fixes: a `favicon.ico` (its 404 was a console error), and the daily page only loads the
    question player once an attempt starts (90 → 94).

- **Before launch, set** `RATE_LIMIT_SECRET`, and optionally `SENTRY_DSN` and
  `NEXT_PUBLIC_SENTRY_DSN`, in Vercel. Then run `pnpm import:questions` against the
  production database.
- **Production database updates run from GitHub Actions** (`deploy-database.yml`, run by
  hand). It links the project, runs `supabase db push` (with `--include-seed` on the first
  run) and imports the question bank.
  - Secrets live in the repository's Actions secrets, so nobody needs the project on their
    own computer or has to paste keys anywhere else.
  - It never runs automatically, so production only changes when someone chooses to update
    it.

## M9

- **Biology is the second subject.** AI marking of longer answers is left for later, as the
  user asked.
- **Reference data in a migration:** the subject and its 23 topics are in
  `supabase/migrations/20261010000000_biology.sql`, not `seed.sql`, because the seed only runs
  on a project's first deploy.
  - The migration also inserts maths if it's missing, and the seed now skips maths if it's
    there. So subject ids are the same locally and in production.
- **Topics and strands:**
  - The topics follow the content shared by the AQA, Edexcel and OCR Biology and Combined
    Science specifications.
  - They're grouped into AQA's seven sections, used as strands.
  - Separate-Biology-only content (the brain, the eye, kidneys, monoclonal antibodies and
    so on) is left out, so every question suits Combined Science students too.
- **Topic slugs:** topic slugs never repeat across subjects. Games match questions to topics
  by slug, and a test checks this.
- **Keyword answers:** a new `keywords` answer kind for recall questions, typed in a plain
  text box (`text` input).
  - Each marking point is a list of accepted words or phrases, and an answer gets a mark per
    point made. `need` sets how many points earn full marks.
  - `reject` phrases score zero, so listing every term you can think of doesn't pay.
    - "Mitosis or meiosis" is wrong.
    - "Heart rate decreases" is wrong for an exercise question.
  - Matching is forgiving about form:
    - case, punctuation and plurals are ignored;
    - one slip is allowed in words of 6 or more letters;
    - "a ... b" allows a few words in between.
  - It's strict about meaning: whole words only, so "aerobic" never matches inside
    "anaerobic", and the order of phrases counts.
  - Spelling slips in short words aren't forgiven automatically, because "cell"/"cel" is fine
    but "lh"/"fsh" are different hormones. Common misspellings are listed as alternatives
    instead.
- **Checked examples in each row:** bank CSVs can list `right` and `wrong` sample answers.
  The importer checks each one against the real marker, so a change to the matcher or a
  row can't quietly break marking.
- **Accuracy of the 156 Biology questions:**
  - They're original, with every number computed by a script.
  - An independent review re-checked the science, the tiers, and the marking with 610 trial
    answers.
  - Its fixes were applied. These were mostly extra accepted phrasings ("heart pumps
    faster", "spinal chord", "weak virus") and a few wrong answers that had been accepted
    ("heart rate decreases", "let blood flow backwards").
  - Higher-only content (glucagon, adrenaline, oxygen debt, the inverse square law) is
    tagged `higher`.
- **Choosing a subject:**
  - Solo practice and rooms have a Maths/Biology switch (`?subject=biology`), and a
    "Practise Biology" button sits on the hub.
  - Sessions and rooms store their subject.
  - The daily challenge stays Maths-only, so everyone's streak means the same thing.
- **The topic picker for bank-only subjects:** it uses
  `topics_with_questions(subject, tier, board)`, a security-definer function that returns
  only topic slugs. Pages still never read the questions or use the service role.
- **Calculator label:** it's hidden outside Maths, where it means nothing.
- **Test fixes found along the way:**
  - Since the bank grew, every diagram topic also has hand-written questions without
    charts. The diagram room test now makes rooms until the first question has a chart, up
    to 8 times (players can create 10 rooms in 10 minutes).
  - The room and solo tests look for the "Answer:" label exactly, because a worked solution
    can contain the same words.
