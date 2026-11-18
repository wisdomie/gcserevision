# Past Paper Game

A mobile-first web game for GCSE students to practise exam-style questions and compete with friends. All questions are original or generated—no exam-board content is copied.

## Features

### Game Modes
- **Solo Practice:** Untimed or timed practice with instant marking and worked solutions
- **Live Rooms:** 2–20 friends join with a 6-character code, answer questions together, faster correct answers earn more points
- **Duel:** Automatic 2-player live mode
- **Daily Challenge:** The same 5 questions for everyone each day, with leaderboards and streaks

### Subjects & Exam Boards
- Supports **GCSE Mathematics** and **Biology** (Combined and Triple Science), with an architecture that makes adding further subjects a data change plus new question content
- Supports all major UK exam boards: **AQA**, **Edexcel (Pearson)**, **OCR**, **WJEC/Eduqas**
- **Foundation and Higher tiers** available
- Questions are tailored by exam board and tier through tags and filters

### Content
- **Generated questions:** Parameterised TypeScript generators produce unlimited fresh questions across algebra, geometry, and number topics
- **Hand-written originals:** Exam-style questions written in the same style as real GCSE papers, stored in the database
- Maths topics include algebra, geometry, trigonometry, number and word problems
- Maths rendering with **KaTeX** and input via **MathLive** web component with text fallback

### User Features
- Leaderboards and scoring
- User profiles and progress tracking
- Dark and light mode support
- Offline support via service worker
- Responsive design for mobile, tablet, and desktop

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Hosting | Vercel (app) + Supabase Cloud (database) |
| Maths rendering | KaTeX |
| Maths input | MathLive |
| Testing | Vitest (unit & property) + Playwright (e2e) |
| Package manager | pnpm |
| Lint & format | ESLint + Prettier |
| Monitoring | Sentry |

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Fill in Supabase URL and keys from https://supabase.com

# Optional: Start local database (requires Docker)
pnpm db:start
pnpm db:reset

# Start development server
pnpm dev
```

The app will be available at http://localhost:3000.

## Development Commands

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm test             # Run Vitest unit tests
pnpm test:coverage    # Test with coverage
pnpm test:e2e         # Playwright e2e tests
pnpm lint             # ESLint
pnpm typecheck        # TypeScript check
pnpm format:check     # Prettier check (pnpm format to fix)
pnpm db:start         # Local Supabase
pnpm db:reset         # Reset database from migrations
pnpm import:questions # Import questions from CSV
```

## Architecture

The codebase is organized around a clean separation of concerns:

- **`src/lib/engine/`** – Pure question generation, answer checking, and scoring logic (no database dependencies)
- **`src/components/`** – React components (UI, game, math rendering)
- **`src/app/`** – Next.js App Router pages and API routes
- **`supabase/`** – Database migrations, seed data, and RLS policies
- **`tests/`** – Unit tests for the engine, e2e tests with Playwright

## Contributing

Questions, bugs, and improvements are welcome. Please check `PLAN.md` for the development roadmap and architecture decisions in `DECISIONS.md`.
