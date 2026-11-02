"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BookingConfirmationCard } from "@/components/booking/booking-confirmation-card";

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  language?: string;
  createdAt: string;
  payload?: Array<{
    type: string;
    slots?: Array<{ id: string; startsAt: string; endsAt: string; executive?: string }>;
    alternativeSlots?: Array<{ id: string; startsAt: string; executive?: string }>;
    bookingId?: string;
    leadName?: string;
    leadCode?: string;
    executiveName?: string;
    [key: string]: unknown;
  }> | null;
}

interface ProjectOption {
  id: string;
  name: string;
  locationName: string;
  reraNumber: string;
}

export default function PublicChatPage() {
  // Session State
  const [hasSession, setHasSession] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");

  // Consent Form Inputs
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // Messages State
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // 1. Check existing session on mount & load projects
  useEffect(() => {
    async function init() {
      // Fetch available projects for dropdown
      try {
        const projRes = await fetch("/api/projects");
        if (projRes.ok) {
          const pData = await projRes.json();
          if (pData.success && pData.projects) {
            setProjects(pData.projects);
          }
        }
      } catch {
        // pass
      }

      // Check existing chat history from session cookie
      try {
        const historyRes = await fetch("/api/chat/history");
        if (historyRes.ok) {
          const hData = await historyRes.json();
          if (hData.success && hData.messages?.length > 0) {
            setMessages(hData.messages);
            setConversationId(hData.conversationId);
            setHasSession(true);
          }
        }
      } catch {
        // pass
      }
    }

    init();
  }, []);

  // Handle Consent & Start Chat
  async function handleStartChat(e: React.FormEvent) {
    e.preventDefault();
    setConsentError(null);

    if (!consentGiven) {
      setConsentError("Affirmative consent under the DPDP Act 2023 is required to begin.");
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      setConsentError("Please provide your full name and valid mobile number.");
      return;
    }

    setIsStartingChat(true);

    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          projectId: selectedProjectId || undefined,
          consent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize chat session");
      }

      setConversationId(data.conversationId);
      setLeadName(data.name);
      setHasSession(true);

      // Add initial welcome message
      if (data.welcomeMessage) {
        setMessages([
          {
            id: `msg_${Date.now()}`,
            role: "assistant",
            content: data.welcomeMessage,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : "Error starting chat");
    } finally {
      setIsStartingChat(false);
    }
  }

  // Handle Send Message
  const handleSendMessage = useCallback(
    async (messageTextToSend?: string) => {
      const text = (messageTextToSend || inputValue).trim();
      if (!text || isSending) return;

      setInputValue("");
      setIsSending(true);

      // Optimistic user message append
      const optimisticUserMsg: ChatMessageItem = {
        id: `user_${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const res = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to deliver message");
        }

        const assistantMsg: ChatMessageItem = {
          id: `asst_${Date.now()}`,
          role: "assistant",
          content: data.reply,
          language: data.language,
          payload: data.payloads,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content:
              err instanceof Error
                ? err.message
                : "Unable to process your request. A team member will assist you shortly.",
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [inputValue, isSending]
  );

  // Quick Slot Chip Click Handler
  async function handleBookSlotChip(slotId: string) {
    setBookingSlotId(slotId);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Append confirmation message with payload
        setMessages((prev) => [
          ...prev,
          {
            id: `book_${Date.now()}`,
            role: "assistant",
            content: "Site visit confirmed! Your confirmation card and calendar details are below:",
            payload: [
              {
                type: "booking_confirmation",
                bookingId: data.booking.id,
                leadName: leadName || "Prospective Buyer",
                slotId,
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        // Hand off to assistant message handler
        handleSendMessage(`I selected slot ID ${slotId}. Please confirm if available.`);
      }
    } catch {
      handleSendMessage(`Please book slot ${slotId} for my visit.`);
    } finally {
      setBookingSlotId(null);
    }
  }

  // ==========================================
  // VIEW 1: DPDP CONSENT ONBOARDING SCREEN
  // ==========================================
  if (!hasSession) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-surface-300 bg-white shadow-subtle">
          {/* Card Header */}
          <div className="border-b border-surface-200 bg-surface-50/70 p-6 sm:p-8">
            <span className="inline-block rounded bg-primary-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-800">
              Company A • Ahmedabad
            </span>
            <h1 className="mt-2 font-serif text-2xl font-light text-ink-950 sm:text-3xl">
              Virtual Sales Assistant
            </h1>
            <p className="mt-1 text-xs text-ink-500 leading-relaxed">
              24/7 instant enquiries for The Grand Orchard (Bodakdev) &amp; Serene Meadows (Shela).
              Verified pricing bands, project amenities, and real-time site visit bookings.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleStartChat} className="p-6 sm:p-8 space-y-4">
            {consentError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {consentError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hardik Patel"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3.5 py-2.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <span className="flex items-center rounded-xl border border-surface-300 bg-surface-100 px-3 text-xs font-medium text-ink-600">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  placeholder="98250 12345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 rounded-xl border border-surface-300 bg-surface-50 px-3.5 py-2.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Email Address <span className="text-ink-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="hardik@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3.5 py-2.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Interested Project <span className="text-ink-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3.5 py-2.5 text-xs text-ink-900 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">All Projects (Bodakdev &amp; Shela)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.locationName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* DPDP Act 2023 Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/40 p-3.5 cursor-pointer transition hover:bg-primary-50/70">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-[11px] leading-relaxed text-ink-700">
                  I give affirmative consent under the <strong>DPDP Act 2023</strong> to receive property information, verified RERA fact sheet details, and appointment reminders from Company A. You can reply <strong>STOP</strong> at any time to opt out.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!consentGiven || isStartingChat}
              className="mt-4 w-full rounded-xl bg-primary-600 py-3 text-xs font-semibold text-white shadow transition hover:bg-primary-700 disabled:opacity-50"
            >
              {isStartingChat ? "Connecting to Assistant..." : "Start Enquiries"}
            </button>
          </form>

          {/* Statutory Compliance Footer */}
          <div className="border-t border-surface-200 bg-surface-50/50 p-4 text-center text-[10px] text-ink-400">
            Gujarat RERA: PR/GJ/AHMEDABAD/DEMO-0001 (Project 1) &amp; PR/GJ/AHMEDABAD/DEMO-0002 (Project 2). Details at gujrera.gujarat.gov.in.
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE BUYER CHAT CONVERSATION
  // ==========================================
  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col bg-surface-50 sm:px-4 sm:py-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-none sm:rounded-2xl sm:border sm:border-surface-300 sm:bg-white sm:shadow-sm">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-surface-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-800 font-serif font-bold text-sm">
              A
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-900">
                Company A Assistant
              </div>
              <div className="text-[10px] text-emerald-700 font-medium">
                Online • Multilingual (EN, HI, GU)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm("End current chat session?")) {
                setHasSession(false);
                setMessages([]);
              }
            }}
            className="rounded-lg border border-surface-300 bg-surface-50 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-surface-100"
          >
            New Session
          </button>
        </div>

        {/* Message Transcript */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          {messages.map((m) => {
            const isUser = m.role === "user";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed sm:max-w-[75%] ${
                    isUser
                      ? "bg-ink-900 text-white rounded-br-none shadow-sm"
                      : "bg-surface-100 text-ink-900 rounded-bl-none border border-surface-200 shadow-subtle"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Render UI Payloads (Slots, Confirmation Cards, Handoffs) */}
                  {m.payload && m.payload.length > 0 && (
                    <div className="mt-3 space-y-3 pt-2 border-t border-surface-200/50">
                      {m.payload.map((p, idx) => {
                        // 1. Tappable Slot Chips
                        if (p.type === "slot_options" && p.slots && p.slots.length > 0) {
                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-primary-800">
                                Available 60-Minute Visit Slots
                              </div>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                {p.slots.map((s) => {
                                  const d = new Date(s.startsAt);
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      disabled={bookingSlotId === s.id}
                                      onClick={() => handleBookSlotChip(s.id)}
                                      className="flex items-center justify-between rounded-xl border border-primary-200 bg-white p-2.5 text-left text-xs transition hover:border-primary-500 hover:bg-primary-50/50"
                                    >
                                      <div>
                                        <div className="font-semibold text-ink-900">
                                          {d.toLocaleDateString("en-IN", {
                                            weekday: "short",
                                            day: "numeric",
                                            month: "short",
                                          })}
                                        </div>
                                        <div className="text-[11px] text-primary-700">
                                          {d.toLocaleTimeString("en-IN", {
                                            hour: "numeric",
                                            minute: "2-digit",
                                            hour12: true,
                                          })}
                                        </div>
                                      </div>
                                      <span className="rounded bg-primary-100 px-2 py-1 text-[10px] font-semibold text-primary-800">
                                        Book
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // 2. Booking Confirmation Card
                        if (p.type === "booking_confirmation" && p.bookingId) {
                          return (
                            <div key={idx} className="mt-2">
                              <BookingConfirmationCard
                                bookingId={p.bookingId}
                                leadName={p.leadName || leadName || "Buyer"}
                                projectName="The Grand Orchard"
                                startsAt={new Date(Date.now() + 24 * 3600 * 1000)}
                                endsAt={new Date(Date.now() + 25 * 3600 * 1000)}
                                projectRera="PR/GJ/AHMEDABAD/DEMO-0001"
                                projectAddress="SG Highway, Bodakdev, Ahmedabad"
                              />
                            </div>
                          );
                        }

                        // 3. Handoff Card
                        if (p.type === "handoff_notice") {
                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-primary-200 bg-primary-50/60 p-3 text-xs"
                            >
                              <div className="font-semibold text-primary-900">
                                Relationship Specialist Assigned
                              </div>
                              <div className="mt-0.5 text-ink-700">
                                <strong>{p.executiveName || "Sales Specialist"}</strong> has received your inquiry and will follow up shortly.
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>

                <span className="mt-1 px-1 text-[10px] text-ink-400">
                  {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex items-center gap-1.5 rounded-2xl bg-surface-100 px-4 py-3 text-xs text-ink-500 w-24">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary-500" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:0.4s]" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex gap-2 overflow-x-auto border-t border-surface-200 bg-surface-50 px-4 py-2 scrollbar-thin">
          {[
            "What are the price ranges for 2 & 3 BHK?",
            "What amenities are in Project 1?",
            "Book a site visit for tomorrow",
            "I want to speak with an executive",
          ].map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap rounded-lg border border-surface-300 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-700 shadow-2xs hover:bg-surface-100"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 border-t border-surface-200 bg-white p-3 sm:p-4"
        >
          <input
            type="text"
            value={inputValue}
            maxLength={1000}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message in English, Hindi, or Gujarati..."
            disabled={isSending}
            className="flex-1 rounded-xl border border-surface-300 bg-surface-50 px-3.5 py-2.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />

          <span className="text-[10px] text-ink-400 font-mono hidden sm:inline">
            {inputValue.length}/1000
          </span>

          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow transition hover:bg-primary-700 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>

        {/* RERA Footer */}
        <div className="border-t border-surface-200 bg-surface-50 py-1.5 text-center text-[10px] text-ink-400">
          Gujarat RERA Registered: PR/GJ/AHMEDABAD/DEMO-0001 &amp; DEMO-0002. Automated messages comply with DPDP Act 2023. Reply STOP to opt out.
        </div>
      </div>
    </div>
  );
}
