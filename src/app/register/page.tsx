"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "executive" | "admin">("executive");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          isAdmin: role === "admin",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create account");
      }

      if (data.user?.role === "admin" || data.user?.isAdmin) {
        router.push("/admin");
      } else if (data.user?.role === "executive") {
        router.push("/executive");
      } else {
        router.push("/");
      }

      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-surface-300 bg-surface-50 p-8 shadow-card">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600">
            Internal Staff Onboarding
          </span>
          <h1 className="font-serif text-2xl font-light text-ink-950">
            Create Account
          </h1>
          <p className="text-xs text-ink-400">
            Register as an executive or sales head
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
              htmlFor="name"
              className="block text-xs font-medium text-ink-700"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Priya Patel"
            />
          </div>

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="priya@company.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-ink-700"
            >
              Password (min. 8 characters)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-xs font-medium text-ink-700"
            >
              Designation / Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "buyer" | "executive" | "admin")}
              className="mt-1 block w-full rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-xs text-ink-900 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="executive">Sales Executive (Lead Handoffs &amp; Calendar)</option>
              <option value="admin">Sales Head / Admin (Fact Sheet &amp; Slots)</option>
              <option value="buyer">Prospective Buyer (Enquiry &amp; Visits)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-ink-900 py-2.5 text-xs font-semibold uppercase tracking-wider text-surface-50 shadow-subtle transition hover:bg-ink-800 disabled:opacity-50"
          >
            {isLoading ? "Creating account..." : "Complete Registration"}
          </button>
        </form>

        <div className="mt-6 border-t border-surface-200 pt-4 text-center text-xs text-ink-400">
          <span>Already registered? </span>
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
