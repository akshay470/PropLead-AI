# Project Assumptions & Design Decisions

This document records the operational, architectural, and regulatory assumptions made during the development of PropLead AI.

## 1. Regulatory & Compliance Assumptions
- **Public Buyer Experience & DPDP Consent:**
  - The buyer chat experience (`/chat` and `/api/chat/**`) is **strictly public** and requires no user registration, login, or session cookies.
  - Before starting a chat, prospective buyers must explicitly toggle an affirmative DPDP Act 2023 consent checkbox. Once checked, the conversation begins and lead details are collected and stored/matched.
  - An opt-out mechanism immediately flags `opted_out = true` on the lead record, halting any automated messaging, follow-ups, or reminders.
- **RERA Registration & Grounded Fact Sheet:**
  - Standard Gujarat RERA format (`PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA...`) is referenced using clearly marked placeholder test numbers (e.g. `PR/GJ/AHMEDABAD/DEMO-0001` and `PR/GJ/AHMEDABAD/DEMO-0002`).
  - **Fictional Demo Fact Sheet:** All fact sheet questions and answers are fictional demo data created for Company A's projects, strictly conforming to statutory RERA rules:
    - Only price ranges per BHK (e.g. Rs 75L - Rs 88L for 2 BHK; Rs 98L - Rs 1.20Cr for 3 BHK).
    - **NO** final prices, **NO** discounts, **NO** promotional cashbacks, and **NO** payment-plan promises.
    - **NO** speculative claims (e.g. "assured returns", "highest appreciation", "best investment").
    - Missing facts trigger graceful handoff to a sales executive rather than hallucination.
  - All promotional copy and chat footers include the project RERA registration identifier and a mandatory statutory disclaimer that promotional details do not supersede registered approvals.

## 2. Real Estate Operations & Inventory
- **Client Developer Profile:**
  - Company A operates 2 residential projects in Ahmedabad:
    - *Project 1 (The Grand Orchard):* SG Highway, Bodakdev (23.0338° N, 72.5072° E).
    - *Project 2 (Serene Meadows):* South Bopal / Shela (23.0125° N, 72.4589° E).
  - Unit configurations: 2 BHK and 3 BHK.
  - Total apartments: 420.
  - Price band: Rs 65 Lakh to Rs 1.2 Crore.
- **Site Visit Slots:**
  - Standard slot duration is **60 minutes** per executive visit appointment.
  - Operating hours: 10:00 to 18:00 (last slot starts at 17:00), Monday through Saturday, covering a rolling 14-day window.
  - 4 sales executives are divided across projects (Rajesh & Ananya for Project 1; Priya & Amit for Project 2).
  - **Derived Slot Free Status:** Slot "free" availability is strictly derived via database query (`LEFT JOIN bookings WHERE bookings.status = 'confirmed' AND bookings.id IS NULL`), never relying on a mutable status flag that could drift out of sync.
  - **2-Hour Cutoff Rule:** Slots starting less than 2 hours from current time are excluded from free slot listings to avoid operational chaos at the sales gallery.
- **Advertising Spend:**
  - Monthly advertising budget is modeled at ~Rs 30 Lakh per month across 4 channels:
    - Property Portals: Rs 14.5 Lakh
    - Social Media Ads: Rs 9.8 Lakh
    - Hoarding Call Numbers: Rs 3.7 Lakh
    - Website & Organic: Rs 2.0 Lakh

## 3. Database Integrity & Concurrency Control
- **Strict Double-Booking Prevention (Database Level):**
  - Guaranteed at the PostgreSQL engine level via a **Partial Unique Index**:
    `CREATE UNIQUE INDEX confirmed_slot_unique_idx ON bookings (slot_id) WHERE status = 'confirmed';`
  - Together with slot-level uniqueness:
    `CREATE UNIQUE INDEX visit_slots_executive_starts_unique ON visit_slots (executive_id, starts_at);`
  - When two simultaneous requests attempt to book the same slot, the losing transaction triggers Postgres error `23505` (unique violation). `bookingService.bookVisit` catches `23505` and returns a typed `SLOT_TAKEN` result with 3 alternative free slots rather than throwing a 500 error.
- **Atomic Reschedule:**
  - Rescheduling executes inside a single database transaction: verifies and locks the new slot, cancels the existing booking, creates the new booking, and updates reminder schedules. If any step fails, the entire transaction rolls back, guaranteeing a lead never ends up with 0 or 2 confirmed bookings.
- **Single Confirmed Booking Per Project Rule:**
  - A prospective buyer lead can hold at most one confirmed upcoming visit per project at any given time. If they wish to change, the reschedule flow must be used.
- **Deduplication Engine:**
  - Deduplication matches incoming leads on primary key (normalized E.164 phone number) and secondary key (case-insensitive email).
  - The oldest matching lead record remains canonical.
  - Subsequent duplicates preserve their original acquisition channel `source` to retain marketing attribution while linking via `duplicate_of_id`.

## 4. Communication & Messaging
- **Mocked Messaging Layer:**
  - WhatsApp, SMS, and Email messaging are decoupled behind an asynchronous interface (`MessageService`).
  - Outgoing dispatches are mocked and recorded in the `message_log` table with channel, recipient, template name, body, and status (`queued`, `sent`, `delivered`, `failed`).
- **Reminders Schedule & Cutoffs:**
  - Automated reminder intervals are configured for:
    - 24 hours (1 day) prior to the visit appointment.
    - 2 hours prior to the scheduled slot time.
  - **Cutoff skips:** If a visit is booked < 24 hours before the appointment, the 1-day reminder is automatically skipped. If < 2 hours, both reminders are skipped.
  - **Cron Dispatcher:** `GET /api/cron/reminders` runs periodically (configured in `vercel.json`), protected by `Bearer ${CRON_SECRET}`. It processes pending due reminders, skips opted-out leads and cancelled bookings, and logs dispatches to `message_log`.

## 5. AI Assistant, Guardrails & Security
- **LLM Architecture & Swappable Providers:**
  - AI chat runs through the `ILlmProvider` abstraction (`src/server/ai/provider.ts`), supporting zero-cost deterministic mock execution (`MockLlmProvider`) for CI/tests/evals and real cloud inference (`GeminiProvider`) via `LLM_PROVIDER=gemini` and `LLM_API_KEY`.
  - Configured with a 10-second timeout, 1 automatic retry, and a maximum 5-turn tool calling loop per message turn.
  - Safe failure tolerance: If the provider experiences downtime or timeouts, the chat never throws a 500 error or hangs. Instead, it responds with a polite localized apology, automatically creates a handoff to an executive, and flags the conversation for review.
- **Code-Level Output Guardrail (Price & Claims Inspection):**
  - Prompt instructions alone are insufficient for real estate compliance. PropLead AI uses an algorithmic post-generation code guardrail (`src/server/ai/guardrails/price-checker.ts`) that inspects every assistant message before it reaches the buyer.
  - Regex AST & Unicode script boundaries detect any attempt to offer discounts, negotiate, confirm final pricing, or make speculative guarantees across English, Hindi (e.g. `छूट`, `सौदा`, `गारंटी`), and Gujarati (e.g. `સસ્તી`, `છૂટ`, `ખાતરી`).
  - **Tightened Price Guardrail:** Rupee amounts must strictly match registered BHK price endpoints ([65, 75, 76, 85, 88, 98, 105, 120] Lakhs) from the project fact sheets, rather than arbitrary numbers within the band. Phrasing that presents a single figure as the price ("priced at", "costs exactly", "final price") without a clear range is immediately flagged.
  - Any violation replaces the assistant's reply with a neutral, RERA-grounded compliance disclaimer, records the violation in the message payload, flags the conversation, and dispatches a high-priority handoff to a sales executive.
- **DPDP Opt-Out Detection:**
  - Precise keyword and phrase matching: triggers only on exact keywords (`STOP`, `UNSUBSCRIBE`, `बंद करो`, `रोकें`, `रोको`, `રોકો`, `બંધ કરો`) or clear phrases like `stop messaging me` / `मुझे मैसेज मत भेजो`.
  - Words like "cancel" / "रद्द" / "રદ" inside visit requests (e.g., "cancel my visit" or "मेरी विजिट रद्द करें") do NOT opt out. Ambiguous queries trigger a polite confirmation prompt before opting out.
- **DB-Backed Atomic Rate Limiter:**
  - PostgreSQL-backed rate limiter (`rate_limit_buckets` table) ensuring rate limits hold across serverless and multi-instance deployments:
    - 15 messages / minute per lead chat session.
    - 30 messages / minute per client IP address.
  - Gracefully falls back to in-memory sliding window if the database is temporarily unreachable.
  - HTTP 429 returns clear localized retry warnings with countdown timers.
- **Autonomous AI Evals Suite:**
  - `docs/ai-evals.md` tracks all 25 automated evaluation scenarios across compliance, prompt injection resistance, multilingual comprehension (en/hi/gu/hinglish), and tool calling.
  - Every eval run explicitly documents provider, model name (`MOCK: deterministic-mock-v1` or `GEMINI: gemini-2.5-flash`), and execution timestamp. Mock-dependent edge cases are isolated in unit tests.
- **Session Security & Booking Lead Authorization:**
  - Public prospective buyers obtain a signed, HTTP-only JWT cookie (`proplead_lead_session`, 24h validity) upon starting a chat (`/api/chat/start`).
  - All public booking actions (`POST /api/bookings`, `/cancel`, `/reschedule`) cryptographically derive `leadId` directly from the verified session token. Any `leadId` supplied in the JSON request body is strictly discarded for buyer sessions to prevent account impersonation or unauthorized booking mutations.
- **Executive Handoff Logic & Status Lifecycle:**
  - Handoff requests assign the lead to their currently assigned sales executive or auto-assign via round-robin.
  - Generates structured contextual summaries (buyer sentiment, preferred BHK, budget range, key inquiries, open questions, and recommended next action).
  - Lifecycle: `open` -> `contacted` -> `resolved`, with executive audit notes.
  - Idempotent: Subsequent handoff requests within a 2-hour window reuse the existing open handoff record.

## 6. Business Timezone, Scheduling & Cron Architecture (Step 6)
- **Timezone Invariance (Asia/Kolkata, UTC+05:30):**
  - All real estate development, sales gallery hours, site visit appointments, reminder triggers, and performance aggregations run in **Asia/Kolkata** (IST).
  - While PostgreSQL stores standardized UTC timestamps, all date math ("tomorrow", "start of day", "24 hours prior", "2 hours prior", slot hours 10:00 to 18:00 IST) is calculated explicitly using `@/lib/timezone.ts`.
  - Machine independence: The entire codebase produces identical results whether executing in local IST, on a UTC serverless runtime (e.g. Vercel), or across different host operating systems.
  - The iCalendar (.ics) exports format calendar dates using strict UTC strings (`YYYYMMDDTHHMMSSZ`) to guarantee that buyer calendar apps (Google Calendar, Apple Calendar, Outlook) render the site visit at the exact scheduled IST time.
- **Dual Cron Architecture for Free Hosting:**
  - Vercel Hobby accounts enforce a strict limit of one scheduled cron job per day.
  - `vercel.json` defines a daily safety cron (`0 0 * * *`) calling `GET /api/cron/reminders`.
  - For continuous operational precision (15-minute polling intervals for 2-hour and 24-hour reminders), PropLead AI provides `.github/workflows/reminders.yml`, an automated GitHub Actions cron workflow running every 15 minutes (`*/15 * * * *`). It authorizes via repository secrets `APP_URL` and `CRON_SECRET`.
  - For live interactive demonstrations and fallbacks, `POST /api/admin/reminders/run` provides an admin-authenticated trigger with a "Send Due Reminders Now" button on `/admin/dashboard`.
- **Statutory Notification Templates (v1.2.0):**
  - All outbound message templates (`1-day reminder`, `2-hour reminder`, `booking confirmation`, `reschedule`, `cancellation`, and `opt-out confirmation`) are consolidated in `src/server/services/notifications/templates.ts`.
  - Every reminder strictly contains:
    1. Residential project name.
    2. Appointment date and time in IST (e.g. "Wed, 4 Nov 2026 at 11:00 AM IST").
    3. Dedicated sales executive name.
    4. Google Maps live GPS navigation pin link.
    5. Approved Gujarat RERA registration number.
    6. DPDP statutory opt-out instruction ("Reply STOP to opt out").
- **Admin Slot & Rota Scheduling (`/admin/slots`):**
  - Week-by-week rota grid organized by hour (10:00 to 18:00 IST, 60-min slots) and day (Mon–Sun).
  - **Idempotent Slot Generation:** Backed by database unique index `(executive_id, starts_at)` and `ON CONFLICT DO NOTHING`. Re-running slot generation over overlapping date ranges creates only new slots and cleanly skips existing ones without throwing errors or creating duplicates.

## 7. Security Hardening, Edge Cases & Compliance (Step 7)
- **DPDP 180-Day Data Retention Assumption:**
  - In accordance with DPDP Act 2023 principles of storage limitation, personal lead data, conversational transcripts, and handoff summaries are retained for an assumed operational window of **180 days** from initial enquiry or appointment completion, after which records are archived or anonymized.
  - Aggregated statistical indicators (lead counts, conversion rates, channel ROI) are preserved indefinitely without PII.
- **Login Brute-Force & Enumeration Protections:**
  - Rate limiting enforced at 5 attempts/minute per email and 20 attempts/minute per IP address via PostgreSQL-backed buckets (`rate_limit_buckets`), responding with HTTP 429 and `Retry-After: 60`.
  - Constant-time verification: When an unregistered email is submitted, a pre-computed dummy bcrypt hash (`DUMMY_BCRYPT_HASH`) is verified to prevent timing-based user enumeration.
- **Strict Role-Based Account Provisioning:**
  - Public registration (`POST /api/auth/register`) strictly assigns `role: "buyer"` and `isAdmin: false`, stripping any injected role parameters.
  - Internal staff accounts (executives and administrators) are provisioned exclusively via database seed or the admin-protected route `POST /api/admin/users`.
- **Object-Level Access Control (IDOR Prevention):**
  - Sales executives can only read and update leads, visits, handoffs, and transcripts assigned to their user ID or unassigned pool.
  - Buyers are strictly bound to their signed `leadSession` cookie and cannot cancel, reschedule, or view appointments of other buyers.
- **Adversarial Prompt Injection & PII Exfiltration Resistance:**
  - The AI assistant treats user prompts strictly as untrusted data, refusing system overrides, roleplay pricing jailbreaks, or fake delimiter injections.
  - Cross-buyer privacy: The assistant strictly refuses to disclose other buyers' names, phone numbers, or appointment times under any hypothetical scenario.
  - Evaluated continuously against a comprehensive 30-scenario test suite (`scripts/eval-ai.ts` & `docs/ai-evals.md`).
- **Seed Safety Guard:**
  - Direct database seeding (`pnpm run seed`) enforces `ALLOW_SEED=true` to prevent accidental data destruction in staging or production environments.

  - **Booking Protection on Slot Mutation:** Visit slots with active confirmed bookings can NEVER be deleted or blocked. The system rejects such mutations with an explicit error, directing administrators to reschedule or cancel the booking through the visits dashboard first, preventing orphaned bookings.
  - **Executive Project Coverage:** Configures which residential projects each sales executive attends visits for.
  - **Project Location & GPS Pins:** Coordinates (lat/lng) and physical addresses can be edited directly with a live "Open in Google Maps" verification link.
- **Outbound Message Audit Log (`/admin/messages`):**
  - Read-only statutory log of all outgoing notifications dispatched via WhatsApp, SMS, or email.
  - **Privacy Masking:** Recipient contact numbers are masked to the last 4 digits (e.g., `+91 ******1234` or `a***@example.com`) to protect buyer personal data in accordance with DPDP Act 2023.

## 7. Screens & Access Control
- **Session Tokens & Cookie Policy:**
  - User authentication relies on secure, `HttpOnly`, `SameSite=Lax` cookies containing encrypted JWT tokens (via `jose`).
  - Role hierarchy:
    - `admin`: Full administrative access (dashboard analytics, fact sheets, slot inventory, rota generation, coverage, review queue, message audit log).
    - `executive`: Personal performance dashboard, lead pipeline, assigned visit schedules, handoff summaries, lead detail.
    - `buyer`: Lead qualification, interactive assistant, visit booking management (no login required on `/chat`).
- **Screen Inventory:**
  - `/chat`: Public buyer experience. Warm ivory `#FAF8F5`, bronze `#8C653D` accents, Noto Sans fallback stack, persistent "Talk to a person" header button, day-grouped slot chips, inline `BookingConfirmationCard`, multilingual UI strings (en/hi/gu), DPDP consent screen with persistent "Stop messages" confirmation modal, session resume from `/api/chat/history`, 429 rate limit warning, retry handling, 44px min tap targets.
  - `/admin/dashboard`: Executive sales performance & attribution dashboard. Range switcher (7 / 30 / 90 days), primary KPI comparison cards against pre-AI developer baselines ("Before: 14 h / 35%"), Speed-to-Lead SLA breakdown (&le; 2m, &le; 5m, unreached 48h), SVG response time trend line and cost-per-visit bar charts with accessible table toggle, by-source economics table (portals, social, website, hoardings) with best/worst conversion badges, "How this is calculated" methodology modal, and live "Send Due Reminders Now" trigger.
  - `/executive/dashboard`: Trimmed personal performance view for logged-in sales executives showing individual response latency, assigned unique leads, completed visits, and personal show-up rate.
  - `/admin/slots`: Weekly appointment schedule editor and rota grid. Week navigation (previous, next, today), project/executive filters, free/booked/blocked indicators with buyer details and block reasons, idempotent slot generator modal, individual slot or full-day block modal, executive project coverage editor, and project location / GPS pin editor with live Google Maps preview.
  - `/admin/messages`: Read-only message log viewer. Filter by channel and status, table with masked recipients (`+91 ******1234`), template version names, and inspection modal displaying full rendered notification text with statutory disclosures.
  - `/executive/leads`: Unified leads list with status filtering, duplicate linking/unlinking, and direct navigation to lead details.
  - `/executive/leads/[id]`: Comprehensive lead detail view with "DO NOT CONTACT" banner if opted-out, phone tap-to-call, AI handoff brief card, booking card with mark visited/no-show/cancel, automated reminder timeline (WhatsApp), and full chat transcript with quiet tool events.
  - `/executive/handoffs`: Sales executive handoff inbox with Open/Done tabs, reason badges, time ago, summary cards, status update modal (`open` -> `contacted` -> `resolved`), and link to lead view.
  - `/executive/visits`: Executive calendar and visit slot scheduler with race-condition prevention.
  - `/admin/review`: Sales Head flagged chat review queue with daily digest metrics cards (flagged today, reviewed today, pending review), reason badges, highlighted offending trigger, transcript toggle, mark reviewed modal with audit notes, executive reassignment, and "Add to Fact Sheet" navigation.
  - `/admin/facts`: Fact Sheet & Knowledge Base Editor with project and category filters, search bar, Add Fact modal (prefilled via query params from review queue), Edit/Delete actions with confirm, and active RERA price guardrail compliance validation.
- **Demo Accounts (Seeded via `pnpm run seed`):**
  - **Shared Demo Password:** `DemoPass123!`
  - **Sales Head (Admin):** `admin@example.com`
  - **Sales Executive 1:** `rajesh@example.com`
  - **Sales Executive 2:** `ananya@example.com`
  - **Sales Executive 3:** `priya@example.com`
  - **Sales Executive 4:** `amit@example.com`
  - **Demo Prospective Buyer:** `buyer@example.com`
- **Interactive Preview Harness:**
  - `/book-preview` provides an interactive demonstration screen allowing executives to test slot picking, race-condition handling, and .ics calendar generation prior to the Step 4 AI assistant integration.
