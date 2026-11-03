# PropLead AI — Comprehensive Security & Compliance Audit

This document details the security posture, vulnerability findings, remediations, authorization matrices, and compliance implementations (DPDP Act 2023, Gujarat RERA) for PropLead AI.

---

## 1. Security Findings & Remediations

### Finding 1: Registration Privilege Escalation (CWE-269)
* **Status:** Remediated & Verified with Tests (`tests/unit/auth-schemas.test.ts`)
* **Vulnerability:** The public registration endpoint (`POST /api/auth/register`) accepted `role` and `isAdmin` directly in the request body schema with default fallbacks. A malicious actor could supply `{"role": "admin", "isAdmin": true}` to self-provision administrative privileges.
* **Remediation:** 
  1. Stripped `role` and `isAdmin` completely from `registerSchema`.
  2. Hardcoded `role: "buyer"` and `isAdmin: false` in `authService.register`.
  3. Created a dedicated administrative route `POST /api/admin/users` protected by `requireAdmin` for provisioning executive and admin accounts.

### Finding 2: Account Enumeration via Login Timing Attack (CWE-208)
* **Status:** Remediated & Verified
* **Vulnerability:** When a login request supplied a non-existent email, the service returned immediately (~1ms), whereas existing accounts underwent bcrypt password verification (~70ms). An attacker could measure latency to enumerate registered executive and buyer emails.
* **Remediation:** Implemented constant-time dummy password hashing (`DUMMY_BCRYPT_HASH`). When a user is not found, bcrypt comparison is executed against a precomputed dummy hash, ensuring uniform verification latency regardless of account existence.

### Finding 3: Brute-Force Attacks on Authentication Endpoints (CWE-307)
* **Status:** Remediated & Verified
* **Vulnerability:** Repeated automated credential stuffing or dictionary attacks could be launched against `/api/auth/login`.
* **Remediation:** Added a database-backed distributed rate limiter (`checkLoginRateLimit`) enforcing:
  - Max **5 attempts per minute per email**.
  - Max **20 attempts per minute per IP address**.
  - Returns HTTP `429 Too Many Requests` with a standard `Retry-After: 60` response header upon breach.

### Finding 4: Insecure Environment Configuration & Secret Leaks (CWE-1188 / CWE-209)
* **Status:** Remediated & Verified
* **Vulnerability:** Environment variables were accessed ad-hoc across modules without startup validation, risking undefined behavior or accidental logging of full secrets in error traces.
* **Remediation:** 
  1. Created a centralized, Zod-validated `src/env.ts` module that runs once at application bootstrap.
  2. Enforces strict length requirements: `JWT_SECRET` &ge; 32 characters, `CRON_SECRET` &ge; 16 characters.
  3. Fails fast with clear console warnings naming only the missing keys (never logging sensitive credentials).

### Finding 5: Insecure Direct Object References (IDOR) (CWE-639)
* **Status:** Remediated & Verified (`tests/unit/security-auth-matrix.test.ts`, `tests/unit/admin-access-control.test.ts`)
* **Vulnerability:** Potential for executives to view or modify leads, appointments, or transcripts assigned to other executives.
* **Remediation:**
  - **Leads:** Executives only view unassigned leads or leads explicitly assigned to their `userId` (`GET /api/leads/[id]`).
  - **Handoffs:** Executives can only view and update handoffs assigned to them (`GET /api/executive/handoffs`, `PATCH /api/executive/handoffs/[id]`).
  - **Visits & Bookings:** Executives can only update visit outcomes or reschedule/cancel appointments assigned to them.
  - **Buyer Sessions:** Buyers cannot modify or query another buyer's bookings; booking IDs are validated against the signed `leadSession.leadId`.

### Finding 6: Digital Personal Data Protection (DPDP) Act 2023 Compliance
* **Status:** Implemented & Verified (`tests/unit/dpdp-anonymize.test.ts`)
* **Measures:**
  - **Affirmative Opt-In Consent:** Buyers must affirmatively check consent before beginning chat sessions or scheduling appointments. Unconsented leads are flagged `consent_given = false` and marked `do-not-contact`.
  - **Opt-Out Mechanism:** Replying `STOP`, `UNSUBSCRIBE`, `રદ`, or `रद्द` halts all automated notifications and triggers an opt-out confirmation.
  - **Phone Masking:** Buyer phone numbers are masked in administrative audit trails (`+91 ******1234`) using `maskRecipient` and `maskPhone`.
  - **Right to Erasure / Anonymization:** Admin route `POST /api/admin/leads/[id]/anonymize` permanently scrubs buyer name, phone, email, notes, and conversation transcripts while preserving row counts and aggregate visit figures for RERA compliance.
  - **Public Privacy Notice:** Live at `/privacy` detailing data fiduciary details, retention period (180 days assumption), and DPO contacts.

### Finding 7: HTTP Security Headers & Restrictive Policies
* **Status:** Implemented via `next.config.mjs`
* **Configuration:**
  - `X-Content-Type-Options: nosniff` (MIME sniffing disabled).
  - `X-Frame-Options: DENY` & CSP `frame-ancestors 'none'` (Clickjacking prevention).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `Content-Security-Policy`: Restricts scripts and styles to self, disables foreign object embedding.
  - `poweredByHeader: false` (Suppresses `X-Powered-By: Next.js`).

---

## 2. API Route Authorization & Permission Matrix

| Endpoint | HTTP Method | Allowed Roles | Description | IDOR / Object-Level Guard |
|:---|:---:|:---|:---|:---|
| `/api/auth/register` | `POST` | Public (Anonymous) | Self-registration for buyers | Hardcoded `role: "buyer"`, strips staff fields |
| `/api/auth/login` | `POST` | Public (Anonymous) | Session issuance | Rate limited (5/min/email, 20/min/IP), dummy bcrypt |
| `/api/auth/logout` | `POST` | Authenticated | Cookie invalidation | Clears session cookie |
| `/api/auth/me` | `GET` | Authenticated | Session identity check | Returns decoded token claims |
| `/api/health` | `GET` | Public | Service health & DB ping | Non-sensitive status ping only |
| `/api/chat/start` | `POST` | Public | Starts buyer chat & session | Enforces DPDP consent checkbox |
| `/api/chat/message` | `POST` | Buyer Session | Sends buyer chat message | Scoped to active `leadId` session cookie |
| `/api/chat/history` | `GET` | Buyer Session | Reads buyer chat transcript | Scoped to active `conversationId` session cookie |
| `/api/chat/slots` | `GET` | Public / Buyer | Free slot discovery | Enforces 2-hour minimum booking cutoff |
| `/api/bookings` | `POST` | Buyer / Executive / Admin | Confirms a site visit | Caller lead ID taken strictly from session |
| `/api/bookings/[id]/cancel` | `POST` | Buyer / Executive / Admin | Cancels a site visit | Buyer: must own booking. Executive: must be assigned |
| `/api/bookings/[id]/reschedule` | `POST` | Buyer / Executive / Admin | Reschedules a site visit | Buyer: must own booking. Executive: must be assigned |
| `/api/bookings/[id]/outcome` | `PATCH` | Executive / Admin | Marks `visited` or `no_show` | Enforces appointment start time and assignment |
| `/api/leads` | `GET`, `POST` | Executive / Admin | Lists or creates leads | Filterable; masked phones for unauthorized viewers |
| `/api/leads/[id]` | `GET`, `PATCH`| Executive / Admin | Lead details & timeline | Executive can only view assigned or unassigned leads |
| `/api/leads/[id]/assign` | `PATCH` | Executive / Admin | Reassigns lead to executive | Validates executive existence |
| `/api/leads/[id]/duplicate/confirm` | `POST` | Executive / Admin | Confirms duplicate lead link | Canonical lead must exist |
| `/api/leads/[id]/duplicate/unlink` | `POST` | Executive / Admin | Breaks false duplicate link | Resets duplicate pointer |
| `/api/executive/dashboard` | `GET` | Executive / Admin | Executive KPIs & tasks | Scoped to `user.userId` |
| `/api/executive/visits` | `GET` | Executive / Admin | Executive site visit list | Scoped to `user.userId` |
| `/api/executive/handoffs` | `GET` | Executive / Admin | Active handoff requests | Scoped to `user.userId` |
| `/api/executive/handoffs/[id]` | `PATCH` | Executive / Admin | Resolves handoff request | Executive must be assigned to handoff |
| `/api/admin/dashboard` | `GET` | Admin (Sales Head) | Portfolio source dashboard | Enforces `user.role === 'admin'` |
| `/api/admin/facts` | `GET`, `POST` | Admin (Sales Head) | Fact sheet management | Enforces `user.role === 'admin'` |
| `/api/admin/facts/[id]` | `PATCH`, `DELETE` | Admin (Sales Head) | Fact editing / deletion | Enforces `user.role === 'admin'` |
| `/api/admin/review` | `GET` | Admin (Sales Head) | Flagged chat review queue | Enforces `user.role === 'admin'` |
| `/api/admin/review/[id]` | `PATCH` | Admin (Sales Head) | Review resolution | Enforces `user.role === 'admin'` |
| `/api/admin/review/[id]/reassign` | `POST` | Admin (Sales Head) | Reassigns flagged lead | Enforces `user.role === 'admin'` |
| `/api/admin/slots` | `GET` | Admin (Sales Head) | 7-day slot management grid | Enforces `user.role === 'admin'` |
| `/api/admin/slots/block` | `POST` | Admin (Sales Head) | Blocks / unblocks slots | Enforces `user.role === 'admin'` |
| `/api/admin/slots/generate` | `POST` | Admin (Sales Head) | Generates future slot grid | Enforces `user.role === 'admin'` |
| `/api/admin/coverage` | `GET`, `POST` | Admin (Sales Head) | Executive project coverage | Enforces `user.role === 'admin'` |
| `/api/admin/messages` | `GET` | Admin (Sales Head) | Outbound messaging audit log | Enforces `user.role === 'admin'`, recipient masked |
| `/api/admin/users` | `POST` | Admin (Sales Head) | Provisions staff accounts | Enforces `user.role === 'admin'` |
| `/api/admin/leads/[id]/anonymize` | `POST` | Admin (Sales Head) | DPDP lead anonymization | Enforces `user.role === 'admin'` |
| `/api/cron/reminders` | `GET` | Cron Service | Dispatches due reminders | Validates `Bearer ${CRON_SECRET}` |

---

## 3. Dependency Security Audit (`pnpm audit`)

| Advisory ID | Package | Severity | Category | Remediation / Mitigation |
|:---|:---:|:---:|:---|:---|
| `GHSA-4v52-7q2x-v498` | `next` (&lt; 14.2.10) | Moderate | Server Actions header validation | Upgraded to current stable Next.js 14 release; server actions are not utilized for sensitive data mutations. |
| `GHSA-95x3-9p92-p7g6` | `vitest` | Low | Development test runner sandbox | Dev-dependency only; excluded from production deployment and build containers. |

*Run command:* `pnpm audit` produces zero critical or unmitigated production runtime vulnerabilities. Real credentials and database URLs have been confirmed absent from all git-tracked commits.
