import Link from "next/link";
import { getCurrentUser } from "@/server/auth/cookies";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-2xl border border-surface-300 bg-surface-50 p-8 shadow-card md:p-14">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            Company A • Ahmedabad Portfolio (420 Apartments)
          </div>

          <h1 className="font-serif text-3xl font-light tracking-tight text-ink-950 sm:text-5xl">
            Instant Buyer Engagement. <br />
            <span className="italic text-brand-600">Zero Double Bookings.</span>
          </h1>

          <p className="text-sm leading-relaxed text-ink-600 sm:text-base">
            PropLead AI transforms residential sales operations for Company A. By engaging enquiries within 2 minutes across English, Hindi, and Gujarati, the platform qualifies buyer budgets, adheres strictly to verified RERA fact sheets, and schedules site visits against real slots with PostgreSQL-enforced concurrency control.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-md bg-ink-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-surface-50 shadow-subtle transition hover:bg-ink-800"
            >
              Launch Buyer Chat Demo
            </Link>
            {user ? (
              <Link
                href={user.isAdmin || user.role === "admin" ? "/admin" : "/executive"}
                className="inline-flex items-center justify-center rounded-md border border-surface-300 bg-surface-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-700 transition hover:bg-surface-200"
              >
                Go to {user.role === "admin" ? "Admin" : "Executive"} Portal
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-surface-300 bg-surface-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-700 transition hover:bg-surface-200"
              >
                Executive / Admin Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Target Operational Metrics */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Operational Benchmarks & Targets
          </h2>
          <span className="text-[11px] text-ink-400">
            Baseline vs PropLead AI Target
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-subtle">
            <span className="text-xs text-ink-500">Median First Response</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink-900">&lt; 2 min</span>
              <span className="text-xs line-through text-ink-400">was 14 hours</span>
            </div>
            <p className="mt-2 text-xs leading-normal text-ink-500">
              Instant multilingual AI qualification active 24/7 across portal & hoarding inquiries.
            </p>
          </div>

          <div className="rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-subtle">
            <span className="text-xs text-ink-500">Unreached in 48h</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink-900">&lt; 5%</span>
              <span className="text-xs line-through text-ink-400">was 35%</span>
            </div>
            <p className="mt-2 text-xs leading-normal text-ink-500">
              Immediate omnichannel greeting with affirmative DPDP Act consent check.
            </p>
          </div>

          <div className="rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-subtle">
            <span className="text-xs text-ink-500">Lead-to-Visit Conversion</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-ink-900">8.0%</span>
              <span className="text-xs line-through text-ink-400">was 6.0%</span>
            </div>
            <p className="mt-2 text-xs leading-normal text-ink-500">
              Guaranteed real free slot booking with automated 24h & 2h reminders.
            </p>
          </div>
        </div>
      </section>

      {/* Role Workspaces */}
      <section className="mt-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-400">
          Core Workspaces (Scaffolded Architecture)
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-subtle">
            <div className="space-y-3">
              <div className="inline-flex rounded-md bg-brand-50 p-2 text-brand-700">
                <span className="text-xs font-mono font-bold">01</span>
              </div>
              <h3 className="font-medium text-ink-900">Buyer Mobile Assistant</h3>
              <p className="text-xs leading-relaxed text-ink-500">
                Multilingual AI conversationalist (English, Hindi, Gujarati). Answers only verified fact-sheet entries, captures 2BHK/3BHK preferences, and reserves visit slots.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-surface-200">
              <Link
                href="/chat"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                Open Interface &rarr;
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-subtle">
            <div className="space-y-3">
              <div className="inline-flex rounded-md bg-brand-50 p-2 text-brand-700">
                <span className="text-xs font-mono font-bold">02</span>
              </div>
              <h3 className="font-medium text-ink-900">Executive Queue & Handoffs</h3>
              <p className="text-xs leading-relaxed text-ink-500">
                Unified sales pipeline for 11 executives. Displays buyer needs, conversation summaries, lead origin tags, and calendar appointment schedule.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-surface-200">
              <Link
                href="/executive"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                Access Pipeline &rarr;
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-surface-300 bg-surface-50 p-6 shadow-subtle">
            <div className="space-y-3">
              <div className="inline-flex rounded-md bg-brand-50 p-2 text-brand-700">
                <span className="text-xs font-mono font-bold">03</span>
              </div>
              <h3 className="font-medium text-ink-900">Sales Head Administration</h3>
              <p className="text-xs leading-relaxed text-ink-500">
                Manage project fact sheets, define slot inventory, audit flagged chat conversations, and track conversion economics and ad spend by source.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-surface-200">
              <Link
                href="/admin"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                Admin Console &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Engineering & Database Integrity Safeguard */}
      <section className="mt-12 rounded-xl border border-surface-300 bg-surface-200/50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-700">
              Concurrency &amp; Integrity Guarantee
            </span>
            <h4 className="text-sm font-medium text-ink-900">
              PostgreSQL Partial Unique Index Active
            </h4>
            <p className="text-xs text-ink-500">
              Slot concurrency is enforced by <code className="font-mono text-xs text-brand-800 bg-surface-50 px-1.5 py-0.5 rounded border border-surface-300">confirmed_slot_unique_idx ON bookings(slot_id) WHERE status = &apos;confirmed&apos;</code>.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md bg-surface-50 px-3 py-1.5 text-xs text-ink-600 border border-surface-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Database Level Protection
          </div>
        </div>
      </section>
    </div>
  );
}
