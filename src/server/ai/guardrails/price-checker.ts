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
  language: "en" | "hi" | "gu" = "en"
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

  // 2. Check for extracted rupee amounts
  const extractedLakhs = extractRupeeAmountsInLakhs(replyText);
  for (const amt of extractedLakhs) {
    // Permissible range: Rs 65 Lakh to Rs 120 Lakh (1.20 Cr)
    // Allow slight float margin of 0.05
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

  return {
    passed: true,
    fallbackMessage: fallback,
  };
}
