"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface MaskedMessageItem {
  id: string;
  channel: "whatsapp" | "sms" | "email";
  maskedTo: string;
  template: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "failed";
  createdAtUtc: string;
  createdAtIst: string;
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<MaskedMessageItem[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected message for detail inspection modal
  const [inspectingMessage, setInspectingMessage] = useState<MaskedMessageItem | null>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (channelFilter) params.set("channel", channelFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/messages?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load outbound message logs");
      }
      setMessages(json.messages || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading message audit log");
    } finally {
      setIsLoading(false);
    }
  }, [channelFilter, statusFilter]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1C1917] pb-24 font-sans">
      {/* Top Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/review"
              className="text-stone-500 hover:text-stone-900 transition-colors text-xs uppercase tracking-wider font-medium"
            >
              &larr; Admin Portal
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-stone-900 font-semibold text-sm">Message Audit Log</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/slots"
              className="text-xs font-medium bg-white text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Slot Scheduling
            </Link>
            <Link
              href="/admin/dashboard"
              className="text-xs font-medium bg-white text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Analytics Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Title & Privacy Subhead */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Outbound Notification Logs
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Read-only statutory log of WhatsApp and SMS reminders dispatched to prospective buyers.
              Recipient phone numbers are masked for DPDP Act 2023 compliance.
            </p>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => loadMessages()}
            className="text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 self-start sm:self-auto"
          >
            Refresh Logs
          </button>
        </div>

        {/* Filter Strip */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center gap-3">
          <div>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
            >
              <option value="">All Delivery Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
            >
              <option value="">All Delivery Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <span className="text-xs text-stone-400 ml-auto">
            Showing {messages.length} log entries (latest first)
          </span>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs sm:text-sm">
            {errorMsg}
          </div>
        )}

        {/* Table View */}
        {isLoading ? (
          <div className="p-16 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-stone-300 border-t-[#1F4E3D] rounded-full mb-2" />
            <p className="text-xs font-medium">Fetching outbound message audit trail...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-stone-200 text-stone-400">
            <p className="text-sm font-medium">No messages found matching criteria.</p>
            <p className="text-xs mt-1">
              Reminders trigger 24 hours and 2 hours before site visits, or upon booking confirmation.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Recipient (Masked)</th>
                    <th className="py-3 px-4 font-semibold">Channel</th>
                    <th className="py-3 px-4 font-semibold">Template Version</th>
                    <th className="py-3 px-4 font-semibold">Delivery Status</th>
                    <th className="py-3 px-4 font-semibold">Dispatched Time (IST)</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {messages.map((msg) => (
                    <tr
                      key={msg.id}
                      onClick={() => setInspectingMessage(msg)}
                      className="hover:bg-stone-50/70 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-stone-900">
                        {msg.maskedTo}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            msg.channel === "whatsapp"
                              ? "bg-emerald-100 text-emerald-800"
                              : msg.channel === "sms"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {msg.channel}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600 truncate max-w-xs">
                        {msg.template}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            msg.status === "sent" || msg.status === "delivered"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : msg.status === "queued"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          }`}
                        >
                          {msg.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500 whitespace-nowrap">
                        {msg.createdAtIst}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingMessage(msg);
                          }}
                          className="text-stone-600 hover:text-stone-900 underline text-xs font-medium"
                        >
                          View Body
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Message Body Inspection Modal */}
      {inspectingMessage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">
                  Notification Message Body
                </h3>
                <p className="text-[11px] font-mono text-stone-500 mt-0.5">
                  Template: {inspectingMessage.template} &bull; Channel: {inspectingMessage.channel}
                </p>
              </div>
              <button
                onClick={() => setInspectingMessage(null)}
                className="text-stone-400 hover:text-stone-700 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-xs text-stone-500">
                <span>
                  Recipient: <strong className="font-mono text-stone-800">{inspectingMessage.maskedTo}</strong>
                </span>
                <span>
                  Dispatched: <strong className="font-mono text-stone-800">{inspectingMessage.createdAtIst}</strong>
                </span>
              </div>

              {/* Rendered Text Body */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 font-sans text-xs text-stone-800 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {inspectingMessage.body}
              </div>

              {/* Statutory compliance verification chips */}
              <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100 flex flex-wrap items-center gap-2 text-[10px] text-emerald-800">
                <span>&bull; Gujarat RERA Registered</span>
                <span>&bull; Asia/Kolkata Timestamp</span>
                <span>&bull; Google Maps GPS Pin</span>
                <span>&bull; DPDP Opt-Out Line Attached</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inspectingMessage.body)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Copy Content
              </button>
              <button
                type="button"
                onClick={() => setInspectingMessage(null)}
                className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
