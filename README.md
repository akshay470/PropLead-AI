# PropLead AI

> Autonomous real estate lead capture, multilingual qualification, and real-time site visit booking for residential developers in Ahmedabad, Gujarat.

[![Tests](https://img.shields.io/badge/Vitest-250%20Passed-emerald)](file:///tests)
[![AI Evals](https://img.shields.io/badge/AI%20Evals-30%2F30%20(100%25)-emerald)](file:///docs/ai-evals.md)
[![Timezone](https://img.shields.io/badge/Timezone-Asia%2FKolkata-amber)](file:///src/lib/timezone.ts)
[![Compliance](https://img.shields.io/badge/Compliance-DPDP%202023%20%26%20RERA-blue)](file:///docs/security.md)

---

## Overview

PropLead AI is an enterprise-grade sales enablement platform built for Company A, an Ahmedabad residential real estate developer operating two live projects (**Project 1** in Bodakdev and **Project 2** in Shela, 420 apartments total, Rs 65 Lakh to Rs 1.2 Crore).

The platform engages inbound buyer enquiries across web, property portals, social ads, and hoardings within 2 minutes 24/7 across English, Hindi, and Gujarati. It qualifies budgets, adheres strictly to statutory Gujarat RERA fact sheets, prevents double bookings with PostgreSQL concurrency locks, and coordinates smooth handoffs to 11 sales executives.

---

## Architecture Diagram

```mermaid
flowchart TD
  subgraph Channels["Acquisition Channels"]
    portal["Property Portals"]
    ads["Social Media Ads"]
    site["Developer Website"]
    hoarding["Hoarding Phone"]
  end

  subgraph Ingestion["Ingestion & Compliance"]
    dedupe["E.164 & Email Deduplication"]
    dpdp["DPDP Affirmative Consent"]
    leadsDb[("Leads Table")]
  end

  subgraph Assistant["Multilingual AI Assistant"]
    agent["Autonomous Agent Loop"]
    factSheet["Grounded Fact Sheet"]
    priceGuard["Algorithmic Price Guardrail"]
    gemini["Gemini 1.5 Flash / Mock"]
  end

  subgraph Booking["Booking & Concurrency Engine"]
    slots["60-min IST Slots (10-18)"]
    tx["Atomic Transaction & Row Lock"]
    pIndex[("Partial Unique Index<br/>confirmed_slot_unique_idx")]
    ics["iCalendar .ics Export"]
  end

  subgraph Workspaces["Role-Based Portals"]
    buyerUI["Buyer Mobile Chat (/chat)"]
    execUI["Sales Executive Portal (/executive)"]
    adminUI["Sales Head Dashboard (/admin)"]
  end

  subgraph Reminders["Notifications & Cron"]
    cron15["GitHub Actions (15m cron)"]
    cronDaily["Vercel Daily Cron"]
    dispatcher["Atomic Claim Dispatcher"]
    msgLog[("Mock Message Log")]
  end

  Channels --> Ingestion
  Ingestion --> leadsDb
  buyerUI <--> Assistant
  Assistant --> factSheet
  Assistant --> priceGuard
  Assistant --> gemini
  Assistant --> Booking
  Booking --> tx
  tx --> pIndex
  Booking --> ics
  leadsDb --> execUI
  Booking --> execUI
  leadsDb --> adminUI
  Booking --> adminUI
  cron15 --> dispatcher
  cronDaily --> dispatcher
  dispatcher --> msgLog
```

---

## Key Capabilities

1. **Autonomous Multilingual Assistant (`/chat`):**
   - Public, no-login buyer experience compliant with the Digital Personal Data Protection (DPDP) Act 2023.
   - Converses fluently in English, Hindi, and Gujarati, detecting language switches seamlessly.
   - Code-level price guardrails (`price-checker.ts`) guarantee the assistant quotes only verified project price ranges, never final numbers or unapproved discounts.
   - 30/30 automated adversarial AI evaluations passing (`pnpm run eval:ai`).

2. **Concurrency-Protected Booking Engine:**
   - Real-time visit scheduling into 60-minute executive slots (10:00 to 18:00 IST).
   - Database-level partial unique index (`confirmed_slot_unique_idx`) prevents double bookings under simultaneous concurrent requests.
   - 2-hour minimum booking cutoff and automatic 24-hour / 2-hour reminders.
   - Atomic rescheduling and one-click calendar invitation downloads (`.ics`).

3. **Unified Lead Management & Deduplication:**
   - Sequential `LD-XXXXX` lead tracking.
   - Deduplication by normalized E.164 phone and case-insensitive email, preserving marketing source attribution.
   - Executive merge, duplicate linking, and unlinking actions.

4. **Executive Workspace (`/executive`):**
   - Daily visit rota, lead pipeline, and AI handoff review queue.
   - Structured context summaries (buyer sentiment, preferred BHK, budget range, open questions).
   - Visit outcome marking (`visited` vs `no_show`).

5. **Sales Head Administration (`/admin`):**
   - Source performance dashboard tracking CAC, visit conversion rates, and ROI across portals, ads, website, and hoardings.
   - RERA fact sheet manager with compliance validation.
   - Flagged conversation review queue with executive reassignment.
   - 7-day slot management grid with batch slot generation and blackout blocking.

6. **Enterprise Security & Compliance:**
   - Constant-time password verification via dummy bcrypt hash (mitigates login timing attacks).
   - Distributed PostgreSQL rate limiting (5 attempts/min per email, 20 attempts/min per IP on login; 15/min on chat).
   - Object-level authorization (IDOR protection) ensuring executives only access assigned leads and visits.
   - DPDP right to erasure / anonymization endpoint (`POST /api/admin/leads/[id]/anonymize`).
   - Comprehensive security audit documented in [`docs/security.md`](file:///docs/security.md).

7. **Explainable Lead Priority Score:**
   - Heuristic 0–100 scoring based strictly on customer intent signals (budget alignment against fact sheet endpoints, buying timeline urgency, site visit engagement, BHK preference, and conversational message count).
   - Never evaluates personal, demographic, or protected characteristics (name, phone, email, language).
   - Transparent qualification tiers: Hot (&ge; 70), Warm (40–69), Cold (&lt; 40), with neutral points preventing false penalties on incomplete data ("Insufficient Data" badge).
   - Automated high-intent handoff dispatched when a lead first crosses into Hot.
   - Formula, weights, and mathematical definitions documented in [`docs/scoring.md`](file:///docs/scoring.md).

---

## Project Structure & Folder Map

```text
PropLead-AI/
├── .github/
│   └── workflows/
│       └── reminders.yml      # 15-minute GitHub Actions automated cron runner
├── docs/
│   ├── TDD.md                 # Complete Technical Design Document
│   ├── scoring.md             # Lead Priority Score formula, weights, and methodology
│   ├── security.md            # Security audit, findings, and route permission matrix
│   ├── design.md              # Design system tokens, typography, and component guide
│   ├── assumptions.md         # Architecture, operational, and regulatory assumptions
│   └── ai-evals.md            # 30-scenario AI eval benchmark results
├── drizzle/                   # Drizzle migration files and SQL manifests
├── scripts/
│   ├── eval-ai.ts             # 30-scenario autonomous AI evaluation suite
│   └── scan-secrets.ts        # Secrets scanner for git history and working tree
├── src/
│   ├── app/                   # Next.js 14 App Router
│   │   ├── admin/             # Sales Head dashboard, slots, facts, review queue
│   │   ├── api/               # 47 REST Route Handlers (auth, chat, bookings, leads, admin, health)
│   │   ├── chat/              # Public buyer chat interface
│   │   ├── executive/         # Sales Executive pipeline, visits, handoffs
│   │   ├── privacy/           # Statutory DPDP Act 2023 privacy notice
│   │   └── page.tsx           # Quiet luxury developer homepage
│   ├── components/            # Reusable React components
│   │   ├── booking/           # Confirmation cards & calendar picker
│   │   ├── layout/            # Header, role-aware nav, footer
│   │   └── ui/                # Atomic UI library (Button, Badge, Card, Modal, EmptyState, etc.)
│   ├── env.ts                 # Central Zod environment validator (fails fast at boot)
│   ├── lib/                   # Shared utilities (phone E.164, Asia/Kolkata timezone, formatters)
│   ├── middleware.ts          # Edge authentication & RBAC router
│   └── server/                # Server-only domain services
│       ├── ai/                # LLM agent loop, tool schemas, price guardrail, rate limiter
│       ├── auth/              # Bcrypt hashing, JWT sessions, lead cookies, login limiter
│       ├── db/                # Drizzle schema, client, and comprehensive seed script
│       └── services/          # Leads, booking, reminders, slot management, metrics
├── tests/
│   ├── helpers/               # Test database setup (PGlite in-memory Postgres)
│   ├── integration/           # Ingestion, booking, seed, migration, chat assistant tests
│   └── unit/                  # Timezone, price guardrail, auth schemas, RBAC matrix, edge cases
├── deployment.md              # Production deployment & operations guide
├── next.config.mjs            # Security headers & closed CORS configuration
├── tailwind.config.ts         # Custom architectural bronze/ink theme
├── vitest.config.ts           # Vitest configuration (sequential PGlite runner)
└── package.json
```

---

## Tech Stack

* **Framework:** Next.js 14 App Router (React 18, TypeScript)
* **Styling:** Tailwind CSS with custom design system (`docs/design.md`)
* **Database:** PostgreSQL (Neon Serverless) with Drizzle ORM
* **Testing:** Vitest (unit, integration, timezone determinism, and RBAC matrix)
* **AI Provider:** Multi-provider engine (Google Gemini 1.5 Flash + deterministic mock)
* **Cron:** Dual architecture (15-min GitHub Actions workflow + daily Vercel cron)
* **Timezone:** Asia/Kolkata (IST, UTC+05:30) standardized across all business operations

---

## Getting Started

### Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x
- PostgreSQL instance (Neon recommended)

### First run on Windows (PowerShell)
```powershell
# 1. Copy sample environment file to .env.local
Copy-Item .env.example .env.local

# 2. Fill in values in .env.local:
#    - Set DATABASE_URL to your remote PostgreSQL connection string (Neon with sslmode=require)
#    - Set LLM_API_KEY to your Gemini API key (from Google AI Studio)
#    - Verify configuration status (safe; never prints secret values)
pnpm run check:env

#    - Verify live LLM upstream connectivity (model set in LLM_MODEL, demo used gemini-3.5-flash-lite)
pnpm run check:llm

# 3. Apply database migrations
pnpm run db:migrate

# 4. Seed initial database (validates ALLOW_SEED=true, prints host safely, and refuses localhost unless ALLOW_LOCAL_SEED=true)
pnpm run seed

# 5. Start development server
pnpm run dev
```

### Quick Setup (macOS / Linux)
```bash
# 1. Clone repository
git clone https://github.com/akshay470/PropLead-AI.git
cd PropLead-AI

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and LLM_API_KEY
pnpm run check:env

# 4. Apply database migrations
pnpm run db:migrate

# 5. Seed demonstration database
pnpm run seed

# 6. Start development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the homepage.

---

## Scripts Reference

| Command | Description |
|:---|:---|
| `pnpm dev` | Starts local Next.js development server on port 3000. |
| `pnpm build` | Compiles production build (type checking + static page analysis). |
| `pnpm start` | Runs compiled production build. |
| `pnpm run lint` | Runs ESLint across all codebase files. |
| `pnpm test` | Runs all 24 Vitest test suites (262 tests). |
| `pnpm run check:env` | Validates `.env.local` status without printing secret values. |
| `pnpm run check:llm` | Verifies live LLM connectivity with a tiny call (model set in `LLM_MODEL`; demo used `gemini-3.5-flash-lite`). |
| `pnpm run eval:ai` | Executes the 30-scenario autonomous AI evaluation suite. |
| `pnpm run scan:secrets` | Scans git history and tracked files for accidental credential leaks. |
| `pnpm run seed` | Seeds projects, staff, fact sheets, slots, leads, and ad spend. |
| `pnpm run db:push` | Pushes Drizzle schema directly to connected PostgreSQL database. |
| `pnpm run db:generate` | Generates SQL migration files from schema definitions. |
| `pnpm run db:migrate` | Applies generated SQL migrations. |

---

## Demonstration Credentials

All seeded staff and demo accounts use password: `DemoPass123!` (demo only)

| Role | Name | Email | Password |
|:---|:---|:---|:---|
| **Sales Head (Admin)** | Vikram Mehta | `admin@example.com` | `DemoPass123!` |
| **Sales Executive 1** | Rajesh Sharma | `rajesh@example.com` | `DemoPass123!` |
| **Sales Executive 2** | Ananya Shah | `ananya@example.com` | `DemoPass123!` |
| **Sales Executive 3** | Priya Patel | `priya@example.com` | `DemoPass123!` |
| **Sales Executive 4** | Amit Joshi | `amit@example.com` | `DemoPass123!` |
| **Demo Buyer** | Aarav Sharma | `buyer@example.com` | `DemoPass123!` |

*(One-click quick-fill buttons are also available on `/login` when `NEXT_PUBLIC_DEMO_MODE=true`.)*

---

## Testing & Quality Gates

Run the automated test and evaluation suites:

```bash
# 1. Run all unit and integration tests
pnpm test

# 2. Run timezone determinism test under UTC and Asia/Kolkata
# Under UTC:
$env:TZ="UTC"; pnpm vitest run tests/unit/timezone.test.ts
# Under Asia/Kolkata:
$env:TZ="Asia/Kolkata"; pnpm vitest run tests/unit/timezone.test.ts

# 3. Run the 30-scenario autonomous AI evaluation suite
pnpm run eval:ai

# 4. Run secrets scan
pnpm run scan:secrets

# 5. Run code style and lint checks
pnpm run lint

# 6. Compile production build
pnpm run build
```

### Real-Pool Concurrency Test Note
The test suite includes a strict 10-parallel-request race-condition test that runs on in-memory PostgreSQL (`tests/integration/booking.test.ts`). In addition, a real multi-connection connection-pool test is provided. It is skipped by default unless `TEST_DATABASE_URL` is set.
To run against a real PostgreSQL connection pool:
```bash
TEST_DATABASE_URL="postgres://user:password@localhost:5432/dbname" pnpm vitest run tests/integration/booking.test.ts
```

---

## Documentation Index

* [**Deployment Guide (`deployment.md`)**](file:///deployment.md) — Local setup, Vercel + Neon guide, environment checklist, and 5-minute reviewer verification script.
* [**Technical Design Document (`docs/TDD.md`)**](file:///docs/TDD.md) — Comprehensive technical design document with architecture, data model, flows, and metrics.
* [**Security & Compliance Audit (`docs/security.md`)**](file:///docs/security.md) — Vulnerability findings, remediations, route permission matrix, and dependency audit.
* [**Design System Guidelines (`docs/design.md`)**](file:///docs/design.md) — Color tokens, typography, radii, spacing, and shared component specifications.
* [**Project Assumptions (`docs/assumptions.md`)**](file:///docs/assumptions.md) — Operational, architectural, and regulatory assumptions.
* [**AI Benchmark Evals (`docs/ai-evals.md`)**](file:///docs/ai-evals.md) — 30-scenario compliance and prompt injection test benchmark.

---

## License

PropLead AI &copy; 2026 Company A. All rights reserved.
