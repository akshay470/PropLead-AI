export function Footer() {
  return (
    <footer className="border-t border-surface-300 bg-surface-50 py-8 text-xs text-ink-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1.5 max-w-xl">
            <div className="font-medium text-ink-700">
              Company A Developments • Ahmedabad, Gujarat
            </div>
            <p className="text-[11px] leading-relaxed text-ink-500">
              Statutory RERA Disclaimer: Project 1 RERA Reg No:{" "}
              <span className="font-mono text-ink-700">PR/GJ/AHMEDABAD/AUDA/RAA00000/010125/TEST</span> | Project 2 RERA Reg No:{" "}
              <span className="font-mono text-ink-700">PR/GJ/AHMEDABAD/AUDA/RAA00001/010125/TEST</span>.
              Details available on gujrera.gujarat.gov.in. No artistic impressions or promotional copy constitute a binding legal agreement.
            </p>
            <p className="text-[11px] leading-relaxed text-ink-500">
              DPDP Act 2023: We process personal data solely with prior affirmative consent. You may opt out of notifications at any point by sending &ldquo;STOP&rdquo;.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-left md:text-right text-[11px] text-ink-400">
            <div className="flex items-center gap-4 md:justify-end">
              <a href="/privacy" className="text-ink-600 hover:text-brand-600 underline transition-colors">
                Privacy Notice (DPDP)
              </a>
              <span className="text-ink-300">&bull;</span>
              <a href="/login" className="text-ink-600 hover:text-brand-600 underline transition-colors">
                Staff Sign In
              </a>
              <span className="text-ink-300">&bull;</span>
              <a href="/chat" className="text-ink-600 hover:text-brand-600 underline transition-colors">
                AI Assistant
              </a>
            </div>
            <span>PropLead AI &bull; Senior Full-Stack Engineering Platform</span>
            <span className="text-ink-500">PostgreSQL (Neon) &bull; Drizzle ORM &bull; Next.js 14 &bull; Asia/Kolkata</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
