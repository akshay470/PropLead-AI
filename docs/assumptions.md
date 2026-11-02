# Project Assumptions & Design Decisions

This document records the operational, architectural, and regulatory assumptions made during the development of PropLead AI.

## 1. Regulatory & Compliance Assumptions
- **Public Buyer Experience & DPDP Consent:**
  - The buyer chat experience (`/chat` and `/api/chat/**`) is **strictly public** and requires no user registration, login, or session cookies.
  - Before starting a chat, prospective buyers must explicitly toggle an affirmative DPDP Act 2023 consent checkbox. Once checked, the conversation begins and lead details are collected and stored/matched.
  - An opt-out mechanism immediately flags `opted_out = true` on the lead record, halting any automated messaging, follow-ups, or reminders.
- **RERA Registration Numbers:**
  - Standard Gujarat RERA format (`PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA...`) is referenced using clearly marked placeholder test numbers (e.g. `PR/GJ/AHMEDABAD/DEMO-0001` and `PR/GJ/AHMEDABAD/DEMO-0002`).
  - All promotional copy and chat footers include the project RERA registration identifier and a mandatory statutory disclaimer that promotional details do not supersede registered approvals.

## 2. Real Estate Operations & Inventory
- **Client Developer Profile:**
  - Company A operates 2 residential projects in Ahmedabad:
    - *Project 1 (The Grand Orchard):* SG Highway, Bodakdev (23.0338° N, 72.5072° E).
    - *Project 2 (Serene Meadows):* South Bopal / Shela (23.0125° N, 72.4589° E).
  - Unit configurations: 2 BHK and 3 BHK.
  - Price band: Rs 65 Lakh to Rs 1.2 Crore.
- **Site Visit Slots:**
  - Standard slot duration is assumed to be **60 minutes** per executive visit appointment.
  - Slots are scheduled during operating sales gallery hours (e.g. 10:00 AM to 7:00 PM).
- **Advertising Spend:**
  - Monthly advertising budget is modeled at ~Rs 30 Lakh per month across 4 channels:
    - Property Portals: Rs 14.5 Lakh
    - Social Media Ads: Rs 9.8 Lakh
    - Hoarding Call Numbers: Rs 3.7 Lakh
    - Website & Organic: Rs 2.0 Lakh

## 3. Database Integrity & Concurrency Control
- **Strict Double-Booking Prevention:**
  - Enforced at the PostgreSQL engine level via a **Partial Unique Index** on `bookings(slot_id) WHERE status = 'confirmed'`.
  - Application code uses transactional queries with database constraint enforcement to ensure two simultaneous buyer requests for the same slot cannot both succeed under any race condition.
- **Deduplication Engine:**
  - Deduplication matches incoming leads on primary key (normalized E.164 phone number) and secondary key (case-insensitive email).
  - The oldest matching lead record remains canonical.
  - Subsequent duplicates preserve their original acquisition channel `source` to retain marketing attribution while linking via `duplicate_of_id`.

## 4. Communication & Messaging
- **Mocked Messaging Layer:**
  - WhatsApp, SMS, and Email messaging are decoupled behind an asynchronous interface (`MessageService`).
  - Outgoing dispatches are mocked and recorded in the `message_log` table with channel, recipient, template name, body, and status (`queued`, `sent`, `delivered`, `failed`).
- **Reminders Schedule:**
  - Automated reminder intervals are configured for:
    - 24 hours (1 day) prior to the visit appointment.
    - 2 hours prior to the scheduled slot time.

## 5. Security & Demo Credentials
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
