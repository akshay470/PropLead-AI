import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-300 bg-surface-50 p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <span className="font-serif text-xl font-bold">!</span>
        </div>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-ink-900">
          Access Restricted
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">
          You do not have the required permissions to access this portal. Please contact your sales administrator or sign in with an authorized account.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded border border-surface-300 bg-surface-50 px-4 py-2 text-xs font-medium text-ink-700 transition hover:bg-surface-200"
          >
            Return Home
          </Link>
          <Link
            href="/login"
            className="rounded bg-ink-900 px-4 py-2 text-xs font-medium text-surface-50 shadow-subtle transition hover:bg-ink-800"
          >
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  );
}
