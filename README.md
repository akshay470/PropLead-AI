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

### 4. Database Migrations
Generate and apply migrations:
```bash
pnpm run db:generate
pnpm run db:migrate
```

### 5. Running the Application
```bash
# Development mode
pnpm run dev

# Testing
pnpm run test

# Linting
pnpm run lint
```
