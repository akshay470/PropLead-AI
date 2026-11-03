export interface GuardrailCheckResult {
  passed: boolean;
  reason?: string;
  violatingSnippet?: string;
  fallbackMessage: string;
}

// Statutory Developer Price Bounds (in Lakhs INR)
// Project 1 & 2 overall portfolio: Rs 65 Lakh to Rs 1.20 Crore (120 Lakhs)
export const MIN_ALLOWED_PRICE_LAKHS = 65;
export const MAX_ALLOWED_PRICE_LAKHS = 120;

// Registered Fact Sheet Price Range Endpoints (in Lakhs INR)
// Project 1: 2 BHK: 75L–88L; 3 BHK: 98L–120L (1.20 Cr)
// Project 2: 2 BHK: 65L–76L; 3 BHK: 85L–105L (1.05 Cr)
// Intersection of Project 1 and Project 2 endpoints is empty ([])
export const FACT_SHEET_PRICE_ENDPOINTS: Record<string, number[]> = {
  project1: [75, 88, 98, 120],
  project2: [65, 76, 85, 105],
  both: [], // Strict intersection: no overlapping endpoints between Project 1 and Project 2
};

export const SAFE_PRICE_FALLBACK = {
  en: "Our sales team will confirm pricing details and unit availability with you directly. Would you like to schedule a site visit or have an executive call you?",
  hi: "हमारी सेल्स टीम आपसे सीधे संपर्क कर कीमत और यूनिट की विस्तृत जानकारी साझा करेगी। क्या आप साइट विजिट बुक करना चाहेंगे या किसी सेल्स एग्जीक्यूटिव से बात करना चाहेंगे?",
  gu: "અમારી સેલ્સ ટીમ સીધો સંપર્ક કરીને કિંમત અને ઉપલબ્ધતા અંગેની સત્તાવાર માહિતી આપશે. શું આપ સાઇટ વિઝિટ બુક કરવા માંગો છો કે સેલ્સ એક્ઝિક્યુટિવ સાથે વાત કરવા માંગો છો?",
};

// Forbidden negotiation, discount, exact-price, and ungrounded promise terms
const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  // Discounts & Bargaining (English)
  {
    regex: /\b(discount|discounts|discounted|special offer|limited offer|festive offer|best deal|best price|cheapest price|cut price|cashback|rebate|concession|negotiable|negotiate|negotiation|room for negotiation|final price|flat price|exact price|fixed price|all-inclusive price)\b/i,
    reason: "discount_or_exact_price_promise",
  },
  // Discounts & Bargaining (Hindi)
  {
    regex: /(छूट|डिस्काउंट|ऑफ़र|ऑफर|रियायत|मोलभाव|सौदा|विशेष छूट|सस्ती कीमत|सस्ता|कम कीमत|अंतिम कीमत|अंतिम भाव|पक्की कीमत|फिक्स रेट|निश्चित कीमत|पक्का भाव)/i,
    reason: "discount_or_exact_price_promise_hi",
  },
  // Discounts & Bargaining (Gujarati)
  {
    regex: /(છૂટ|ડિસ્કાઉન્ટ|ઓફર|વાટાઘાટો|ઓછી કિંમત|સસ્તું|ખાસ છૂટ|અંતિમ ભાવ|અંતિમ કિંમત|પાકી કિંમત|ફિક્સ ભાવ)/i,
    reason: "discount_or_exact_price_promise_gu",
  },
  // Guarantees & Returns on investment (English)
  {
    regex: /\b(guaranteed|guarantee|assured return|assured returns|guaranteed returns|rental guarantee|promised return|risk[- ]free|100% profit|high roi|capital appreciation guaranteed)\b/i,
    reason: "unauthorized_guarantee_or_returns",
  },
  // Guarantees & Returns on investment (Hindi)
  {
    regex: /(गारंटी|गारंटीड|सुनिश्चित रिटर्न|पक्का मुनाफा|मुनाफे की गारंटी|निश्चित रिटर्न|पक्का लाभ)/i,
    reason: "unauthorized_guarantee_or_returns_hi",
  },
  // Guarantees & Returns on investment (Gujarati)
  {
    regex: /(ખાતરી|ખાતરીપૂર્વક|નિશ્ચિત વળતર|ખાતરીબંધ વળતર|નફાની ખાતરી)/i,
    reason: "unauthorized_guarantee_or_returns_gu",
  },
  // Payment plans & Subvention schemes (English)
  {
    regex: /\b(no emi till possession|subvention scheme|pay 10% now|zero downpayment|0% interest scheme)\b/i,
    reason: "unapproved_payment_scheme",
  },
  // Payment plans & Subvention schemes (Hindi / Gujarati)
  {
    regex: /(कब्जे तक कोई ईएमआई नहीं|जीरो डाउन पेमेंट|કબજો મળે ત્યાં સુધી ઈએમઆઈ નહીં)/i,
    reason: "unapproved_payment_scheme_indic",
  },
];

// Single figure price claim patterns (must be flagged unless clearly describing a range)
const SINGLE_FIGURE_PRICE_PATTERNS: RegExp[] = [
  // English: "priced at", "costs exactly", "cost is", "rate is", "price is", "for a 2 BHK", etc.
  /\b(priced at|costs exactly|costs\b|cost is|rate is|price is|is priced at|selling for|fixed at|exact price of|final price of)\s*(?:₹|rs\.?|inr)?\s*\d+/i,
  /\b(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?\s*(?:lakhs?|cr(?:ore)?s?)\s+for\s+(?:a\s+)?(?:\d+\s*bhk|this\s+apartment|the\s+flat)\b/i,
  // Hindi
  /(कीमत\s*है|भाव\s*है|लागत\s*है|मूल्य\s*है|की\s*दर\s*है)\s*(?:₹|रु\.?|रुपये)?\s*\d+/i,
  /\d+\s*(?:लाख|करोड़)\s*(?:रुपये)?\s*में\s*(?:2|3)\s*बीएचके/i,
  // Gujarati
  /(કિંમત\s*છે|ભાવ\s*છે|દર\s*છે)\s*(?:₹|રૂ\.?|રૂપિયા)?\s*\d+/i,
  /\d+\s*(?:લાખ|કરોડ)\s*(?:રૂપિયા)?\s*માં\s*(?:2|3)\s*બીએચકે/i,
];

// Clear range indicators across English, Hindi, and Gujarati
const RANGE_INDICATORS: RegExp[] = [
  /\b(range|ranges|between|from)\b[\s\S]{1,40}\b(to|and|-|–)\b/i,
  /\b\d+(?:\.\d+)?\s*(?:lakhs?|cr(?:ore)?s?)\s*(?:to|-|–)\s*(?:rs\.?|₹|inr)?\s*\d+(?:\.\d+)?\s*(?:lakhs?|cr(?:ore)?s?)\b/i,
  /(से|થી)[\s\S]{1,40}(तक|સુધી)/i,
  /\d+(?:\.\d+)?\s*(?:लाख|करोड़)\s*(?:से|तक|-|–)\s*\d+(?:\.\d+)?\s*(?:लाख|करोड़)/i,
  /\d+(?:\.\d+)?\s*(?:લાખ|કરોડ)\s*(?:થી|સુધી|-|–)\s*\d+(?:\.\d+)?\s*(?:લાખ|કરોડ)/i,
];

export function isClearlyRange(text: string): boolean {
  return RANGE_INDICATORS.some((pattern) => pattern.test(text));
}

/**
 * Extracts numeric rupee values mentioned in text (converted to Lakhs INR).
 * Detects patterns like:
 * - "Rs 50 Lakh" -> 50
 * - "₹ 1.5 Crore" -> 150
 * - "60 लाख" -> 60
 * - "1.4 કરોડ" -> 140
 * - "Rs 45,00,000" -> 45
 */
export function extractRupeeAmountsInLakhs(text: string): number[] {
  const amounts: number[] = [];

  // 1. Raw numbers with commas (e.g. Rs 50,00,000 or 1,20,00,000)
  const fullRupeeRegex = /(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{2,3})+)/gi;
  let match: RegExpExecArray | null;
  while ((match = fullRupeeRegex.exec(text)) !== null) {
    const rawNum = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(rawNum) && rawNum >= 100000) {
      amounts.push(rawNum / 100000);
    }
  }

  // 2. Crores / કરોડ / करोड़ (e.g. 1.2 Crore, 0.5 Cr, 1.5 કરોડ, 2 करोड़)
  const croreRegex = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|करोड़|करोड|કરોડ)(?!\p{L})/giu;
  while ((match = croreRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) {
      amounts.push(Math.round(val * 100 * 100) / 100);
    }
  }

  // 3. Lakhs / લાખ / लाख (e.g. Rs 75 Lakh, 65 lakh, 50 लाख, 60 લાખ)
  const lakhRegex = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lac|lacs|लाख|લાખ)(?!\p{L})/giu;
  while ((match = lakhRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) {
      amounts.push(Math.round(val * 100) / 100);
    }
  }

  return amounts;
}

/**
 * Guardrail Price Checker:
 * Analyzes model output before dispatching to prospective buyers.
 * Returns passed: false if the text contains forbidden discounts, exact prices,
 * unauthorized investment guarantees, or prices outside the fact sheet bounds.
 */
export function checkPriceGuardrails(
  replyText: string,
  language: "en" | "hi" | "gu" = "en",
  projectContext?: "project1" | "project2" | "all" | string
): GuardrailCheckResult {
  const fallback = SAFE_PRICE_FALLBACK[language] || SAFE_PRICE_FALLBACK.en;

  // 1. Check for forbidden keywords and phrases
  for (const rule of FORBIDDEN_PATTERNS) {
    const match = rule.regex.exec(replyText);
    if (match) {
      return {
        passed: false,
        reason: rule.reason,
        violatingSnippet: match[0],
        fallbackMessage: fallback,
      };
    }
  }

  // 2. Extract rupee amounts
  const extractedLakhs = extractRupeeAmountsInLakhs(replyText);
  const isRange = isClearlyRange(replyText);

  // 3. Check portfolio boundary limits first
  for (const amt of extractedLakhs) {
    if (amt < MIN_ALLOWED_PRICE_LAKHS - 0.05) {
      return {
        passed: false,
        reason: `price_below_minimum (${amt}L < ${MIN_ALLOWED_PRICE_LAKHS}L)`,
        violatingSnippet: `${amt} Lakhs`,
        fallbackMessage: fallback,
      };
    }

    if (amt > MAX_ALLOWED_PRICE_LAKHS + 0.05) {
      return {
        passed: false,
        reason: `price_above_maximum (${amt}L > ${MAX_ALLOWED_PRICE_LAKHS}L)`,
        violatingSnippet: `${amt} Lakhs`,
        fallbackMessage: fallback,
      };
    }
  }

  // 4. Check for single figure price claims (e.g. "priced at", "costs exactly", single figure without range)
  for (const pattern of SINGLE_FIGURE_PRICE_PATTERNS) {
    const match = pattern.exec(replyText);
    if (match && !isRange) {
      return {
        passed: false,
        reason: "single_figure_price_claim",
        violatingSnippet: match[0],
        fallbackMessage: fallback,
      };
    }
  }

  // If a single price figure is stated and it's not a clear range statement, flag it
  if (extractedLakhs.length === 1 && !isRange) {
    return {
      passed: false,
      reason: "single_figure_price_claim",
      violatingSnippet: `${extractedLakhs[0]} Lakhs`,
      fallbackMessage: fallback,
    };
  }

  // 5. Resolve allowed endpoints for the given project (strictly scoped)
  let normalizedProject: "project1" | "project2" | "unknown" = "unknown";

  const lowerContext = (projectContext || "").toLowerCase();
  const lowerReply = replyText.toLowerCase();

  // Check explicit projectContext (by id, key, or name)
  if (
    lowerContext === "project1" ||
    lowerContext === "a0000000-0000-0000-0000-000000000001" ||
    lowerContext.includes("project 1") ||
    lowerContext.includes("grand orchard") ||
    lowerContext.includes("bodakdev") ||
    lowerContext.includes("प्रोजेक्ट 1")
  ) {
    normalizedProject = "project1";
  } else if (
    lowerContext === "project2" ||
    lowerContext === "a0000000-0000-0000-0000-000000000002" ||
    lowerContext.includes("project 2") ||
    lowerContext.includes("serene meadows") ||
    lowerContext.includes("shela") ||
    lowerContext.includes("bopal") ||
    lowerContext.includes("પ્રૉજેક્ટ 2") ||
    lowerContext.includes("પ્રોજેક્ટ 2") ||
    lowerContext.includes("प्रोजेक्ट 2")
  ) {
    normalizedProject = "project2";
  } else {
    // If projectContext is not provided or generic, infer from reply text
    const mentionsP1 =
      lowerReply.includes("project 1") ||
      lowerReply.includes("grand orchard") ||
      lowerReply.includes("bodakdev") ||
      lowerReply.includes("प्रोजेक्ट 1") ||
      lowerReply.includes("પ્રોજેક્ટ 1");

    const mentionsP2 =
      lowerReply.includes("project 2") ||
      lowerReply.includes("serene meadows") ||
      lowerReply.includes("shela") ||
      lowerReply.includes("પ્રૉજેક્ટ 2") ||
      lowerReply.includes("પ્રોજેક્ટ 2") ||
      lowerReply.includes("प्रोजेक्ट 2");

    if (mentionsP1 && !mentionsP2) {
      normalizedProject = "project1";
    } else if (mentionsP2 && !mentionsP1) {
      normalizedProject = "project2";
    } else {
      normalizedProject = "unknown";
    }
  }

  // Allowed endpoints: strictly project endpoints if known, or intersection (both) if unknown
  const allowedEndpoints =
    normalizedProject === "project1"
      ? FACT_SHEET_PRICE_ENDPOINTS.project1
      : normalizedProject === "project2"
      ? FACT_SHEET_PRICE_ENDPOINTS.project2
      : FACT_SHEET_PRICE_ENDPOINTS.both;

  for (const amt of extractedLakhs) {
    const matchesEndpoint = allowedEndpoints.some((ep) => Math.abs(amt - ep) < 0.15);
    if (!matchesEndpoint) {
      return {
        passed: false,
        reason:
          normalizedProject === "unknown"
            ? `unauthorized_price_endpoint (${amt}L cited with unknown project context; price endpoints must match specific project)`
            : `unauthorized_price_endpoint (${amt}L is not a registered fact sheet range endpoint for ${normalizedProject})`,
        violatingSnippet: `${amt} Lakhs`,
        fallbackMessage: fallback,
      };
    }
  }

  return {
    passed: true,
    fallbackMessage: fallback,
  };
}
