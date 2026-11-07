# Lead Priority Score — Formula and Calculation Methodology

The **Lead Priority Score** is an explainable, deterministic scoring model designed for real estate developer sales workflows. It synthesizes customer intent signals into a numerical score (0 to 100) and qualification tier (`hot`, `warm`, `cold`).

> **Important Boundary & Terminology Rule:**  
> This feature is explicitly called **"Lead Priority Score"** everywhere across code, APIs, and user interfaces. It is an explainable heuristic prioritization score, **NOT** a prediction, probability, or black-box machine learning outcome.

---

## 1. Intent Signals Only

To comply with the Digital Personal Data Protection (DPDP) Act 2023 and ethical sales practices, the formula evaluates **intent signals ONLY**. It never ingests, weights, or evaluates personal, demographic, or protected characteristics:
- ❌ **Excluded attributes:** Name, gender, age, language, phone number, email address, IP address, device type.
- ✅ **Included intent signals:** Stated budget relative to project price range, stated purchasing timeline, experiential visit booking status, specific unit configuration preference, and conversational engagement volume.

---

## 2. Parameter Maximums and Weights

The Lead Priority Score aggregates five transparent dimensions totaling **100 maximum points**:

| Parameter | Max Points | Intent Indicator | Evaluation Baseline |
|:---|:---:|:---|:---|
| **Budget Alignment** | **25** | Capacity to transact | Compared against the project's registered Gujarat RERA fact sheet price endpoints. |
| **Buying Timeline** | **25** | Urgency to purchase | Stated readiness window (`within_1_month`, `1_to_3_months`, `3_to_6_months`, `exploring`, `unknown`). |
| **Site Visit Status** | **20** | Physical commitment | Real-world experiential engagement (`visited`, `confirmed`, `rescheduled`, cancelled/no-show, not scheduled). |
| **Unit Preference** | **15** | Specificity of requirement | Clear specification of layout (`2 BHK`, `3 BHK`, `penthouse`) vs vague inquiry. |
| **Engagement Volume** | **15** | Conversational investment | Number of messages and conversational turns exchanged with the sales assistant. |
| **Total** | **100** | **Overall Intent** | Scaled 0 to 100. |

---

## 3. Mathematical Formula & Point Allocation

$$\text{Lead Priority Score} = \min\Big(100, \, \max\big(0, \, S_{\text{budget}} + S_{\text{timeline}} + S_{\text{visit}} + S_{\text{preference}} + S_{\text{engagement}}\big)\Big)$$

### A. Budget Alignment ($S_{\text{budget}}$, max 25)
Stated budget ($\text{effectiveBudget} = \max(\text{budgetMax}, \text{budgetMin})$) is compared with the project minimum price ($\text{projMin}$) and maximum price ($\text{projMax}$):
- **25 points:** $\text{effectiveBudget} \ge \text{projMin}$ (Comfortably matches or exceeds project starting threshold).
- **16 points:** $\text{effectiveBudget} \ge 0.85 \times \text{projMin}$ (Within 15% of project entry threshold).
- **8 points:** $\text{effectiveBudget} \ge 0.70 \times \text{projMin}$ (Moderately below project entry threshold).
- **4 points:** $\text{effectiveBudget} < 0.70 \times \text{projMin}$ (Substantially below project threshold).
- **Neutral (8 points):** Budget missing / not stated yet. Added to `missing: ["budget"]`.

### B. Buying Timeline ($S_{\text{timeline}}$, max 25)
- **25 points:** `within_1_month` (Immediate purchasing intent; ready to buy within 30 days).
- **20 points:** `1_to_3_months` (Near-term purchasing intent; 30 to 90 days).
- **12 points:** `3_to_6_months` (Mid-term purchasing intent; 90 to 180 days).
- **6 points:** `exploring` (Longer horizon or preliminary exploratory research).
- **Neutral (8 points):** `unknown` or unstated. Added to `missing: ["timeline"]`.

### C. Site Visit Status ($S_{\text{visit}}$, max 20)
- **20 points:** `hasVisited` (Completed in-person visit to experience gallery/sample flat).
- **16 points:** `hasConfirmedBooking` (Confirmed upcoming site appointment on calendar).
- **12 points:** `hasRescheduledBooking` (Actively rescheduled an appointment).
- **4 points:** `hasCancelledBooking` or `hasNoShow` (Previous visit cancelled or missed).
- **Neutral (4 points):** No visit booking attempted yet. Added to `missing: ["siteVisit"]`.

### D. Unit Preference ($S_{\text{preference}}$, max 15)
- **15 points:** Explicit layout stated (e.g. `2 BHK`, `3 BHK`, `4 BHK`, `Penthouse`).
- **8 points:** General residential interest indicated (e.g. `apartment`, `flat`, `home`).
- **Neutral (4 points):** Unit layout preference not specified. Added to `missing: ["preference"]`.

### E. Engagement Volume ($S_{\text{engagement}}$, max 15)
- **15 points:** High conversational interaction ($\ge 6$ messages exchanged).
- **10 points:** Active conversational interaction ($3$ to $5$ messages exchanged).
- **6 points:** Initial interaction initiated ($1$ to $2$ messages exchanged).
- **Neutral (3 points):** No chat messages recorded yet ($0$ messages). Added to `missing: ["engagement"]`.

---

## 4. Tiers and Handling Missing Data

### Tiers
- **Hot ($\ge 70$ points):** High-intent buyer with confirmed budget, near-term timeline, or active/completed site visit.
- **Warm ($40$ to $69$ points):** Moderate-intent buyer who has shared partial requirements or is in mid-term evaluation.
- **Cold ($< 40$ points):** Low-intent, exploratory, or early-stage lead.

### Insufficient Data Handling
When data is missing, the system assigns a **small neutral point value** rather than heavily penalizing the lead, and records the parameter key in `breakdown.missing`:
- If a brand-new lead enters with no inputs, baseline score is $8 + 8 + 4 + 4 + 3 = 27$ points.
- Because `missing.length >= 3`, the UI flags this lead as **"Insufficient Data"** rather than labeling them as an unqualified cold lead.
- This prevents sales executives from prematurely ignoring new prospects before an AI or staff conversation has occurred.

---

## 5. Automated Triggers & Recomputation

The score is recomputed idempotently on:
1. `save_lead_details` tool execution (budget, preference, or buying timeline captured).
2. Visit booking lifecycle events: creation, cancellation, rescheduling, or completion/no-show.
3. Every buyer message turn in the autonomous chat assistant loop.

### High-Intent Handoff Rule
When a lead's score **crosses into Hot ($\ge 70$) for the first time**, an executive handoff is triggered with reason `high_intent`. This reuses the system's idempotent 2-hour handoff deduplication rule to ensure relationship executives receive actionable, immediate notifications without spam.
