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
  - Strict price bounds validation: Parsed rupee figures must fall within the developer's registered portfolio band (Rs 65 Lakh to Rs 1.20 Crore).
  - Any violation immediately replaces the assistant's reply with a neutral, RERA-grounded compliance disclaimer, records the violation in the message payload, flags the conversation, and dispatches a high-priority handoff to a sales executive.
- **Rate Limiting & Abuse Prevention:**
  - In-memory sliding window rate limiter protects endpoints:
    - 15 requests / minute per active lead session.
    - 30 requests / minute per client IP address.
  - HTTP 429 is returned gracefully with localized retry suggestions when thresholds are exceeded.
- **Session Security & Booking Lead Authorization:**
  - Public prospective buyers obtain a signed, HTTP-only JWT cookie (`proplead_lead_session`, 24h validity) upon starting a chat (`/api/chat/start`).
  - All public booking actions (`POST /api/bookings`, `/cancel`, `/reschedule`) cryptographically derive `leadId` directly from the verified session token. Any `leadId` supplied in the JSON request body is strictly discarded for buyer sessions to prevent account impersonation or unauthorized booking mutations.
- **Executive Handoff Logic:**
  - Handoff requests assign the lead to their currently assigned sales executive. If unassigned, the system automatically selects the executive with the lowest count of open active leads.
  - Generates structured contextual summaries (buyer sentiment, preferred BHK, budget range, key inquiries, open questions, and recommended next action) with fallback if LLM summarization is unavailable.
  - Idempotent: Subsequent handoff requests within a 2-hour window reuse the existing open handoff record.

## 6. Demo Credentials & Interactive Preview
- **Session Tokens & Cookie Policy:**
  - User authentication relies on secure, `HttpOnly`, `SameSite=Lax` cookies containing encrypted JWT tokens (via `jose`).
  - Role hierarchy:
    - `admin`: Full administrative access (fact sheets, slot inventory, review queue, metrics, executive tools).
    - `executive`: Lead pipeline, assigned visit schedules, handoff summaries.
    - `buyer`: Lead qualification, interactive assistant, visit booking management.
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
