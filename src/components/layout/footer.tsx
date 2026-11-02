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

          <div className="flex flex-col gap-1 text-left md:text-right text-[11px] text-ink-400">
            <span>PropLead AI • Senior Full-Stack Engineering Scaffolding</span>
            <span className="text-ink-500">PostgreSQL (Neon) • Drizzle ORM • Next.js 14</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
