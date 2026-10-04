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
