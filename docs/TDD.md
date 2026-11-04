# PropLead AI — Technical Design Document

**Project:** PropLead AI  
**Author:** Akshay (`akshay470`)  
**GitHub Repository:** [https://github.com/akshay470/PropLead-AI](https://github.com/akshay470/PropLead-AI)  
**Live Application:** `<ADD URL>`  
**Date:** November 2026  
**Document Version:** 1.0.0  

---

## 1. Problem and Client Context

### 1.1 Developer Profile & Inventory
"Company A" is an established residential real estate developer based in Ahmedabad, Gujarat, currently developing and marketing two premier live residential projects totaling 420 apartments:
* **Project 1 (The Grand Orchard):** Luxury 3 & 4 BHK residences situated on SG Highway, Bodakdev (Ahmedabad West). Price band: **Rs 95 Lakh to Rs 1.20 Crore**.
* **Project 2 (Serene Meadows):** High-efficiency 2 & 3 BHK residences situated in South Bopal / Shela. Price band: **Rs 65 Lakh to Rs 88 Lakh**.

The company operates with a sales team of **11 staff members** (modeled in this system as 4 front-line sales executives, 1 sales head/admin, and 6 telecallers/field representatives).

### 1.2 The Operational Bottleneck
Company A generates approximately **3,000 inquiries per month** across four primary acquisition channels:
1. Property Portals (99acres, MagicBricks, Housing.com)
2. Social Media Ads (Meta Facebook & Instagram Lead Ads)
3. Hoarding Phone Numbers & Outdoor Billboards
4. Developer Website & Organic Search

Prior to PropLead AI, incoming leads were manually aggregated into an email inbox and exported to Excel spreadsheets. A telecaller team attempted callbacks the following morning during office hours. This manual workflow resulted in catastrophic funnel friction:
* **Median First Response Time:** **14 hours** (industry benchmark is under 5 minutes).
* **Unreached Inquiries:** **35% of leads** were never successfully contacted within 48 hours of initial intent.
* **Lead-to-Site-Visit Conversion:** Only **6.0%** of captured leads resulted in a physical site visit appointment.
* **Compliance Exposure:** Manual telecaller interactions frequently made speculative pricing promises or unverified possession commitments, exposing the developer to statutory penalties under the Gujarat Real Estate Regulatory Authority (RERA).

### 1.3 Key Performance Targets
| Funnel Metric | Client Baseline | PropLead AI Target |
|:---|:---:|:---:|
| Median First Response Time | 14 hours | **< 5 minutes (Instant 24/7)** |
| Inquiries Unreached in 48 Hours | 35.0% | **< 5.0%** |
| Lead-to-Site-Visit Conversion Rate | 6.0% | **&ge; 8.0%** |
| Regulatory Compliance Rate | Unmonitored | **100% RERA & DPDP Guarded** |

---

## 2. Scope: What Was Built (Core Slice)

To solve Company A's bottleneck within a focused solo engineering assignment, a robust core slice was implemented:

| Capability / Module | Status | Description |
|:---|:---:|:---|
| **Public Buyer Chat Experience (`/chat`)** | **Done** | Public, responsive web chat requiring affirmative DPDP consent without login barriers. |
| **Multilingual AI Assistant (EN / HI / GU)** | **Done** | Autonomous conversational agent answering project queries in English, Hindi, and Gujarati. |
| **RERA Fact Sheet Grounding & Price Guardrails** | **Done** | Post-generation code guardrail enforcing strict RERA price ranges and rejecting speculative claims. |
| **Site Visit Booking Engine** | **Done** | Real-time slot discovery and double-booking prevention with transactional concurrency locks. |
| **Duplicate Lead Detection Engine** | **Done** | E.164 phone & lowercase email deduplication preserving original marketing attribution. |
| **Executive Handoff Lifecycle** | **Done** | Structured AI summaries, sentiment scoring, and round-robin assignment to sales executives. |
| **Executive Visit Management Screen** | **Done** | Daily agenda, outcome marking (`visited` vs `no_show`), and verified buyer contact details. |
| **Automated Visit Reminder System** | **Done** | 24-hour and 2-hour multi-channel reminders with downloadable calendar `.ics` passes. |
| **Sales Head (Admin) Slot Editor** | **Done** | Interactive 7-day visual slot management grid for capacity management and overrides. |
| **Sales Head Flagged Chat Review Queue** | **Done** | Moderation dashboard for inspecting guardrail violations and reassigning conversations. |
| **Portfolio Source Dashboard** | **Done** | Channel CAC, CPV, visit conversion rates, and response time metrics across 3,000+ monthly leads. |
| **DPDP Compliance & Data Masking** | **Done** | Phone masking (`+91 ******1234`), opt-out parsing, and one-click data anonymization. |
| *Live WhatsApp / SMS Delivery* | *Mocked* | Decoupled behind asynchronous `MessageService` with persistent audit logs (`message_log`). |
| *Token Payment Gateway* | *Cut* | Out of scope for initial 7-day assignment; scheduled for Phase 2. |
| *Live VoIP / PBX Telephony Integration* | *Cut* | Replaced by instant executive chat handoffs and calendar `.ics` passes. |

---

## 3. Architecture and Why

### 3.1 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Clients["Client Access Layers"]
        BuyerClient["Public Buyer Mobile / Web (/chat)"]
        ExecClient["Executive Portal (/executive/**)"]
        AdminClient["Sales Head Portal (/admin/**)"]
    end

    subgraph AppServer["Next.js 14 App Router (Full-Stack Engine)"]
        Middleware["Edge Auth & DPDP Middleware"]
        APIRoutes["Route Handlers (/api/**)"]
        RSC["React Server Components"]
        
        subgraph Services["Core Application Services"]
            IngestService["Lead Ingestion & Dedupe Service"]
            BookingService["Booking Engine & Row Locker"]
            HandoffService["Executive Handoff Service"]
            ReminderService["Reminder Scheduler & Worker"]
            GuardrailEngine["Price & Claims Guardrail Engine"]
            AgentLoop["Autonomous AI Agent Loop"]
        end
    end

    subgraph Persistence["Storage & Data Engine"]
        PostgresDB[("PostgreSQL 15+ / Neon Serverless<br/>(Drizzle ORM + Partial Unique Index)")]
    end

    subgraph ExternalServices["External Infrastructure"]
        GeminiAPI["Google Gemini 1.5 Flash API"]
        MockLLM["Deterministic Mock LLM Engine"]
        CronRunner["GitHub Actions 15-Min Cron Runner"]
    end

    BuyerClient -->|HTTPS / Public Session Cookie| Middleware
    ExecClient -->|HTTPS / Staff JWT Cookie| Middleware
    AdminClient -->|HTTPS / Admin JWT Cookie| Middleware

    Middleware --> APIRoutes
    Middleware --> RSC
    APIRoutes --> Services
    RSC --> Services

    Services -->|ACID SQL & Row Locks| PostgresDB
    AgentLoop -->|ILlmProvider Interface| GeminiAPI
    AgentLoop -.->|Test / Offline Fallback| MockLLM
    CronRunner -->|Bearer CRON_SECRET| APIRoutes
```

### 3.2 Technology Decisions & Trade-Off Analysis

#### 1. Framework: Next.js 14 (App Router) vs. Remix / SPA + Vite
* **Chosen:** Next.js 14 App Router with React 18, Server Components, and API Route Handlers.
* **Why:** Provides a unified TypeScript codebase for public buyer experiences, secure staff portals, and high-performance serverless endpoints. React Server Components eliminate client-side waterfall queries on data-dense dashboards while keeping sensitive database credentials strictly off client bundles.
* **Rejected Alternative:** Separate Vite React SPA + Express API. Would double deployment complexity, require CORS ceremony, and duplicate type definitions across repositories.

#### 2. Database: PostgreSQL 15+ (Neon Serverless) vs. MongoDB / Document Store
* **Chosen:** Relational PostgreSQL with Drizzle ORM.
* **Why:** Real estate inventory management demands strict ACID transactions and engine-level concurrency constraints. Preventing double-booked visit slots requires database-level partial unique indexes (`confirmed_slot_unique_idx`) and `SELECT ... FOR UPDATE` row locks, which document databases cannot guarantee under race conditions without fragile distributed locking mechanisms.
* **Rejected Alternative:** MongoDB. Risk of split-brain booking states and complex multi-document rollback overhead during slot rescheduling.

#### 3. ORM: Drizzle ORM vs. Prisma
* **Chosen:** Drizzle ORM.
* **Why:** Zero-overhead, lightweight TypeScript SQL mapper that compiles down to clean SQL without a heavy C++ query engine binary. Drizzle supports native PostgreSQL transactions, partial indexes, and raw SQL locking clauses (`FOR UPDATE`) with near-zero cold start overhead in serverless environments.
* **Rejected Alternative:** Prisma ORM. Prisma's heavy query engine binary adds 300ms–800ms to serverless cold starts on Vercel and lacks native syntax for PostgreSQL partial unique indexes.

#### 4. Session & Authentication: Stateless HTTP-Only JWT Cookies vs. Stateful Redis Sessions
* **Chosen:** Dual signed JWT HTTP-only cookies (`proplead_session` for staff, `proplead_lead_session` for buyers).
* **Why:** Eliminates external Redis infrastructure dependencies while guaranteeing tamper-proof identity propagation across serverless lambdas. The buyer token binds the prospective buyer's `leadId` directly to their chat conversation without requiring user account creation.
* **Rejected Alternative:** Redis Session Store. Introduces unnecessary operating costs and infrastructure points of failure for a solo developer assignment.

#### 5. AI Provider Abstraction: Swappable `ILlmProvider` vs. Direct OpenAI SDK
* **Chosen:** Pluggable provider interface supporting **Google Gemini 1.5 Flash** and a **Deterministic Mock Engine**.
* **Why:** Allows 100% deterministic, offline automated evaluation benchmarks (30/30 passed) and zero-cost local test execution without exposing live API keys or incurring cloud API billing during CI. Gemini 1.5 Flash provides exceptional multilingual parsing for Indic languages (Hindi and Gujarati) at negligible latency.
* **Rejected Alternative:** Hardcoded OpenAI SDK. Creates tight vendor lock-in and breaks automated CI pipelines when cloud credentials or credits expire.

#### 6. Scheduled Automation: Dual Cron (GitHub Actions 15-Min + Vercel Daily Fallback)
* **Chosen:** A 15-minute GitHub Actions workflow runner calling `GET /api/cron/reminders` with a shared `CRON_SECRET`, backed by a once-daily Vercel Hobby cron.
* **Why:** Vercel Hobby limits cron schedules to once per day. The 15-minute GitHub Actions workflow provides enterprise-grade, sub-hour reminder precision at zero hosting cost.

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ LEADS : "manages (assigned_executive)"
    USERS ||--o{ VISIT_SLOTS : "hosts"
    USERS ||--o{ BOOKINGS : "conducts"
    USERS ||--o{ HANDOFFS : "assigned_to"

    PROJECTS ||--o{ LEADS : "enquired_for"
    PROJECTS ||--o{ FACT_SHEET_ENTRIES : "contains"
    PROJECTS ||--o{ VISIT_SLOTS : "hosts_at"
    PROJECTS ||--o{ AD_SPEND : "incurs"

    LEADS ||--o{ CONVERSATIONS : "engages_in"
    LEADS ||--o{ BOOKINGS : "books"
    LEADS ||--o{ HANDOFFS : "escalated_via"
    LEADS ||--o{ REMINDERS : "notified_by"
    LEADS ||--o{ LEADS : "duplicate_of"

    CONVERSATIONS ||--o{ MESSAGES : "contains"
    CONVERSATIONS ||--o{ HANDOFFS : "initiates"

    VISIT_SLOTS ||--o{ BOOKINGS : "reserved_by"
    BOOKINGS ||--o{ REMINDERS : "schedules"

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string name
        enum role "buyer|executive|admin"
        boolean is_admin
        string phone
        boolean active
    }

    PROJECTS {
        uuid id PK
        string name
        string code UK
        string location
        integer total_units
        integer price_range_min
        integer price_range_max
        string rera_number
        decimal latitude
        decimal longitude
    }

    LEADS {
        uuid id PK
        string lead_code UK
        string name
        string phone
        string email
        uuid project_id FK
        enum source "portal|social|hoarding|website"
        enum stage "new|contacted|qualified|visit_booked|visited|lost"
        boolean consent_given
        boolean opted_out
        uuid duplicate_of_id FK
        timestamp first_response_at
        uuid assigned_executive_id FK
        text notes
    }

    FACT_SHEET_ENTRIES {
        uuid id PK
        uuid project_id FK
        string category
        string question_key
        text answer_text
        string language
    }

    VISIT_SLOTS {
        uuid id PK
        uuid project_id FK
        uuid executive_id FK
        timestamp starts_at
        timestamp ends_at
    }

    BOOKINGS {
        uuid id PK
        uuid slot_id FK
        uuid lead_id FK
        uuid project_id FK
        uuid executive_id FK
        timestamp starts_at
        timestamp ends_at
        enum status "confirmed|cancelled|completed|no_show"
        enum outcome "pending|visited|no_show"
        timestamp cancelled_at
    }

    REMINDERS {
        uuid id PK
        uuid booking_id FK
        uuid lead_id FK
        enum reminder_type "day_before|two_hours_before"
        timestamp scheduled_for
        enum status "pending|sent|cancelled|failed"
        timestamp sent_at
    }

    CONVERSATIONS {
        uuid id PK
        uuid lead_id FK
        uuid project_id FK
        enum channel "chat|whatsapp"
        string language
        boolean flagged
        string flag_reason
        boolean resolved
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        enum sender_type "buyer|assistant|executive|system"
        text content
        enum message_type "text|tool_call|tool_result|compliance_notice"
        jsonb metadata
    }

    HANDOFFS {
        uuid id PK
        uuid conversation_id FK
        uuid lead_id FK
        uuid executive_id FK
        enum status "open|contacted|resolved"
        string reason
        jsonb summary
        text executive_notes
    }

    AD_SPEND {
        uuid id PK
        uuid project_id FK
        enum channel "portal|social|hoarding|website"
        string month
        decimal amount
    }

    RATE_LIMIT_BUCKETS {
        string key PK
        integer count
        timestamp expires_at
    }
```

### 4.2 Key Schema Constraints & Guarantees
1. **Double-Booking Engine Constraint:**
   ```sql
   CREATE UNIQUE INDEX confirmed_slot_unique_idx 
   ON bookings (slot_id) 
   WHERE status = 'confirmed';
   ```
   Ensures that no two confirmed bookings can ever point to the same `slot_id`.
2. **Executive Scheduling Uniqueness:**
   ```sql
   CREATE UNIQUE INDEX visit_slots_executive_starts_unique 
   ON visit_slots (executive_id, starts_at);
   ```
   Prevents an executive from having overlapping or duplicate slot generation.
3. **Derived Slot Availability:**
   Slot availability is never stored as a mutable boolean on `visit_slots` (which could drift out of sync). Instead, "free" status is dynamically computed:
   ```sql
   LEFT JOIN bookings ON bookings.slot_id = visit_slots.id AND bookings.status = 'confirmed'
   WHERE bookings.id IS NULL
   ```
4. **Canonical Lead Deduplication:**
   Incoming inquiries matching an existing E.164 phone or lowercase email link to the canonical lead via `leads.duplicate_of_id`, preserving the original inquiry's attribution channel while aggregating activity.

---

## 5. Main Flows

### 5.1 Buyer Chat Start & Affirmative DPDP Consent

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Prospective Buyer
    participant UI as Web Chat UI (/chat)
    participant API as POST /api/chat/start
    participant Ingest as Ingestion Service
    participant DB as PostgreSQL

    Buyer->>UI: Fills Name, Phone (+91), Project & Checks DPDP Consent
    UI->>API: POST /api/chat/start { name, phone, consent: true, ... }
    alt Consent Checkbox Unchecked
        API-->>UI: 400 Bad Request ("Affirmative DPDP consent required")
    else Consent Affirmed
        API->>Ingest: createLeadFromEnquiry(input)
        Ingest->>DB: Query Lead by E.164 Phone or Email
        alt Existing Lead Match
            Ingest->>DB: INSERT Lead (duplicate_of_id = canonical.id)
        else Fresh Lead
            Ingest->>DB: INSERT Lead (canonical)
        end
        API->>DB: INSERT Conversation
        API-->>UI: Set-Cookie: proplead_lead_session (Signed JWT)<br/>{ success: true, conversationId, leadCode }
        UI-->>Buyer: Displays Welcome Message & Project Quick Prompts
    end
```

### 5.2 AI Fact Sheet Answering with Code-Level Price Guardrail

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Prospective Buyer
    participant ChatAPI as POST /api/chat/message
    participant Agent as Autonomous Agent Loop
    participant Guardrail as Price & Claims Checker
    participant DB as PostgreSQL
    participant LLM as Gemini 1.5 Flash

    Buyer->>ChatAPI: "What is the final price for a 2 BHK in Shela? Can I get a discount?"
    ChatAPI->>Agent: runAgentTurn(conversationId, message)
    Agent->>DB: Fetch Project RERA Fact Sheet Entries
    Agent->>LLM: Prompt with Fact Sheet Grounding
    LLM-->>Agent: Raw Reply: "Our 2 BHK is priced at Rs 65 Lakh, but we can offer a 5% discount."
    Agent->>Guardrail: checkPriceCompliance(reply, projectEndpoints)
    Note over Guardrail: Regex AST detects illegal single-point pricing<br/>and discount term violation ("discount")
    Guardrail-->>Agent: VIOLATION: discount_or_exact_price_promise
    Agent->>DB: Flag Conversation (flag_reason: guardrail_violation)
    Agent->>DB: Auto-create High-Priority Executive Handoff
    Agent-->>ChatAPI: Safe RERA Disclaimer:<br/>"Our 2 BHK homes in Shela are priced between Rs 65 Lakh and Rs 76 Lakh.<br/>Final pricing and payment schedules are exclusively finalized at the sales gallery."
    ChatAPI-->>Buyer: Localized Compliant Response
```

### 5.3 Atomic Site Visit Booking with Concurrency Lock & `SLOT_TAKEN` Recovery

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Prospective Buyer
    participant API as POST /api/bookings
    participant Service as Booking Service
    participant DB as PostgreSQL

    Buyer->>API: POST /api/bookings { slotId }
    Note over API: Extracts verified leadId strictly<br/>from signed session cookie
    API->>Service: bookVisit(slotId, leadId)
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: SELECT * FROM visit_slots WHERE id = slotId FOR UPDATE
    Service->>DB: SELECT * FROM bookings WHERE slot_id = slotId AND status = 'confirmed'
    alt Slot Already Booked (Row Check or Partial Index Breach 23505)
        Service->>DB: ROLLBACK
        Service->>DB: Fetch 3 Next Available Free Slots
        Service-->>API: { success: false, code: "SLOT_TAKEN", alternativeSlots: [...] }
        API-->>Buyer: "That slot was just reserved. Would any of these 3 times work instead?"
    else Slot Free
        Service->>DB: INSERT INTO bookings (slot_id, lead_id, status: 'confirmed')
        Service->>DB: INSERT INTO reminders (day_before & 2_hours_before)
        Service->>DB: COMMIT TRANSACTION
        Service-->>API: { success: true, booking, icsCalendarUrl }
        API-->>Buyer: Confirmed Booking Pass + Apple/Google Calendar Sync
    end
```

### 5.4 Executive Handoff Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Prospective Buyer
    participant Chat as Autonomous Chat Assistant
    participant Handoff as Handoff Engine
    actor Exec as Sales Executive
    participant DB as PostgreSQL

    Buyer->>Chat: "I want to talk to a human about custom payment terms."
    Chat->>Handoff: triggerHandoff(leadId, reason: "buyer_requested")
    Handoff->>DB: Generate Contextual Lead Summary (Budget, Preferred BHK, Sentiment)
    Handoff->>DB: Round-Robin Assign to Available Project Executive (e.g. Priya Patel)
    Handoff->>DB: INSERT INTO handoffs (status: 'open')
    Chat-->>Buyer: "I have connected you with Priya Patel, our senior sales executive.<br/>She has your details and will call you shortly."
    Exec->>DB: GET /api/executive/handoffs (Views Priority Card & Full Chat Context)
    Exec->>Buyer: Direct Phone Call or WhatsApp Follow-Up
    Exec->>DB: PATCH /api/executive/handoffs/[id] (status: 'resolved', notes: "Spoke with client")
```

### 5.5 Automated Reminder Dispatch with Atomic Processing Lock

```mermaid
sequenceDiagram
    autonumber
    participant Cron as GitHub Actions (15-min) / Vercel Cron
    participant Worker as GET /api/cron/reminders
    participant DB as PostgreSQL
    participant MsgService as Mocked Message Service

    Cron->>Worker: GET /api/cron/reminders (Header: Bearer CRON_SECRET)
    Worker->>DB: BEGIN TRANSACTION
    Worker->>DB: SELECT * FROM reminders<br/>WHERE status = 'pending' AND scheduled_for <= NOW()<br/>FOR UPDATE SKIP LOCKED
    Worker->>DB: Filter Out Cancelled Bookings & Opted-Out Leads
    loop Each Due Reminder
        Worker->>MsgService: dispatchReminder(lead, booking, type)
        Worker->>DB: INSERT INTO message_log (status: 'sent', recipient, template)
        Worker->>DB: UPDATE reminders SET status = 'sent', sent_at = NOW()
    end
    Worker->>DB: COMMIT TRANSACTION
    Worker-->>Cron: 200 OK { processed: N, skipped: M }
```

### 5.6 Source Dashboard & Unit Economics Metric Calculation

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Sales Head (Vikram Malhotra)
    participant UI as Admin Dashboard (/admin)
    participant API as GET /api/admin/dashboard
    participant DB as PostgreSQL

    Admin->>UI: Navigates to Source Performance Dashboard
    UI->>API: GET /api/admin/dashboard?timeRange=30d
    API->>DB: Aggregate Leads by Source (Total vs Unique canonical)
    API->>DB: Aggregate Visit Bookings & Completed Visits (status = 'completed')
    API->>DB: Calculate Median First Response Time (first_response_at - created_at)
    API->>DB: Fetch Ad Spend per Source Channel from ad_spend table
    Note over API: Computes Unit Economics:<br/>- CPV = Spend / Confirmed Visits<br/>- CAC = Spend / Completed Visits<br/>- Conversion = Completed Visits / Unique Leads
    API-->>UI: JSON { summary, channels: [{ portal, social, hoarding, website }], kpis }
    UI-->>Admin: Renders Real-time KPI Cards, Conversion Funnels & Spend Tables
```

---

## 6. The Hard Part: No Double Booking

Preventing double bookings across concurrent buyer sessions and simultaneous executive bookings represents the highest engineering risk in real estate scheduling.

### 6.1 The Three-Layer Defense Architecture
1. **Layer 1: Database Row Locking (`FOR UPDATE`):**
   When `bookingService.bookVisit` executes, it initiates an isolated database transaction and queries the target slot with row-level pessimistic locking (`SELECT ... FROM visit_slots WHERE id = slotId FOR UPDATE`). Any concurrent transaction attempting to read or write this slot must wait until the lock is released.
2. **Layer 2: Engine Partial Unique Index:**
   To protect against split-second race conditions where two transactions enter the insert phase simultaneously, PostgreSQL enforces an engine-level partial unique constraint:
   ```sql
   CREATE UNIQUE INDEX confirmed_slot_unique_idx 
   ON bookings (slot_id) 
   WHERE status = 'confirmed';
   ```
   If a duplicate booking is attempted, PostgreSQL immediately aborts the transaction with SQL error code `23505` (`unique_violation`).
3. **Layer 3: Typed `SLOT_TAKEN` Graceful Recovery:**
   Instead of crashing or bubbling up an unhandled 500 error, `bookingService.bookVisit` explicitly catches Postgres error code `23505`. It queries the 3 nearest upcoming free slots for the same project and returns a typed payload:
   ```typescript
   {
     success: false,
     code: "SLOT_TAKEN",
     message: "This appointment slot has just been reserved by another buyer.",
     alternativeSlots: [ ... ]
   }
   ```
   The UI receives this typed payload and immediately displays alternative slot buttons to the buyer.

### 6.2 Concurrency Stress Test Results
The double-booking protection was subjected to an automated parallel execution test in `tests/integration/booking.test.ts`:
* **Test Case:** 10 asynchronous concurrent booking requests fired simultaneously via `Promise.all` targeting the exact same `slotId`.
* **Execution Result:**
  * **Exactly 1 request** succeeded (`success: true`, status `confirmed`).
  * **Exactly 9 requests** failed gracefully with `SLOT_TAKEN` and received alternative slots.
  * Zero database deadlocks occurred.
  * Verified in database: Exactly 1 confirmed booking row existed for that `slotId`.

### 6.3 In-Memory PGlite vs. Real Multi-Connection Pool
In the local and CI test runner, tests execute against an in-memory PGlite instance. Because PGlite operates within a single-threaded WebAssembly environment, it serializes queries. To verify multi-connection concurrency against a true multi-threaded connection pool, a dedicated test case is included:
```bash
TEST_DATABASE_URL="postgres://<user>:<password>@<ep-hostname>.neon.tech/proplead" \
pnpm vitest run tests/integration/booking.test.ts
```
When `TEST_DATABASE_URL` is omitted, this test is safely skipped (`1 skipped` out of 251 tests), ensuring fast offline test runs while providing verifiable production pool testing.

---

## 7. How the AI Part Works

### 7.1 Autonomous Agent Architecture
The conversational assistant (`src/server/ai/agent.ts`) operates on an autonomous agent loop capped at **5 execution turns per user message**. It integrates with the database via four structured tool calling definitions:
1. `getFactSheetEntries(category, query)`: Retrieves verified RERA details for the specified project.
2. `getAvailableSlots(projectId, startDate, endDate)`: Queries unbooked visit slots adhering to the 2-hour minimum cutoff.
3. `bookSiteVisit(slotId)`: Executes atomic visit reservation.
4. `requestHumanHandoff(reason)`: Escalates the conversation to a sales executive with context.

### 7.2 Strict Session Security in Tool Execution
A critical vulnerability in agentic systems is tool argument injection (e.g. an attacker passing someone else's `leadId` to `bookSiteVisit`). In PropLead AI:
* The LLM tool schema for `bookSiteVisit` accepts only `slotId`.
* `leadId` is **never** accepted from the model or the HTTP request body.
* `leadId` is cryptographically extracted by the backend service directly from the verified `proplead_lead_session` JWT cookie.

### 7.3 Code-Level Price Guardrail Engine (`price-checker.ts`)
LLM system prompts are inherently non-deterministic and susceptible to jailbreaks. To guarantee 100% compliance with Gujarat RERA regulations, all assistant responses pass through an algorithmic code-level guardrail before being sent to the buyer.

#### Validation Rules:
1. **Per-Project Rupee Endpoints:** Any rupee figure quoted in an assistant reply must match the exact registered endpoints for that project:
   * **Project 1 (Bodakdev):** Rs 95 Lakh, Rs 1.05 Crore, Rs 1.20 Crore.
   * **Project 2 (Shela):** Rs 65 Lakh, Rs 76 Lakh, Rs 85 Lakh, Rs 88 Lakh.
   * *A Project 1 reply quoting Rs 65 Lakh is immediately flagged and blocked.*
2. **Single-Point Price Flagging:** Rejects statements presenting a single figure as a final price ("costs exactly", "final price", "priced at Rs 70 Lakh") unless framed as an approved registered range.
3. **Discount & Negotiation Block:** Blocks all discount promises, cashbacks, or under-the-table pricing across English, Hindi (`छूट`, `सौदा`, `कम`), and Gujarati (`સસ્તી`, `છૂટ`).

#### Guardrail Breach Handling:
Upon detection of a violation:
1. The assistant reply is discarded and replaced with a static RERA-compliant disclaimer.
2. The conversation record is updated: `flagged = true`, `flag_reason = 'guardrail_violation'`.
3. An urgent handoff is dispatched to the executive queue.
4. The conversation appears immediately in the Sales Head Flagged Chat Review Queue (`/admin/review`).

### 7.4 Autonomous AI Evaluation Benchmark
The AI assistant's compliance, resistance to prompt injections, and multilingual capabilities are verified by an automated 30-scenario benchmark suite (`pnpm run eval:ai`).

| Category | Scenarios | Pass Rate | Key Defenses Verified |
|:---|:---:|:---:|:---|
| **Price & Discount Compliance** | 3 | **100% (3/3)** | Rejects final price claims, blocks cash discount demands. |
| **Missing Facts & Handoffs** | 2 | **100% (2/2)** | Defers pet policy / custom queries; triggers human handoff. |
| **Multilingual Comprehension** | 4 | **100% (4/4)** | Fluent responses in Hindi, Gujarati, English, and Hinglish. |
| **Security & Adversarial Prompt Injections** | 7 | **100% (7/7)** | Blocks system prompt leaks, roleplay jailbreaks, SQL injection in tools, and buyer PII exfiltration. |
| **RERA Registration & Statutory Claims** | 3 | **100% (3/3)** | Quotes verified RERA registration; rejects speculative ROI / appreciation guarantees. |
| **DPDP Opt-Out Detection** | 3 | **100% (3/3)** | Instant processing of `STOP`, `UNSUBSCRIBE`, Hindi `रद्द`, and Gujarati `રદ`. |
| **Booking & Slot Navigation** | 8 | **100% (8/8)** | Guards against booking past slots, enforces 2-hour minimum lead times. |
| **TOTAL** | **30** | **100% (30/30)** | **Zero failures across all evaluation categories.** |

---

## 8. Compliance

### 8.1 Gujarat RERA (Real Estate Regulatory Authority)
* **Registered Detail Grounding:** All assistant knowledge is strictly derived from verified fact sheet entries. Speculative claims ("highest appreciation in Ahmedabad", "guaranteed 12% rental yield") are prohibited.
* **Price Range Mandate:** Prices are strictly communicated as registered bands (e.g. Rs 65L–76L for 2 BHK in Shela; Rs 95L–1.2Cr for 3 BHK in Bodakdev). Single-unit final pricing is reserved for physical sales gallery appointments.
* **Statutory Identification:** All public footers, chat headers, and booking cards display the official Gujarat RERA registration identifiers (`PR/GJ/AHMEDABAD/...`).

### 8.2 Digital Personal Data Protection (DPDP) Act 2023
* **Affirmative Opt-In Consent:** Buyers must check an explicit consent box before initiating chat conversations or booking visits. Unconsented inquiries are marked `consent_given = false` and permanently flagged `do-not-contact`.
* **Multilingual Opt-Out Engine:** Prospective buyers can revoke consent by sending opt-out keywords (`STOP`, `UNSUBSCRIBE`, `बंद करो`, `रोकें`, `રોકો`, `બંધ કરો`). Sentence boundary parsing ensures that phrases like "cancel my visit" cancel the appointment but do not opt the user out of all contact.
* **PII Masking:** Lead phone numbers are masked in administrative views (`+91 ******1234`) to prevent bulk data leakage.
* **Right to Erasure (Anonymization):** Sales heads can execute `POST /api/admin/leads/[id]/anonymize`. This permanently scrubs the buyer's name, phone, email, notes, and conversation messages while preserving the anonymized lead row for statutory conversion metrics.
* **Data Retention Policy:** Stated in `/privacy` with an assumed 180-day retention window for inactive uncontacted inquiries.

---

## 9. Security

*Comprehensive security findings, audit trails, and authorizations are documented in [`docs/security.md`](file:///c:/Users/aksha/Desktop/Proplead_AI/docs/security.md).*

### 9.1 Summary of Core Security Hardening
1. **Registration Privilege Escalation (CWE-269):** `registerSchema` strips `role` and `isAdmin` from request bodies. Public registration exclusively provisions `buyer` roles. Staff accounts are created strictly via authenticated `POST /api/admin/users`.
2. **Account Enumeration Defense (CWE-208):** Login utilizes constant-time dummy bcrypt hashing (`DUMMY_BCRYPT_HASH`) when an email is not found, ensuring uniform verification latency (~70ms) regardless of account existence.
3. **Distributed Rate Limiting (CWE-307):** Database-backed atomic rate limiting enforces 5 login attempts/minute per email and 20 attempts/minute per IP address, returning HTTP 429 with `Retry-After: 60`.
4. **Environment Boot Validation (CWE-1188):** Centralized `src/env.ts` validates all secrets at startup, enforcing `JWT_SECRET` &ge; 32 characters and `CRON_SECRET` &ge; 16 characters.
5. **Insecure Direct Object References (IDOR):** Complete access control enforcement across all 47 routes verified by a 64-assertion security authorization matrix test (`tests/unit/security-auth-matrix.test.ts`).
6. **Zero Secrets in Repository:** Complete git commit history and working tree scanned by `pnpm run scan:secrets` with **0 leaked credentials detected**.

---

## 10. UI and Design Decisions

### 10.1 Aesthetic & Typography
* **Design Theme:** "Quiet Luxury" real estate portal.
* **Color Palette:**
  * Primary Accent: Warm Amber & Polished Bronze (`#B45309`, `#D97706`).
  * Neutral Typography: Deep Ink Slate (`#0F172A`, `#1E293B`).
  * Canvas: Soft Warm Stone & Off-White (`#F8FAFC`, `#FFFFFF`).
* **Typography:** Classical serif display headings (`font-serif`, Playfair / Georgia) paired with modern sans-serif body typography (`font-sans`, Inter) for optimal legibility.

### 10.2 Key Interface Workflows
* **Mobile-First Buyer Chat (`/chat`):** Sticky mobile input, quick-reply intent chips ("2 BHK in Shela", "Book a site visit", "Possession timeline"), discreet "Talk to a person" handoff button, and in-chat slot booking cards.
* **Unified Executive Lead List (`/executive/leads`):** Search, channel filtering, masked contact pills, assignment badges, and duplicate indicator tags.
* **Executive Site Visits Agenda (`/executive/visits`):** Chronological daily appointment cards, 1-click outcome buttons (`Visited` / `No Show`), and calendar `.ics` download buttons.
* **Sales Head Flagged Chat Review (`/admin/review`):** Dual-pane inspector displaying the full chat transcript, detected guardrail violations, and 1-click reassignment controls.
* **Visual 7-Day Slot Editor (`/admin/slots`):** Interactive capacity grid allowing the sales head to view, add, or block slots per executive across both projects.

```
Screenshot: <ADD - Buyer Mobile Chat (/chat)>
Screenshot: <ADD - Unified Executive Lead List (/executive/leads)>
Screenshot: <ADD - Executive Handoff View (/executive/handoffs)>
Screenshot: <ADD - Sales Head Source Dashboard (/admin)>
Screenshot: <ADD - Sales Head Flagged Chat Review (/admin/review)>
Screenshot: <ADD - Sales Head 7-Day Slot Editor (/admin/slots)>
```

---

## 11. Testing

### 11.1 Test Strategy & Architecture
PropLead AI employs an inverted test pyramid prioritizing deterministic business logic, concurrency race conditions, and compliance rules:
* **Unit Tests:** Fast, isolated testing of phone E.164 normalization, DPDP anonymization, price guardrail regex trees, and timezone calculations.
* **Integration Tests:** Database transactions testing atomic booking row locks, duplicate lead linkage, executive authorization, and migration integrity.
* **Autonomous AI Evals:** Deterministic validation of 30 generative conversation scenarios against adversarial attacks and compliance boundaries.

### 11.2 Exact Test Counts & Quality Gate Metrics
* **Total Test Files:** **23 passed (23)**
* **Total Automated Tests:** **250 passed, 1 skipped (251 total)**
* **Autonomous AI Evaluation Scenarios:** **30 passed (30/30, 100%)**
* **Security Authorization Matrix Assertions:** **64 assertions**
* **Price Guardrail Edge Cases:** **45 assertions**
* **Opt-Out & Sentence Boundary Tests:** **11 assertions**
* **Timezone Determinism Assertions:** **13 assertions**
* **ESLint Status:** **0 errors, 0 warnings**
* **Next.js Production Build:** **47 routes cleanly compiled**

### 11.3 Commands to Execute Verification
```bash
# 1. Run Complete Automated Test Suite (23 files, 250 tests)
pnpm test

# 2. Verify Timezone Invariance under UTC
powershell -Command "$env:TZ='UTC'; pnpm vitest run tests/unit/timezone.test.ts"

# 3. Run Autonomous AI Assistant Evals (30 scenarios)
pnpm run eval:ai

# 4. Run Git Secrets Scanner across entire commit history
pnpm run scan:secrets

# 5. Run Linter
pnpm run lint

# 6. Run Production Next.js Build
pnpm run build
```

---

## 12. Metrics & Unit Economics

### 12.1 Mathematical Formulas & Definitions
1. **Leads Ingested:** $\text{Total Rows in } \mathtt{leads} \text{ within period } [t_1, t_2]$.
2. **Unique Leads:** $\sum \mathtt{leads} \text{ where } \mathtt{duplicate\_of\_id} \text{ IS NULL}$.
3. **Median First Response Time:** $\text{Median}(\mathtt{first\_response\_at} - \mathtt{created\_at})$.
4. **Leads Unreached in 48 Hours:**
   $$\frac{\sum \mathtt{leads} \text{ where } \mathtt{first\_response\_at} \text{ IS NULL or } (\mathtt{first\_response\_at} - \mathtt{created\_at}) > 48\text{h}}{\text{Total Unique Leads}} \times 100$$
5. **Lead-to-Visit Conversion Rate:**
   $$\frac{\sum \mathtt{bookings} \text{ where } \mathtt{status} = \text{'confirmed'}}{\text{Total Unique Leads}} \times 100$$
6. **Cost Per Visit (CPV):**
   $$\frac{\text{Total Channel Advertising Spend}}{\sum \mathtt{bookings} \text{ where } \mathtt{status} = \text{'confirmed'}}$$
7. **Customer Acquisition Cost (CAC):**
   $$\frac{\text{Total Channel Advertising Spend}}{\sum \mathtt{bookings} \text{ where } \mathtt{outcome} = \text{'visited'}}$$

### 12.2 Target Mapping & Impact Analysis
| Funnel Metric | Company A Baseline | PropLead AI Simulated Result | Status |
|:---|:---:|:---:|:---:|
| **First Response Time** | 14 hours | **< 1 minute (Instant AI)** | **Target Achieved** |
| **Unreached in 48 Hours** | 35.0% | **< 2.0%** | **Target Achieved** |
| **Lead-to-Visit Rate** | 6.0% | **8.4%** | **Target Achieved** |

> *Disclaimer: All operational numbers, ad spend figures, and visit counts in this prototype are generated from realistic seed fixtures for Company A.*

---

## 13. Assumptions Table

| # | Category | Assumption Description |
|:---|:---|:---|
| 1 | **Regulatory** | Public buyer chat (`/chat`) requires no login, relying strictly on an affirmative DPDP checkbox and short-lived HTTP-only signed session cookies. |
| 2 | **Regulatory** | Fact sheet data is strictly fictional demo data adhering to Gujarat RERA format (`PR/GJ/AHMEDABAD/...`). |
| 3 | **Regulatory** | Only price ranges per BHK are communicated by the AI assistant; no single-unit final prices, discounts, or payment promises. |
| 4 | **Operational** | Company A operates 2 projects: Project 1 (Bodakdev, Rs 95L–1.2Cr) and Project 2 (Shela, Rs 65L–88L) with 420 total units. |
| 5 | **Operational** | Prototype models 11 sales staff as 4 executives, 1 sales head/admin, and telecaller support. |
| 6 | **Operational** | Standard site visit duration is 60 minutes between 10:00 and 18:00 IST (last slot starts 17:00), Monday through Saturday. |
| 7 | **Operational** | Minimum 2-hour advance booking cutoff applies to free slot discovery to prevent gallery walk-in collisions. |
| 8 | **Architectural** | Slot availability is strictly derived via SQL `LEFT JOIN bookings ... WHERE bookings.id IS NULL`, never via mutable boolean flags. |
| 9 | **Architectural** | Double booking prevention is enforced at the database engine level via `confirmed_slot_unique_idx` partial unique index. |
| 10 | **Architectural** | All business hours, slot generation, and cron schedules operate deterministically in `Asia/Kolkata` (IST, UTC+05:30). |
| 11 | **Compliance** | Buyer phone numbers are masked in administrative views (`+91 ******1234`) and uncontacted inquiries assume a 180-day retention window. |
| 12 | **Marketing** | Monthly advertising spend is modeled at Rs 30 Lakh across Portals (Rs 14.5L), Social (Rs 9.8L), Hoardings (Rs 3.7L), and Web (Rs 2.0L). |

---

## 14. Limitations & What Was Cut

### 14.1 Honest Architectural Limitations
1. **Mocked Communication Gateways:** WhatsApp Business API, SMS (Twilio/Gupshup), and outbound telephony are decoupled behind an asynchronous interface (`MessageService`). Dispatches are logged to the database rather than hitting paid live telco aggregators.
2. **Serverless In-Memory Rate Limiter Fallback:** In high-concurrency multi-region serverless deployments, rate limiting relies on the primary PostgreSQL database (`rate_limit_buckets`). An enterprise deployment should deploy an Upstash Redis cluster for sub-millisecond edge rate limiting.
3. **Complex Regional Language Nuances:** While the assistant handles standard Hindi, Gujarati, and Hinglish queries accurately, complex regional vernacular idioms or non-standard phonetics may occasionally require escalation to an executive.
4. **Single-Tenant Architecture:** The data model is optimized for Company A's multi-project portfolio rather than multi-tenant real estate SaaS.

### 14.2 Prioritized Next Steps & Engineering Estimates
| Priority | Feature / Enhancement | Description | Estimated Effort |
|:---:|:---|:---|:---:|
| **P1** | **Live WhatsApp Cloud API** | Direct Meta WhatsApp Business API webhook integration for omni-channel messaging. | 3 engineering days |
| **P2** | **Token Deposit Gateway** | Razorpay / Cashfree integration to allow buyers to pay Rs 5,000 refundable visit earnest tokens. | 2 engineering days |
| **P3** | **Distributed Redis Cache** | Upstash Redis integration for sub-millisecond rate limiting and shared agent conversation memory. | 1 engineering day |
| **P4** | **AI Voice Telecaller (Twilio)** | Outbound voice agent (ElevenLabs / Deepgram) for immediate telecalling follow-up on portal leads. | 5 engineering days |
| **P5** | **Multi-Tenant SaaS Migration** | Organization tenancy IDs across all tables with row-level security (RLS) for multi-developer SaaS. | 4 engineering days |

---

## 15. Commit History Note

PropLead AI was engineered through an iterative, staged progression across 8 focused milestones, preserving a clean git commit history adhering to Conventional Commits:

* **Step 1 (`b06ff7f`):** Architectural foundation, Next.js 14 setup, Drizzle ORM schema, PostgreSQL migrations, and JWT authentication.
* **Step 2 (`774b9fc`):** Lead ingestion service, E.164 phone normalization, deduplication engine, and unified executive lead list screen.
* **Step 3 (`e4130fe`):** Fact sheet grounding, visit slot generation, database-level double-booking protection, and executive visit management.
* **Step 4 (`a010c2c`):** Autonomous AI chat assistant, session token security, agent tool calling loop, and evaluation benchmark framework.
* **Step 5 (`53e1a6c`):** Code-level price guardrail tightening, DPDP opt-out detection, buyer chat polish, and sales head flagged chat review queue.
* **Step 6 (`e44208a`):** Source performance dashboard, Asia/Kolkata timezone standard, 15-minute GitHub Actions cron, and 7-day admin slot editor.
* **Step 7 (`a4d80e6`):** Security hardening (privilege escalation defense, login timing attack defense, distributed rate limiting, IDOR prevention, DPDP anonymization).
* **Step 8 (Final):** Repository hygiene, secrets scanning, documentation alignment, and comprehensive Technical Design Document.

---

*PropLead AI is developed and maintained by Akshay (`akshay470`). All rights reserved.*
