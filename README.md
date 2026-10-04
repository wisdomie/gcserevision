# Past Paper Game

A mobile-first web game for practising GCSE Maths exam-style questions and competing with friends.
All questions are original or generated; no exam-board past-paper content is used.

See [`PLAN.md`](./PLAN.md) for the full build plan and [`CLAUDE.md`](./CLAUDE.md) for commands.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase URL and keys
pnpm db:start                # optional: local Supabase (needs Docker)
pnpm db:reset
pnpm dev
```

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime),
Vitest, Playwright, deployed on Vercel.
