# CLAUDE.md

Read `PLAN.md` first; follow section 17 (working agreement). Record judgement calls in `DECISIONS.md`.

@AGENTS.md

## Commands

```bash
pnpm install            # install (lockfile is committed; use --frozen-lockfile in CI)
pnpm dev                # Next.js dev server on http://localhost:3000
pnpm lint               # ESLint
pnpm typecheck          # tsc --noEmit
pnpm format:check       # Prettier (pnpm format to fix)
pnpm test               # Vitest unit + property tests (no database needed)
pnpm test:coverage      # with coverage of src/lib/engine
pnpm build              # production build
pnpm check:bundle       # after build: no server-only content in the browser bundle
pnpm test:e2e           # Playwright (starts the dev server itself)

# Database (needs Docker)
pnpm db:start           # local Supabase; prints URL and keys for .env.local
pnpm db:reset           # rebuild from supabase/migrations + supabase/seed.sql
pnpm db:test            # pgTAP tests in supabase/tests (RLS checks)
pnpm db:types           # regenerate src/types/database.ts after a migration
pnpm import:questions   # load content/questions/*.csv into the database (--check to only validate)
```

## Notes for cloud sessions

- Engine code (`src/lib/engine`) is pure and tested without a database. Keep it that way.
- In the cloud sandbox Docker isn't running by default: start it with `dockerd &` first.
  Image pulls are sometimes rate-limited; if `pnpm db:start` fails, retry later or rely on
  GitHub Actions (`.github/workflows/integration.yml`), which runs the database and E2E tests.
- After `pnpm db:start`, write the printed URL and keys into `.env.local` (gitignored).
  Playwright reads `.env.local` too.
- Use the pre-installed Chromium for Playwright; do not run `playwright install`. If its version
  doesn't match, run `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e`.
- This is Next.js 16: middleware is now `src/proxy.ts`. Check `node_modules/next/dist/docs/`
  before using Next.js APIs.
