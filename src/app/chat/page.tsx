"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BookingConfirmationCard } from "@/components/booking/booking-confirmation-card";

interface SlotItem {
  id: string;
  startsAt: string;
  endsAt: string;
  executive?: string;
  executiveName?: string;
}

interface ChatPayloadItem {
  type: string;
  slots?: SlotItem[];
  alternativeSlots?: SlotItem[];
  bookingId?: string;
  booking?: {
    id: string;
    slotId: string;
    startsAt: string;
    endsAt: string;
    projectName: string;
    executiveName?: string;
  };
  executiveName?: string;
  reason?: string;
  [key: string]: unknown;
}

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  language?: string;
  createdAt: string;
  payload?: ChatPayloadItem[] | null;
}

interface ProjectOption {
  id: string;
  name: string;
  locationName: string;
  reraNumber: string;
}

const UI_STRINGS = {
  en: {
    talkToPerson: "Talk to a person",
    connectingToExecutive: "Connecting you with an executive...",
    typePlaceholder: "Type your question (e.g., unit types, pricing, visit)...",
    send: "Send",
    stopMessages: "Stop messages",
    stopConfirmTitle: "Stop all automated messages?",
    stopConfirmBody: "Under DPDP Act 2023, you can opt out anytime. We will immediately cancel all visit reminders and automated messages.",
    stopConfirmAction: "Yes, stop all messages",
    cancel: "Cancel",
    sessionExpiredTitle: "Your session has concluded",
    sessionExpiredBody: "Start a fresh enquiry anytime to speak with our assistant or book a site visit.",
    startNewChat: "Start new conversation",
    bookingConfirmed: "Site visit confirmed! Your confirmation card is displayed below.",
    rateLimitWarning: "You've sent several messages quickly. Please wait a moment before sending another.",
    networkError: "Unable to reach server. Please check your connection and retry.",
    retry: "Retry",
    slotsFor: "Available Slots",
    selectTime: "Select a visit time",
    assignedToExecutive: "Sales Executive Assigned",
    suggestions: [
      "Tell me about the project",
      "What is the price range for 2 BHK?",
      "Book a site visit for tomorrow",
    ],
  },
  hi: {
    talkToPerson: "एग्जीक्यूटिव से बात करें",
    connectingToExecutive: "आपको सेल्स एग्जीक्यूटिव से जोड़ रहे हैं...",
    typePlaceholder: "अपना सवाल लिखें (उदा. कीमत, फ्लैट का प्रकार, विज़िट)...",
    send: "भेजें",
    stopMessages: "संदेश बंद करें",
    stopConfirmTitle: "क्या आप सभी संदेश बंद करना चाहते हैं?",
    stopConfirmBody: "DPDP अधिनियम 2023 के तहत आप किसी भी समय सहमति वापस ले सकते हैं। हम सभी रिमाइंडर और स्वचालित संदेश तुरंत रोक देंगे।",
    stopConfirmAction: "हाँ, संदेश बंद करें",
    cancel: "रद्द करें",
    sessionExpiredTitle: "सत्र समाप्त हो गया है",
    sessionExpiredBody: "नई बातचीत शुरू करने के लिए यहाँ क्लिक करें।",
    startNewChat: "नई बातचीत शुरू करें",
    bookingConfirmed: "साइट विज़िट की पुष्टि हो गई है! आपका विवरण नीचे दिया गया है।",
    rateLimitWarning: "आपने बहुत जल्दी संदेश भेजे हैं। कृपया कुछ क्षण प्रतीक्षा करें।",
    networkError: "सर्वर से संपर्क नहीं हो पाया। कृपया पुनः प्रयास करें।",
    retry: "पुनः प्रयास",
    slotsFor: "उपलब्ध स्लॉट",
    selectTime: "विज़िट का समय चुनें",
    assignedToExecutive: "सेल्स एग्जीक्यूटिव नियुक्त किया गया",
    suggestions: [
      "प्रोजेक्ट के बारे में बताएं",
      "2 बीएचके की कीमत क्या है?",
      "कल के लिए साइट विज़िट बुक करें",
    ],
  },
  gu: {
    talkToPerson: "પ્રતિનિધિ સાથે વાત કરો",
    connectingToExecutive: "આપને સેલ્સ એક્ઝિક્યુટિવ સાથે જોડી રહ્યા છીએ...",
    typePlaceholder: "આપનો પ્રશ્ન લખો (દા.ત. કિંમત, ફ્લેટની વિગત, વિઝિટ)...",
    send: "મોકલો",
    stopMessages: "સંદેશા બંધ કરો",
    stopConfirmTitle: "શું આપ તમામ સંદેશા બંધ કરવા માંગો છો?",
    stopConfirmBody: "DPDP એક્ટ 2023 હેઠળ આપ ગમે ત્યારે સંમતિ પાછી ખેંચી શકો છો. અમે તમામ રીમાઇન્ડર્સ અને સંદેશા તુરંત બંધ કરીશું.",
    stopConfirmAction: "હા, સંદેશા બંધ કરો",
    cancel: "રદ કરો",
    sessionExpiredTitle: "આપનું સત્ર સમાપ્ત થયું છે",
    sessionExpiredBody: "નવી પૂછપરછ શરૂ કરવા માટે અહીં ક્લિક કરો.",
    startNewChat: "નવી વાતચીત શરૂ કરો",
    bookingConfirmed: "સાઇટ વિઝિટ બુક થઈ ગઈ છે! આપનું કન્ફર્મેશન કાર્ડ નીચે આપેલું છે.",
    rateLimitWarning: "આપે ઝડપથી ઘણા સંદેશા મોકલ્યા છે. કૃપા કરીને થોડીવાર રાહ જુઓ.",
    networkError: "સર્વર સાથે જોડાણ થઈ શક્યું નથી. કૃપા કરીને ફરી પ્રયાસ કરો.",
    retry: "ફરી પ્રયાસ કરો",
    slotsFor: "ઉપલબ્ધ સ્લોટ",
    selectTime: "વિઝિટ માટે સમય પસંદ કરો",
    assignedToExecutive: "સેલ્સ એક્ઝિક્યુટિવ ફાળવવામાં આવ્યા છે",
    suggestions: [
      "પ્રોજેક્ટ વિશે જણાવો",
      "2 બીએચકે ની કિંમત જણાવો",
      "આવતીકાલ માટે સાઇટ વિઝિટ બુક કરો",
    ],
  },
};

export default function PublicChatPage() {
  // Session State
  const [hasSession, setHasSession] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [activeProjectName, setActiveProjectName] = useState("Company A Residential");
  const [detectedLang, setDetectedLang] = useState<"en" | "hi" | "gu">("en");

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
  const [rateLimited, setRateLimited] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);
  const [isOptingOut, setIsOptingOut] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = UI_STRINGS[detectedLang] || UI_STRINGS.en;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

  // Load projects & resume existing session on mount
  useEffect(() => {
    async function init() {
      setIsInitializing(true);
      try {
        // 1. Fetch available projects
        const projRes = await fetch("/api/projects");
        if (projRes.ok) {
          const pData = await projRes.json();
          if (pData.success && pData.projects) {
            setProjects(pData.projects);
            if (pData.projects.length > 0 && !selectedProjectId) {
              setSelectedProjectId(pData.projects[0].id);
            }
          }
        }

        // 2. Resume session via /api/chat/history
        const historyRes = await fetch("/api/chat/history");
        if (historyRes.ok) {
          const hData = await historyRes.json();
          if (hData.success && hData.messages?.length > 0) {
            setMessages(hData.messages);
            setHasSession(true);
            if (hData.projectName) {
              setActiveProjectName(hData.projectName);
            }
            // Infer language from latest message
            const lastWithLang = [...hData.messages]
              .reverse()
              .find((m: ChatMessageItem) => m.language === "hi" || m.language === "gu");
            if (lastWithLang?.language === "hi" || lastWithLang?.language === "gu") {
              setDetectedLang(lastWithLang.language);
            }
          }
        } else if (historyRes.status === 401) {
          // No active session cookie - show onboarding
          setHasSession(false);
        }
      } catch {
        // Network error during init
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, [selectedProjectId]);

  // Handle Consent Onboarding Submit
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

      setHasSession(true);
      setSessionExpired(false);

      const matchedProj = projects.find((p) => p.id === selectedProjectId);
      if (matchedProj) {
        setActiveProjectName(matchedProj.name);
      }

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

  // Send message
  const handleSendMessage = useCallback(
    async (messageTextToSend?: string) => {
      const text = (messageTextToSend || inputValue).trim();
      if (!text || isSending) return;

      setInputValue("");
      setIsSending(true);
      setNetworkError(null);
      setRateLimited(false);

      // Optimistic message append
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

        if (res.status === 429) {
          setRateLimited(true);
          return;
        }

        if (res.status === 401) {
          setSessionExpired(true);
          setHasSession(false);
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to deliver message");
        }

        if (data.language === "hi" || data.language === "gu" || data.language === "en") {
          setDetectedLang(data.language);
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
        setNetworkError(err instanceof Error ? err.message : t.networkError);
      } finally {
        setIsSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [inputValue, isSending, t.networkError]
  );

  // Immediate "Talk to a person" action
  const handleTalkToPerson = useCallback(async () => {
    if (isSending) return;
    await handleSendMessage("I would like to speak directly with a sales executive.");
  }, [handleSendMessage, isSending]);

  // Handle booking a slot chip
  async function handleBookSlotChip(slotId: string) {
    setBookingSlotId(slotId);
    setNetworkError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `book_${Date.now()}`,
            role: "assistant",
            content: t.bookingConfirmed,
            payload: [
              {
                type: "booking_confirmation",
                bookingId: data.booking.id,
                booking: data.booking,
                slotId,
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        // Fall back to agent inquiry
        await handleSendMessage(`Please book slot ${slotId} for my visit.`);
      }
    } catch {
      await handleSendMessage(`Please book slot ${slotId} for my visit.`);
    } finally {
      setBookingSlotId(null);
    }
  }

  // Handle explicit DPDP opt-out
  async function handleConfirmOptOut() {
    setIsOptingOut(true);
    setShowStopModal(false);
    await handleSendMessage("STOP");
    setIsOptingOut(false);
  }

  // Reset session
  function handleResetSession() {
    setHasSession(false);
    setSessionExpired(false);
    setMessages([]);
    setInputValue("");
  }

  // Group free slot chips by day
  const groupSlotsByDay = useMemo(() => {
    return (slots: SlotItem[]) => {
      const groups: Record<string, SlotItem[]> = {};
      for (const slot of slots) {
        const d = new Date(slot.startsAt);
        const dayKey = d.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        if (!groups[dayKey]) groups[dayKey] = [];
        groups[dayKey].push(slot);
      }
      return groups;
    };
  }, []);

  // ----------------------------------------------------
  // VIEW 1: Loading Skeleton
  // ----------------------------------------------------
  if (isInitializing) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#8C653D] border-t-transparent" />
          <p className="text-xs tracking-wider uppercase text-[#7A7973]">Loading PropLead Assistant...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: Session Expired State
  // ----------------------------------------------------
  if (sessionExpired) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#FAF8F5] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#EBE7DF] bg-white p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF6F0] text-[#8C653D]">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[#141413]">{t.sessionExpiredTitle}</h2>
          <p className="mt-2 text-sm text-[#7A7973]">{t.sessionExpiredBody}</p>
          <button
            onClick={handleResetSession}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#8C653D] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#704E2D] focus:outline-hidden focus:ring-2 focus:ring-[#8C653D] focus:ring-offset-2"
          >
            {t.startNewChat}
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 3: DPDP Consent & Onboarding Screen
  // ----------------------------------------------------
  if (!hasSession) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#FAF8F5] px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-xl">
          {/* Brand Header */}
          <div className="mb-8 text-center">
            <span className="inline-flex items-center rounded-full bg-[#FAF6F0] px-3 py-1 text-xs font-medium text-[#8C653D] ring-1 ring-[#E5D4BE] ring-inset">
              Company A • Residential Assistant
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#141413] sm:text-3xl">
              Find Your Home in Ahmedabad
            </h1>
            <p className="mt-2 text-sm text-[#7A7973]">
              Ask questions on 2 & 3 BHK residences, verified RERA pricing, and schedule a private site visit in real free slots.
            </p>
          </div>

          {/* Intake Card */}
          <div className="rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xs sm:p-8">
            <form onSubmit={handleStartChat} className="space-y-4">
              {consentError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                  {consentError}
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="block text-xs font-medium text-[#141413]">
                  Full Name <span className="text-[#8C653D]">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Hardik Patel"
                  className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-[#EBE7DF] px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#AFAEA7] focus:border-[#8C653D] focus:outline-hidden focus:ring-1 focus:ring-[#8C653D]"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-[#141413]">
                  Mobile Number <span className="text-[#8C653D]">*</span>
                </label>
                <div className="mt-1.5 flex rounded-xl border border-[#EBE7DF] focus-within:border-[#8C653D] focus-within:ring-1 focus-within:ring-[#8C653D]">
                  <span className="inline-flex items-center rounded-l-xl bg-[#FAF9F6] px-3 text-xs text-[#7A7973]">
                    +91
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98250 12345"
                    className="block min-h-[44px] w-full rounded-r-xl px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#AFAEA7] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-[#141413]">
                  Email Address <span className="text-xs text-[#7A7973]">(Optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hardik@example.com"
                  className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-[#EBE7DF] px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#AFAEA7] focus:border-[#8C653D] focus:outline-hidden focus:ring-1 focus:ring-[#8C653D]"
                />
              </div>

              {projects.length > 0 && (
                <div>
                  <label htmlFor="project" className="block text-xs font-medium text-[#141413]">
                    Preferred Project
                  </label>
                  <select
                    id="project"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-[#EBE7DF] bg-white px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#8C653D] focus:outline-hidden focus:ring-1 focus:ring-[#8C653D]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.locationName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* DPDP Plain-Language Notice */}
              <div className="rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex min-h-[44px] items-center">
                    <input
                      id="dpdpConsent"
                      type="checkbox"
                      required
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="h-5 w-5 rounded-md border-[#EBE7DF] text-[#8C653D] focus:ring-[#8C653D]"
                    />
                  </div>
                  <label htmlFor="dpdpConsent" className="text-xs leading-relaxed text-[#575651]">
                    <strong>DPDP Act 2023 Consent:</strong> I agree that Company A may process my details to provide verified project fact sheets, pricing ranges, and schedule requested site visits. You may opt out anytime by replying <em>STOP</em>.
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isStartingChat}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#8C653D] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#704E2D] focus:outline-hidden focus:ring-2 focus:ring-[#8C653D] focus:ring-offset-2 disabled:opacity-60"
              >
                {isStartingChat ? "Connecting..." : "Begin Conversation"}
              </button>
            </form>
          </div>

          {/* RERA Footer */}
          <div className="mt-8 text-center text-xs text-[#7A7973]">
            <p>Gujarat RERA Reg: PR/GJ/AHMEDABAD/DEMO-0001 (Project 1) &bull; PR/GJ/AHMEDABAD/DEMO-0002 (Project 2)</p>
            <p className="mt-1">All fact sheet details are strictly RERA registered. Pricing provided as indicative bands only.</p>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 4: Active Polished Buyer Chat
  // ----------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#FAF8F5] text-[#141413]">
      {/* 1. Header: Project Context & Always-Visible "Talk to a Person" */}
      <header className="flex min-h-[56px] items-center justify-between border-b border-[#EBE7DF] bg-white/90 px-4 py-2.5 backdrop-blur-xs sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF6F0] text-[#8C653D] ring-1 ring-[#E5D4BE]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#141413] sm:text-base">
              {activeProjectName}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#7A7973]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>AI Assistant &bull; Gujarat RERA Grounded</span>
            </div>
          </div>
        </div>

        {/* Quiet "Talk to a person" action — ALWAYS visible */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTalkToPerson}
            disabled={isSending}
            title={t.talkToPerson}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#D4B999] bg-[#FAF6F0] px-3 py-1.5 text-xs font-medium text-[#704E2D] transition-colors hover:bg-[#F4ECE0] focus:outline-hidden focus:ring-2 focus:ring-[#8C653D]"
          >
            <svg className="h-4 w-4 text-[#8C653D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">{t.talkToPerson}</span>
            <span className="sm:hidden">Person</span>
          </button>
        </div>
      </header>

      {/* 2. Messages Container (Smooth auto-scroll & accessible) */}
      <main
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Rate Limit Alert */}
          {rateLimited && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              {t.rateLimitWarning}
            </div>
          )}

          {/* Network Error Alert with Retry */}
          {networkError && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
              <span>{networkError}</span>
              <button
                type="button"
                onClick={() => handleSendMessage()}
                className="font-medium underline hover:text-red-700"
              >
                {t.retry}
              </button>
            </div>
          )}

          {/* Message List */}
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                    isUser
                      ? "rounded-tr-xs bg-[#2A2926] text-white"
                      : "rounded-tl-xs border border-[#EBE7DF] bg-white text-[#141413] shadow-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Render Structured UI Payloads (Slots, Confirmation, Handoff) */}
                  {!isUser && msg.payload && msg.payload.length > 0 && (
                    <div className="mt-3 space-y-3 pt-2">
                      {msg.payload.map((p, idx) => {
                        // 1. Visit Slots Tappable Chips (Grouped by Day)
                        if ((p.type === "slot_options" || p.type === "conflict_alternatives") && (p.slots || p.alternativeSlots)) {
                          const slotsToRender = p.slots || p.alternativeSlots || [];
                          const grouped = groupSlotsByDay(slotsToRender);

                          return (
                            <div key={`payload_${idx}`} className="rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-3 text-xs">
                              <p className="font-medium text-[#141413]">{t.selectTime}:</p>
                              <div className="mt-2 space-y-2">
                                {Object.entries(grouped).map(([dayLabel, daySlots]) => (
                                  <div key={dayLabel} className="space-y-1">
                                    <span className="text-[11px] font-medium text-[#7A7973]">{dayLabel}</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {daySlots.map((s) => {
                                        const timeLabel = new Date(s.startsAt).toLocaleTimeString([], {
                                          hour: "numeric",
                                          minute: "2-digit",
                                        });
                                        const isBookingThis = bookingSlotId === s.id;

                                        return (
                                          <button
                                            key={s.id}
                                            type="button"
                                            disabled={!!bookingSlotId}
                                            onClick={() => handleBookSlotChip(s.id)}
                                            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#D4B999] bg-white px-3 py-2 text-xs font-medium text-[#704E2D] transition-colors hover:bg-[#FAF6F0] focus:ring-2 focus:ring-[#8C653D] disabled:opacity-50"
                                          >
                                            <span>{timeLabel}</span>
                                            {isBookingThis ? (
                                              <span className="h-3 w-3 animate-spin rounded-full border border-[#8C653D] border-t-transparent" />
                                            ) : (
                                              <svg className="h-3 w-3 text-[#8C653D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // 2. Inline Booking Confirmation Card
                        if (p.type === "booking_confirmation" && (p.booking || p.bookingId)) {
                          const bId = (p.booking?.id || p.bookingId || "") as string;
                          return (
                            <div key={`payload_${idx}`} className="mt-2">
                              <BookingConfirmationCard
                                bookingId={bId}
                                leadName={fullName || "Prospective Buyer"}
                                projectName={activeProjectName}
                                startsAt={p.booking?.startsAt || new Date().toISOString()}
                                endsAt={p.booking?.endsAt || new Date().toISOString()}
                                executiveName={p.booking?.executiveName || "Assigned Executive"}
                              />
                            </div>
                          );
                        }

                        // 3. Executive Handoff Notice
                        if (p.type === "handoff_notice" || p.type === "handoff_created") {
                          return (
                            <div key={`payload_${idx}`} className="flex items-center gap-2 rounded-xl border border-[#E5D4BE] bg-[#FAF6F0] p-2.5 text-xs text-[#704E2D]">
                              <svg className="h-4 w-4 shrink-0 text-[#8C653D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>
                                {t.assignedToExecutive}: <strong>{String(p.executiveName || "Sales Specialist")}</strong>
                              </span>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>

                <span className="mt-1 px-1 text-[10px] text-[#AFAEA7]">
                  {formattedTime}
                </span>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-xs border border-[#EBE7DF] bg-white px-4 py-3 shadow-xs">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#8C653D]" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#8C653D]" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#8C653D]" style={{ animationDelay: "300ms" }} />
              <span className="ml-2 text-xs text-[#7A7973]">Assistant is typing...</span>
            </div>
          )}

          {/* First Message Suggestion Chips */}
          {messages.length <= 1 && !isSending && (
            <div className="pt-2">
              <p className="text-xs text-[#7A7973]">Quick suggestions:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {t.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSendMessage(suggestion)}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-3 py-2 text-xs text-[#575651] shadow-2xs transition-colors hover:border-[#D4B999] hover:bg-[#FAF6F0] hover:text-[#141413] focus:outline-hidden focus:ring-1 focus:ring-[#8C653D]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 3. Input Form Area (Pinned above mobile keyboard + Safe area) */}
      <footer className="border-t border-[#EBE7DF] bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-6">
        <div className="mx-auto max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, 1000))}
                placeholder={t.typePlaceholder}
                maxLength={1000}
                disabled={isSending}
                className="block min-h-[44px] w-full rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] pr-12 pl-4 text-sm text-[#141413] placeholder-[#AFAEA7] focus:border-[#8C653D] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#8C653D] disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#AFAEA7]">
                {inputValue.length}/1000
              </span>
            </div>

            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              aria-label={t.send}
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl bg-[#8C653D] text-white transition-colors hover:bg-[#704E2D] focus:outline-hidden focus:ring-2 focus:ring-[#8C653D] focus:ring-offset-2 disabled:opacity-40"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>

          {/* Footer Controls: Quiet Opt-Out Link & RERA registration */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#7A7973]">
            <span>Gujarat RERA: PR/GJ/AHMEDABAD/DEMO-0001 &bull; 0002</span>
            <button
              type="button"
              onClick={() => setShowStopModal(true)}
              className="hover:underline text-[#7A7973] hover:text-red-700"
            >
              {t.stopMessages}
            </button>
          </div>
        </div>
      </footer>

      {/* 4. DPDP Opt-Out Confirmation Modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#141413]">{t.stopConfirmTitle}</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#7A7973]">{t.stopConfirmBody}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={isOptingOut}
                onClick={handleConfirmOptOut}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              >
                {isOptingOut ? "Stopping..." : t.stopConfirmAction}
              </button>
              <button
                type="button"
                onClick={() => setShowStopModal(false)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2.5 text-xs font-medium text-[#575651] hover:bg-[#FAF9F6] focus:outline-hidden"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
