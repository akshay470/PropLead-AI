import Link from "next/link";
import { getCurrentUser } from "@/server/auth/cookies";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-surface-300 bg-surface-50/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-surface-50 shadow-subtle transition-transform group-hover:scale-105">
              <span className="font-serif text-base font-semibold tracking-tight text-accent-subtle">
                P
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-ink-900">
                PropLead AI
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-400">
                Company A • Ahmedabad
              </span>
            </div>
          </Link>
        </div>

        {/* Global navigation */}
        <nav className="hidden items-center gap-6 text-xs font-medium text-ink-500 md:flex">
          <Link
            href="/chat"
            className="transition-colors hover:text-ink-900"
          >
            Buyer Assistant
          </Link>
          <Link
            href="/executive/leads"
            className="transition-colors hover:text-ink-900"
          >
            Leads
          </Link>
          <Link
            href="/executive/visits"
            className="transition-colors hover:text-ink-900"
          >
            Visits
          </Link>
          <Link
            href="/book-preview"
            className="transition-colors hover:text-ink-900"
          >
            Book Preview
          </Link>
          <Link
            href="/admin"
            className="transition-colors hover:text-ink-900"
          >
            Sales Head Admin
          </Link>
        </nav>

        {/* User state */}
        <div className="flex items-center gap-3 text-xs">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="font-medium text-ink-900">{user.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-brand-600 font-semibold">
                  {user.role}
                </span>
              </div>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="rounded border border-surface-300 bg-surface-50 px-2.5 py-1 text-xs font-medium text-ink-600 transition hover:bg-surface-200 hover:text-ink-900"
                >
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded border border-surface-300 bg-surface-50 px-3 py-1.5 font-medium text-ink-700 transition hover:bg-surface-200 hover:text-ink-900"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded bg-ink-900 px-3 py-1.5 font-medium text-surface-50 shadow-subtle transition hover:bg-ink-800"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
