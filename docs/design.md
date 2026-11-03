# PropLead AI — Design System & Visual Guidelines

**Company A &bull; PropLead AI Design System**

PropLead AI adopts a **quiet luxury** aesthetic appropriate for high-value residential real estate in Ahmedabad. It eschews generic startup neons and frantic animations in favor of editorial warmth, architectural permanence, high legibility across three writing scripts (Latin, Devanagari, Gujarati), and tactile feedback.

---

## 1. Design Principles

1. **Quiet Luxury & Restraint:** Restrained bronze accents, warm paper-white surfaces, and deep charcoal inks convey developer prestige without visual noise.
2. **Editorial Typography:** High-contrast serif headlines for project branding paired with clean, accessible sans-serif for numbers, timestamps, and data tables.
3. **Multilingual First-Class Citizen:** Equal optical weighting and line-heights for English, Hindi (Devanagari), and Gujarati across all screens and notifications.
4. **Contextual Actionability:** Every screen provides a single primary intent with obvious secondary actions. Destructive actions require explicit confirmation.

---

## 2. Color Tokens

| Token Family | Variable / Utility | Hex Value | Semantic Purpose |
|:---|:---|:---:|:---|
| **Ink** | `ink-900` | `#121210` | Primary headers, high-contrast text |
| | `ink-700` | `#2A2926` | Secondary body text, subheads |
| | `ink-500` | `#575651` | Supporting metadata, timestamps, captions |
| | `ink-300` | `#AFAEA7` | Borders, subtle dividers |
| | `ink-100` | `#E7E7E5` | Muted backgrounds, container borders |
| **Surface** | `surface-50` | `#FFFFFF` | Cards, popovers, modals |
| | `surface-100` | `#FAF9F6` | Page background (warm alabaster) |
| | `surface-200` | `#F4F2EC` | Table headers, secondary card surfaces |
| | `surface-300` | `#EBE7DF` | Panel dividers, input borders |
| **Brand (Bronze)** | `brand-600` / `accent` | `#8C653D` | Primary interactive buttons, key badges |
| | `brand-500` | `#A77E52` | Hover states, active tabs |
| | `brand-100` | `#F4ECE0` | Badge tints, selected row highlights |
| | `brand-50` | `#FAF6F0` | Subtle callout backgrounds |
| **Status / Feedback** | Emerald `emerald-600` | `#059669` | Confirmed bookings, attended visits |
| | Amber `amber-600` | `#D97706` | Pending handoffs, flag reviews |
| | Rose `rose-600` | `#E11D48` | Cancelled visits, blocked slots, no-shows |

---

## 3. Typography & Writing Systems

* **Headlines (`font-serif`):** Cormorant Garamond / Georgia / serif — used for project titles, hero banners, and section headings.
* **UI & Body (`font-sans`):** System UI / Noto Sans / Inter with native fallbacks for Devanagari (`Noto Sans Devanagari`) and Gujarati (`Noto Sans Gujarati`).
* **Scale:**
  - Display: `text-4xl` (36px) / `font-serif` / `tracking-tight`
  - H1 / Screen Titles: `text-2xl` (24px) / `font-serif` / `font-semibold`
  - H2 / Section Titles: `text-lg` (18px) / `font-serif` / `font-medium`
  - Body: `text-sm` (14px) / `leading-relaxed`
  - Metadata & Badges: `text-xs` (12px) / `font-medium` / `uppercase tracking-wider`
  - Microcopy: `text-[11px]` (11px) / `text-ink-400`

---

## 4. Spacing, Borders & Elevation

* **Grid:** Standard 4px baseline (`p-1` = 4px, `p-2` = 8px, `p-4` = 16px, `p-6` = 24px).
* **Radii:**
  - Buttons & Inputs: `rounded-md` (6px) or `rounded` (4px).
  - Cards & Panels: `rounded-lg` (8px).
  - Modals & Sheets: `rounded-xl` (12px).
  - Badges & Pills: `rounded-full`.
* **Elevation / Shadows:**
  - `shadow-subtle`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
  - `shadow-card`: `0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.02)`
  - `shadow-dropdown`: `0 10px 15px -3px rgba(0, 0, 0, 0.08)`

---

## 5. UI Component Library (`src/components/ui/`)

PropLead AI provides atomic components designed for strict design consistency across buyer, executive, and admin interfaces:

1. **`Button` (`src/components/ui/button.tsx`):**
   - Variants: `primary` (warm bronze), `secondary` (ink outlined), `ghost` (subtle hover), `danger` (rose).
   - Sizes: `sm`, `md`, `lg`.
   - Supports `isLoading` with integrated spinner.
2. **`Badge` (`src/components/ui/badge.tsx`):**
   - Variants: `neutral`, `success` (green), `warning` (amber), `danger` (rose), `brand` (bronze).
   - Sizes: `sm` (micro), `md` (standard).
3. **`Card` (`src/components/ui/card.tsx`):**
   - High-performance semantic container (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
4. **`Modal` (`src/components/ui/modal.tsx`):**
   - Accessible overlay dialog with backdrop blur, keyboard dismissal (Esc), and outside click trap.
5. **`EmptyState` (`src/components/ui/empty-state.tsx`):**
   - Standardized state for empty lists, queues, or filter misses with actionable CTA.
6. **`ErrorState` (`src/components/ui/error-state.tsx`):**
   - Graceful inline or full-panel error presentation with retry callback.
7. **`Skeleton` (`src/components/ui/skeleton.tsx`):**
   - Shimmer pulse animations matching card, table row, and text line shapes for zero layout shift.
