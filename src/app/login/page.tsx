"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to sign in");
      }

      // Redirect based on role or original requested destination
      if (from && from !== "/") {
        router.push(from);
      } else if (data.user?.role === "admin" || data.user?.isAdmin) {
        router.push("/admin");
      } else if (data.user?.role === "executive") {
        router.push("/executive");
      } else {
        router.push("/");
      }

      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-surface-300 bg-surface-50 p-8 shadow-card">
      <div className="text-center space-y-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600">
          Company A Sales Portal
        </span>
        <h1 className="font-serif text-2xl font-light text-ink-950">
          Sign In
        </h1>
        <p className="text-xs text-ink-400">
          Access your sales workspace or admin settings
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-ink-700"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="executive@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-ink-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-ink-900 py-2.5 text-xs font-semibold uppercase tracking-wider text-surface-50 shadow-subtle transition hover:bg-ink-800 disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "Continue"}
        </button>
      </form>

      <div className="mt-6 border-t border-surface-200 pt-4 text-center text-xs text-ink-400">
        <span>New staff member? </span>
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Register account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-2xl border border-surface-300 bg-surface-50 p-8 shadow-card text-center text-xs text-ink-400">
            Loading sign in...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
