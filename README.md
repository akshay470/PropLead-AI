# PropLead AI

> Autonomous real estate lead capture, multilingual qualification, and real-time site visit booking for residential developers in Ahmedabad, Gujarat.

[![Tests](https://img.shields.io/badge/Vitest-Passed-emerald)](file:///tests)
[![AI Evals](https://img.shields.io/badge/AI%20Evals-30%2F30%20(100%25)-emerald)](file:///docs/ai-evals.md)
[![Timezone](https://img.shields.io/badge/Timezone-Asia%2FKolkata-amber)](file:///src/lib/timezone.ts)
[![Compliance](https://img.shields.io/badge/Compliance-DPDP%202023%20%26%20RERA-blue)](file:///docs/security.md)

---

## Overview

PropLead AI is an enterprise-grade sales enablement platform built for Company A, an Ahmedabad residential real estate developer operating two live projects (**Project 1** in Bodakdev and **Project 2** in Shela, 420 apartments total, Rs 65 Lakh to Rs 1.2 Crore).

The platform engages inbound buyer enquiries across web, property portals, social ads, and hoardings within 2 minutes 24/7 across English, Hindi, and Gujarati. It qualifies budgets, adheres strictly to statutory Gujarat RERA fact sheets, prevents double bookings with PostgreSQL concurrency locks, and coordinates smooth handoffs to 11 sales executives.

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
   - Comprehensive security audit documented in `docs/security.md`.

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

### Quick Setup
```bash
# 1. Clone repository
git clone https://github.com/akshay470/PropLead-AI.git
cd PropLead-AI

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET (32+ chars), and CRON_SECRET (16+ chars)

# 4. Push database schema
pnpm run db:push

# 5. Seed demonstration database
# On Linux / macOS:
ALLOW_SEED=true pnpm run seed
# On Windows PowerShell:
$env:ALLOW_SEED="true"; pnpm run seed

# 6. Start development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the homepage.

---

## Demonstration Credentials

All seeded staff and demo accounts use password: `DemoPass123!`

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
# Run all unit and integration tests (both UTC and Asia/Kolkata)
pnpm test

# Run the 30-scenario autonomous AI evaluation suite
pnpm run eval:ai

# Run code style and lint checks
pnpm run lint

# Compile production build
pnpm run build
```

---

## Documentation Index

* [Deployment Guide (`deployment.md`)](file:///deployment.md) — Local setup, Vercel + Neon guide, environment checklist, and 5-minute reviewer verification script.
* [Security & Compliance Audit (`docs/security.md`)](file:///docs/security.md) — Vulnerability findings, remediations, route permission matrix, and dependency audit.
* [Design System Guidelines (`docs/design.md`)](file:///docs/design.md) — Color tokens, typography, radii, spacing, and shared component specifications.
* [Project Assumptions (`docs/assumptions.md`)](file:///docs/assumptions.md) — Operational, architectural, and regulatory assumptions.
* [AI Benchmark Evals (`docs/ai-evals.md`)](file:///docs/ai-evals.md) — 30-scenario compliance and prompt injection test benchmark.

---

## License

PropLead AI &copy; 2026 Company A. All rights reserved.
