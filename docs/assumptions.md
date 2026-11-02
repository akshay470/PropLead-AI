# Project Assumptions & Design Decisions

This document records the operational, architectural, and regulatory assumptions made during the development of PropLead AI.

## 1. Regulatory & Compliance Assumptions
- **Public Buyer Experience & DPDP Consent:**
  - The buyer chat experience (`/chat` and `/api/chat/**`) is **strictly public** and requires no user registration, login, or session cookies.
  - Before starting a chat, prospective buyers must explicitly toggle an affirmative DPDP Act 2023 consent checkbox. Once checked, the conversation begins and lead details are collected and stored/matched.
  - An opt-out mechanism immediately flags `opted_out = true` on the lead record, halting any automated messaging, follow-ups, or reminders.
- **RERA Registration Numbers:**
  - Standard Gujarat RERA format (`PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA...`) is referenced using clearly marked placeholder test numbers (e.g. `PR/GJ/AHMEDABAD/AUDA/RAA00000/010125/TEST`).
  - All promotional copy and chat footers include the project RERA registration identifier and a mandatory statutory disclaimer that promotional details do not supersede registered approvals.
- **DPDP Act 2023 (Digital Personal Data Protection):**
  - Explicit affirmative consent is recorded via a mandatory checkbox before initiating buyer conversations or processing personal data.
  - An opt-out mechanism immediately flags `opted_out = true` on the lead record, halting any automated messaging, follow-ups, or reminders.

## 2. Real Estate Operations & Inventory
- **Client Developer Profile:**
  - Company A operates 2 residential projects in Ahmedabad:
    - *Project 1:* Premium high-rise apartments in SG Highway / Bodakdev area.
    - *Project 2:* Modern lifestyle community in Shela / South Bopal area.
  - Unit configurations: 2 BHK and 3 BHK.
  - Price band: Rs 65 Lakh to Rs 1.2 Crore.
- **Site Visit Slots:**
  - Standard slot duration is assumed to be **60 minutes** per executive visit appointment.
  - Slots are scheduled during operating sales gallery hours (e.g. 10:00 AM to 7:00 PM).
  - Slots are assigned to an executive or pooled project inventory.

## 3. Database Integrity & Concurrency Control
- **Strict Double-Booking Prevention:**
  - Enforced at the PostgreSQL engine level via a **Partial Unique Index** on `bookings(slot_id) WHERE status = 'confirmed'`.
  - Application code uses transactional queries with database constraint enforcement to ensure two simultaneous buyer requests for the same slot cannot both succeed under any race condition.

## 4. Communication & Messaging
- **Mocked Messaging Layer:**
  - WhatsApp, SMS, and Email messaging are decoupled behind an asynchronous interface (`MessageService`).
  - Outgoing dispatches are mocked and recorded in the `message_log` table with channel, recipient, template name, body, and status (`queued`, `sent`, `delivered`, `failed`).
- **Reminders Schedule:**
  - Automated reminder intervals are configured for:
    - 24 hours (1 day) prior to the visit appointment.
    - 2 hours prior to the scheduled slot time.

## 5. Security & Access Control
- **Session Tokens & Cookie Policy:**
  - User authentication relies on secure, `HttpOnly`, `SameSite=Lax` cookies containing encrypted JWT tokens (via `jose`).
  - Role hierarchy:
    - `admin`: Full administrative access (fact sheets, slot inventory, review queue, metrics, executive tools).
    - `executive`: Lead management, assigned visit schedules, handoff summaries.
    - `buyer`: Lead qualification, interactive assistant, visit booking management.
