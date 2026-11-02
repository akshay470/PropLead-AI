# PropLead AI

> Intelligent real estate lead capture, multilingual qualification, and real-time site visit booking for Company A (Ahmedabad).

## Overview
PropLead AI is an autonomous sales qualification and site-visit scheduling platform designed for residential developers. It addresses delayed follow-ups and lost leads by engaging buyers 24/7 across English, Hindi, and Gujarati, strictly answering from verified project fact sheets, qualifying requirements, and securing site-visit reservations with real-time double-booking prevention enforced at the database level.

## Tech Stack
- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Database & ORM:** PostgreSQL (Neon) + Drizzle ORM
- **Authentication:** Role-Based Access Control (RBAC: Buyer, Sales Executive, Admin) with secure HTTP-only session cookies
- **Validation:** Zod schema validation on all inputs
- **Testing:** Vitest
- **LLM Abstraction:** Modular provider interface (swappable model architecture)

## Project Structure
```text
/docs              # Project assumptions, specifications, and architecture docs
/src
  /app             # Next.js App Router (pages, layouts, and API routes)
  /components      # Reusable UI components & layouts (calm, minimal, accessible)
  /lib             # Shared utilities (phone normalization, formatters, validation)
  /server          # Server-only logic
    /ai            # Modular LLM interfaces and tool definitions
    /auth          # Password hashing, JWT session handling, role enforcement
    /db            # Drizzle schema, client, and migration manifests
    /services      # Business domain services (leads, bookings, notifications)
/tests             # Unit and integration test suites
```

## Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x
- PostgreSQL database instance (Neon recommended)

### 2. Setup Environment
Copy the example environment file:
```bash
cp .env.example .env.local
```
Fill in your database URL and application secrets.

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Database Migrations & Seeding
Generate and apply migrations, then seed realistic demo data:
```bash
pnpm run db:generate
pnpm run db:migrate
pnpm run seed
```

### 5. Demo Credentials
All seeded staff and demo accounts use password: `DemoPass123!`
- **Sales Head (Admin):** `admin@example.com`
- **Sales Executive 1:** `rajesh@example.com`
- **Sales Executive 2:** `ananya@example.com`
- **Sales Executive 3:** `priya@example.com`
- **Sales Executive 4:** `amit@example.com`
- **Demo Buyer:** `buyer@example.com`

### 6. Available Screens & Roles
- **Public Buyer Assistant:** `/chat` (Public, affirmative DPDP consent, multilingual qualification, RERA disclosures)
- **Executive Leads Queue:** `/executive/leads` (Unified intake, real-time deduplication, manual merge/unlink, fast-response badges)
- **Executive Site Visits:** `/executive/visits` (Upcoming & past visits, tap-to-call, Google Maps pins, Mark Visited / No-Show, Reschedule modal)
- **Interactive Booking Harness:** `/book-preview` (Interactive testing harness for slot selection, concurrency conflicts, and .ics calendar downloads)
- **Sales Head Admin:** `/admin` (Fact sheet editor, slot inventory, review queues, channel performance)

### 7. Running the Application
```bash
# Development mode
pnpm run dev

# Testing (Unit & Integration)
pnpm run test

# AI Benchmark Evaluation (25 statutory & conversational scenarios)
pnpm run eval:ai

# Linting
pnpm run lint

# Production build
pnpm run build
```

## AI Assistant & Compliance Guardrails
- **Grounding:** Strict single-source-of-truth grounded in Gujarat RERA registered project fact sheets (`get_fact` tool).
- **Hard Guardrails:** Algorithmic post-generation inspection in `src/server/ai/guardrails/price-checker.ts`. Blocks unapproved discounts, price negotiations, and final price commitments across English, Hindi, and Gujarati.
- **DPDP Compliance:** Explicit affirmative consent required before chat initiation; immediate opt-out (`STOP`, `रद्द`, `બંધ કરો`) sets `opted_out = true` and halts reminders.
- **Evaluations:** 25 automated evaluation scenarios testing multilingual Q&A, prompt injection defenses, RERA price guardrails, and slot booking. Run via `pnpm run eval:ai` (report generated in `docs/ai-evals.md`).
