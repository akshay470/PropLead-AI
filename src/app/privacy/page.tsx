import Link from "next/link";

export const metadata = {
  title: "Privacy Notice | PropLead AI - Company A",
  description:
    "DPDP Act 2023 compliance notice, data collection practices, retention periods, and buyer data rights.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-stone-200 hover:text-white transition-colors"
          >
            <div className="h-7 w-7 rounded bg-amber-600/20 border border-amber-500/40 flex items-center justify-center font-serif text-amber-400 font-bold text-sm">
              P
            </div>
            <span className="font-serif font-semibold tracking-wide text-sm sm:text-base">
              Company A &bull; PropLead AI
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded text-xs sm:text-sm bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
            >
              Start Chat
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded text-xs sm:text-sm border border-stone-700 hover:border-stone-500 text-stone-300 hover:text-white transition-colors"
            >
              Staff Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        <div>
          <div className="inline-block px-2.5 py-0.5 rounded text-xs font-medium uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            Compliance & Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100 tracking-tight">
            Privacy Notice & Data Protection Policy
          </h1>
          <p className="mt-2 text-stone-400 text-sm sm:text-base leading-relaxed">
            In compliance with the Digital Personal Data Protection Act (DPDP), 2023 and Gujarat RERA
            standards for transparent real estate transactions.
          </p>
        </div>

        {/* Section: Who We Are */}
        <section className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-serif font-semibold text-amber-300">1. Data Fiduciary & Identity</h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            This platform is operated on behalf of <strong>Company A</strong>, a residential real estate
            developer based in Ahmedabad, Gujarat, developing premier residential projects including
            The Grand Orchard (Bodakdev, RERA: PR/GJ/AHMEDABAD/AA00123/2024) and Serene Meadows (Shela,
            RERA: PR/GJ/AHMEDABAD/AA00456/2024).
          </p>
        </section>

        {/* Section: Data Collected */}
        <section className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-serif font-semibold text-amber-300">2. Personal Data We Collect</h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            When you interact with our digital channels, portals, or conversational sales assistant, we collect:
          </p>
          <ul className="list-disc list-inside text-sm text-stone-300 space-y-1.5 ml-1">
            <li><strong>Identification:</strong> Your full name and mobile phone number (E.164 normalized format).</li>
            <li><strong>Contact (Optional):</strong> Your email address for site visit confirmation and calendar invites.</li>
            <li><strong>Housing Preferences:</strong> Configuration interests (e.g. 2 BHK, 3 BHK), budget range, and preferred visit timings.</li>
            <li><strong>Interaction History:</strong> Conversational transcripts, inquiries submitted, visit appointments booked, and executive handoff notes.</li>
          </ul>
        </section>

        {/* Section: Legal Basis & Purpose */}
        <section className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-serif font-semibold text-amber-300">3. Purpose and Legal Basis (Consent)</h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            Under the DPDP Act 2023, processing of personal data is governed strictly by affirmative consent:
          </p>
          <ul className="list-disc list-inside text-sm text-stone-300 space-y-1.5 ml-1">
            <li>We request explicit, affirmative opt-in consent before you initiate a conversation or book a site visit.</li>
            <li>If consent is declined or withheld, your enquiry is flagged as <em>Do-Not-Contact</em> and our automated messaging services will not dispatch proactive messages.</li>
            <li>We use your information solely to provide answers from authorized RERA fact sheets, schedule site visits, and coordinate with assigned sales executives.</li>
          </ul>
        </section>

        {/* Section: Data Retention */}
        <section className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-serif font-semibold text-amber-300">4. Data Retention Period (Assumption)</h2>
          <div className="p-3.5 bg-amber-950/30 border border-amber-800/50 rounded text-xs text-amber-300/90 leading-relaxed">
            <strong>Retention Assumption:</strong> Personal lead data and conversational transcripts are retained
            for <strong>180 days</strong> from the date of initial enquiry or visit completion, after which records
            are archived or anonymized unless an active booking or purchase agreement is in progress.
          </div>
          <p className="text-sm text-stone-300 leading-relaxed">
            Aggregate performance indicators (lead counts, conversion percentages, visit volumes) are retained
            without PII for business analytics and audit reporting.
          </p>
        </section>

        {/* Section: Buyer Rights & Opt-Out */}
        <section className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-serif font-semibold text-amber-300">5. Your DPDP Rights & Opt-Out Mechanisms</h2>
          <div className="space-y-3 text-sm text-stone-300 leading-relaxed">
            <p>
              Under DPDP 2023, you hold the right to access, rectify, and withdraw consent for data processing at any time:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-stone-800 bg-stone-950/40 p-4 rounded">
                <div className="font-semibold text-stone-200 mb-1">Instant Opt-Out (STOP)</div>
                <p className="text-xs text-stone-400">
                  Reply with <span className="text-amber-400 font-mono">STOP</span>, <span className="text-amber-400 font-mono">UNSUBSCRIBE</span>, <span className="text-amber-400 font-mono">रद्द</span>, or <span className="text-amber-400 font-mono">રદ</span> in any chat or message to halt all automated reminders and messages immediately.
                </p>
              </div>
              <div className="border border-stone-800 bg-stone-950/40 p-4 rounded">
                <div className="font-semibold text-stone-200 mb-1">Right to Erasure & Anonymization</div>
                <p className="text-xs text-stone-400">
                  Admins can permanently scrub your name, phone number, email, and conversation transcripts via our DPDP erasure protocol while preserving non-identifiable statistics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Security & Contact */}
        <section className="bg-stone-900/50 border border-stone-800 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-serif font-semibold text-amber-300">6. Data Security & Grievance Redressal</h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            All data in transit is encrypted with TLS 1.3, phone numbers are masked in administrative logs,
            and role-based access control restricts buyer information strictly to assigned sales executives and system administrators.
          </p>
          <div className="pt-2 text-xs text-stone-400">
            For privacy grievances, contact our Data Protection Officer at:{" "}
            <span className="text-stone-200 font-mono">privacy@company-a.example.com</span> &bull; Ahmedabad, Gujarat, India.
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <div>&copy; 2026 Company A. All rights reserved. RERA Gujarat Registered.</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-stone-400 transition-colors">Home</Link>
            <Link href="/chat" className="hover:text-stone-400 transition-colors">AI Assistant</Link>
            <Link href="/login" className="hover:text-stone-400 transition-colors">Executive Login</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
