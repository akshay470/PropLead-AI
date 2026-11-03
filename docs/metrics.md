# PropLead AI Metric Definitions & Calculation Methodology

This document specifies the exact mathematical definitions, database aggregation methods, and operational baselines for all performance metrics displayed on `/admin/dashboard` and `/executive/dashboard`.

---

## 1. Developer Client Baselines (Company A, Ahmedabad)

| Metric | Pre-PropLead AI Baseline (Reported) | PropLead AI Target |
| :--- | :--- | :--- |
| **Median First Response Time** | **14 hours** (~840 minutes) | **< 2 minutes** (24/7 instant AI reply) |
| **Leads Unreached in 48h** | **35%** of all inquiries | **< 5%** |
| **Lead-to-Visit Conversion Rate** | **6.0%** | **8.0%** (+33% increase) |
| **Site Visit Show-Up Rate** | ~50% – 60% | **> 75%** (automated 24h & 2h reminders) |

*Reference baseline figures are labeled on the dashboard as "Before: 14 h / 35%" and marked as client-reported data.*

---

## 2. Metrics & Calculation Formulas

### A. Lead Volume & Deduplication
- **Unique Leads:**
  $$\text{Unique Leads} = \text{COUNT}(\text{leads where } \text{duplicate\_of\_id IS NULL} \text{ AND } \text{created\_at} \in [\text{start}, \text{end}])$$
  Each prospective buyer is counted exactly once to avoid inflating lead generation totals.
- **Duplicate Enquiries:**
  $$\text{Duplicate Enquiries} = \text{COUNT}(\text{leads where } \text{duplicate\_of\_id IS NOT NULL} \text{ AND } \text{created\_at} \in [\text{start}, \text{end}])$$
  Duplicates are attributed to their own acquisition `source` so marketing multi-touch attribution is preserved.

### B. Speed-to-Lead & Response SLA
- **Response Latency per Lead:**
  $$\text{Latency} = \text{first\_response\_at} - \text{created\_at} \quad (\text{seconds})$$
  Calculated only for leads that have received an assistant or executive reply (`first_response_at IS NOT NULL`).
- **Median First Response Time:**
  Calculated server-side in PostgreSQL using:
  `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at)))`
- **% Answered Within 2 Minutes:**
  $$\frac{\text{Leads answered with } \text{Latency} \le 120\text{s}}{\text{Total Unique Leads with response}} \times 100$$
- **% Answered Within 5 Minutes:**
  $$\frac{\text{Leads answered with } \text{Latency} \le 300\text{s}}{\text{Total Unique Leads with response}} \times 100$$
- **% Never Reached in 48 Hours:**
  $$\frac{\text{Unique leads where } (\text{first\_response\_at IS NULL AND created\_at} < \text{NOW} - 48\text{h}) \text{ OR } \text{Latency} > 48\text{h}}{\text{Total Unique Leads older than 48h}} \times 100$$

### C. Site Visit Funnel & Show-Up Rate
- **Visits Booked:**
  Total bookings created within the selected time window.
- **Visits Completed (`visited`):**
  Count of bookings marked as `visited` where the visit occurred within the time window.
- **No-Shows (`no_show`):**
  Count of bookings marked as `no_show` within the time window.
- **Show-Up Rate:**
  $$\text{Show-Up Rate} = \frac{\text{Visited}}{\text{Visited} + \text{No-Show}} \times 100$$
  *Edge Case Handling:* If $\text{Visited} + \text{No-Show} = 0$, the dashboard displays `N/A` (never division by zero).
- **Lead-to-Visit Rate:**
  $$\text{Lead-to-Visit Rate} = \frac{\text{Completed Visits}}{\text{Unique Leads}} \times 100$$
  Compared against developer baseline (6.0%) and project target (8.0%).

### D. Marketing Economics (By Source)
Ad spend is recorded monthly in `ad_spend` across the 4 acquisition channels:
1. `property_portal` (99acres, MagicBricks, Housing.com)
2. `social_media_ad` (Meta Facebook & Instagram Lead Ads)
3. `website` (Organic and Google Search Ads landing on website)
4. `hoarding_call` (Direct phone calls from physical hoardings in Ahmedabad)

- **Prorated Ad Spend:**
  Spend is prorated based on the fraction of the month falling into the chosen filter period (7, 30, or 90 days).
- **Cost Per Lead (CPL):**
  $$\text{CPL} = \frac{\text{Prorated Spend}}{\text{Unique Leads from Source}}$$
  *Zero Case:* Displays `"No leads yet"` if unique leads is 0.
- **Cost Per Completed Visit (CPV):**
  $$\text{CPV} = \frac{\text{Prorated Spend}}{\text{Completed Visits from Source}}$$
  *Zero Case:* Displays `"No visits yet"` if completed visits is 0 (never `Infinity` or `NaN`).

### E. AI Handoffs & Quality Audit
- **Handoffs by Reason:**
  Breakdown of AI escalations (`price_guardrail`, `unanswered_fact`, `buyer_requested`, `error`).
- **Flagged Conversations:**
  Count of conversations where `flagged = true`, awaiting or completed review by the Sales Head.

---

## 3. Database Indexes & Performance
Aggregations run directly on PostgreSQL using indexed columns:
- `leads(created_at)` via `leads_created_idx`
- `leads(source)` via `leads_source_idx`
- `bookings(status)` via `bookings_status_idx`
- `visit_slots(starts_at)` via `slots_starts_at_idx`
- `reminders(status, scheduled_at)` via `reminders_status_time_idx`
All numbers are computed on the database server; raw row arrays are never transferred over the network for client-side reduction.
