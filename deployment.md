# PropLead AI — Deployment & Operations Guide

This guide describes how to deploy, configure, and operate PropLead AI in local development, continuous integration, and production environments (Vercel + Neon Serverless PostgreSQL + GitHub Actions).

---

## 1. Architecture Overview

* **Frontend & API Framework:** Next.js 14 App Router (React 18, TypeScript, Tailwind CSS).
* **Database:** PostgreSQL 15+ / Neon Serverless Postgres with Drizzle ORM.
* **Concurrency Protection:** Database-level partial unique index (`confirmed_slot_unique_idx`) preventing double bookings under high concurrent traffic.
* **Timezone Standard:** Asia/Kolkata (IST, UTC+05:30) applied deterministically across slot generation, bookings, cron dispatchers, and calendar `.ics` files.
* **Cron Dispatcher:** Dual architecture — 15-minute scheduled dispatch via GitHub Actions workflow (`.github/workflows/reminders.yml`) + once-daily safety fallback on Vercel Hobby cron.
* **AI Provider:** Multi-provider engine supporting Google Gemini 1.5 Flash (`LLM_PROVIDER=gemini`) with an automated deterministic fallback (`LLM_PROVIDER=mock`).

---

## 2. Environment Variables Checklist

All environment variables are validated at boot time by `src/env.ts`. Set the following variables in your local `.env` or Vercel Project Settings:

| Variable Name | Required | Default / Mode | Description |
|:---|:---:|:---:|:---|
| `DATABASE_URL` | **Yes** | Postgres connection string | PostgreSQL database connection URL (Neon / Supabase / local). |
| `JWT_SECRET` | **Yes** | 32+ char string | Cryptographic secret for signing HTTP-only session JWT cookies. |
| `CRON_SECRET` | **Yes** | 16+ char string | Shared secret for authenticating automated reminder cron invocations. |
| `NODE_ENV` | Optional | `development` | `development`, `test`, or `production`. |
| `LLM_PROVIDER` | Optional | `mock` | `gemini` (live Google Gemini API) or `mock` (deterministic test engine). |
| `LLM_API_KEY` | If Gemini | Empty | Google AI Studio Gemini API Key. |
| `LLM_MODEL` | Optional | Driven by `LLM_MODEL` env | Gemini model identifier driven solely by `LLM_MODEL` env (demo used `gemini-3.5-flash-lite`). |
| `APP_URL` | Optional | `http://localhost:3000` | Canonical root URL used in reminder links and `.ics` generation. |
| `ALLOW_SEED` | Guard | `false` | Must be explicitly set to `true` to allow `pnpm run seed` to execute. |
| `ALLOW_LOCAL_SEED` | Guard | `false` | Must be explicitly set to `true` to allow seeding against `localhost` / `127.0.0.1`. |
| `NEXT_PUBLIC_DEMO_MODE` | Optional | `true` | Enables reviewer quick-fill login credentials on `/login`. |

> **Security Note:** Never commit `.env` or `.env.local` to git. All credentials and secret strings must be passed via secure secrets management.

---

## 3. Local Development Setup

### First run on Windows (PowerShell)
```powershell
# 1. Copy sample environment file to .env.local
Copy-Item .env.example .env.local

# 2. Fill in values in .env.local:
#    - Set DATABASE_URL to your remote PostgreSQL connection string (Neon with sslmode=require)
#    - Set LLM_API_KEY to your Gemini API key (from Google AI Studio)
#    - Verify configuration with check:env (never prints secret values)
pnpm run check:env

# 3. Apply database migrations
pnpm run db:migrate

# 4. Seed initial database (loads ALLOW_SEED=true and DATABASE_URL from .env.local automatically)
pnpm run seed

# 5. Start development server
pnpm run dev
```

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/akshay470/PropLead-AI.git
cd PropLead-AI
pnpm install
```

### Step 2: Configure Environment
Copy the sample environment file:
```bash
cp .env.example .env.local
```
Populate `.env.local` with your PostgreSQL database URL (Neon with `sslmode=require`), a 32-character `JWT_SECRET`, a 16-character `CRON_SECRET`, and `ALLOW_SEED=true`.
Verify configuration:
```bash
pnpm run check:env
```

### Step 3: Run Database Migrations
Apply Drizzle schema migrations to your Neon database:
```bash
pnpm run db:migrate
```

### Step 4: Seed Initial Data
Seed Company A projects, fact sheets, slot inventory, sample leads, and ad spend (prints database host only and requires `ALLOW_SEED=true`; refuses `localhost` / `127.0.0.1` unless `ALLOW_LOCAL_SEED=true`):
```bash
pnpm run seed
```

### Step 5: Start Development Server
```bash
pnpm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Production Deployment (Vercel + Neon)

### Neon Database Setup
1. Create a project on [Neon.tech](https://neon.tech) and copy the PostgreSQL connection string.
2. In Neon SQL Editor or via local CLI:
   ```bash
   pnpm run db:push
   ALLOW_SEED=true pnpm run seed
   ```

### Vercel Deployment
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Configure Project Environment Variables:
   - `DATABASE_URL`: Your Neon pooled connection string (`postgres://...`).
   - `JWT_SECRET`: A secure random string (minimum 32 bytes).
   - `CRON_SECRET`: A secure random token (minimum 16 bytes).
   - `LLM_PROVIDER`: `gemini` (or `mock` for demo).
   - `LLM_API_KEY`: Your Gemini API key.
   - `APP_URL`: Your production Vercel domain (e.g. `https://proplead-ai.vercel.app`).
   - `NODE_ENV`: `production`.
   - `NEXT_PUBLIC_DEMO_MODE`: `true` (enables demo buttons for reviewers).
3. Click **Deploy**.

### GitHub Actions Cron Setup (15-Minute Reminders)
The scheduled reminder workflow (`.github/workflows/reminders.yml`) runs every 15 minutes to trigger `GET /api/cron/reminders`. It requires two GitHub Actions repository secrets:
1. Go to your repository **Settings &rarr; Secrets and variables &rarr; Actions**.
2. Add the two required repository secrets:
   - `CRON_SECRET`: Must match the `CRON_SECRET` configured in your Vercel deployment.
   - `APP_URL`: Your deployed canonical URL (e.g., `https://your-app-domain.vercel.app`).
3. **Graceful Skip Behavior:** If either `APP_URL` or `CRON_SECRET` is not yet configured, the workflow gracefully prints `"Cron skipped: APP_URL or CRON_SECRET not configured"` and exits cleanly with code 0 to prevent noisy failure notifications.
4. When configured, it calls `GET /api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>` using a 30-second timeout (`curl --fail --max-time 30`), and fails on any non-2xx response.

---

## 5. Demo Credentials

All seeded accounts share the same demonstration password:

| Role | Name | Email | Password |
|:---|:---|:---|:---|
| **Sales Head (Admin)** | Vikram Mehta | `admin@example.com` | `DemoPass123!` |
| **Sales Executive 1** | Rajesh Sharma | `rajesh@example.com` | `DemoPass123!` |
| **Sales Executive 2** | Ananya Shah | `ananya@example.com` | `DemoPass123!` |
| **Sales Executive 3** | Priya Patel | `priya@example.com` | `DemoPass123!` |
| **Sales Executive 4** | Amit Joshi | `amit@example.com` | `DemoPass123!` |
| **Demo Buyer** | Aarav Sharma | `buyer@example.com` | `DemoPass123!` |

*(Reviewers can also use the one-click "Quick Fill" buttons directly on `/login`.)*

---

## 6. 5-Minute Reviewer Verification Script

Follow these 6 steps to verify the entire system end-to-end:

### 1. Health Verification (15 seconds)
Navigate to `/api/health` in your browser. Verify the response is:
```json
{ "status": "ok", "timestamp": "...", "db": true }
```

### 2. Public Buyer Experience & AI Qualification (90 seconds)
1. Go to `/` (Homepage). Notice the quiet luxury design, RERA numbers in footer, and click **"Launch Buyer Chat Demo"** (`/chat`).
2. Notice the DPDP affirmative consent checkbox. Enter Name (`Rahul Patel`) and Phone (`9825123456`).
3. Click **Start Conversation**.
4. Test multilingual conversation:
   - English: *"What is the price of a 3 BHK in Bodakdev?"* &rarr; Notice it quotes the verified range (Rs 98 Lakh to Rs 1.20 Crore), never an exact price.
   - Hindi: *"कार पार्किंग की क्या सुविधा है?"* &rarr; Responds in Hindi quoting 2 allotted covered parking bays.
   - Gujarati: *"મારે સાઇટ જોવી છે"* &rarr; Returns real upcoming visit slots in Asia/Kolkata.
5. Click one of the offered visit slots to confirm your site visit. Notice the booking confirmation card and calendar ICS link.

### 3. Executive Workspace & Handoff Pipeline (60 seconds)
1. Open `/login` in a new tab. Click **"Executive (Rajesh)"** quick-fill and sign in.
2. You land on `/executive` (or `/executive/leads`).
3. Notice Rahul Patel's lead is visible with the `website` source tag, status `visit_scheduled`, and the full chat transcript.
4. Click **Visits** in navigation (`/executive/visits`) &rarr; notice the appointment booked in Step 2 with its start time in IST.

### 4. Sales Head Admin Operations (60 seconds)
1. Logout and sign in as **"Sales Head (Admin)"** (`admin@example.com`).
2. Go to `/admin/dashboard` &rarr; review the portfolio funnel (3,000 leads, conversion rates, and ad spend ROI across portal, ads, website, and hoardings).
3. Go to `/admin/slots` &rarr; view the 7-day executive slot matrix. Click **Block Slot** on any slot and verify it disables booking.
4. Go to `/admin/review` &rarr; inspect flagged chats (e.g. price violations or human escalation requests) and test the reassign action.

### 5. Compliance & Erasure Check (45 seconds)
1. In the admin portal, open the DPDP Anonymization demo or call `POST /api/admin/leads/[id]/anonymize`.
2. Notice buyer PII is scrubbed to `Anonymized Buyer (DPDP)` and `+910000000000`, while visit counts remain intact for aggregate reporting.
3. Visit `/privacy` &rarr; review the public DPDP 2023 compliance disclosure and 180-day retention policy.

### 6. Automated Reminders Dispatch (30 seconds)
Trigger the reminder dispatcher via CLI or curl:
```bash
curl -X GET "http://localhost:3000/api/cron/reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Verify the response returns `{ "success": true, "processed": ..., "sent": ... }`.
