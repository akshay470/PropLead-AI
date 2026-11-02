import { describe, it, expect } from "vitest";
import {
  checkPriceGuardrails,
  extractRupeeAmountsInLakhs,
  MIN_ALLOWED_PRICE_LAKHS,
  MAX_ALLOWED_PRICE_LAKHS,
} from "@/server/ai/guardrails/price-checker";

describe("Price and Compliance Output Guardrail", () => {
  describe("Rupee Amount Extraction Helper", () => {
    it("extracts lakhs from standard formats", () => {
      expect(extractRupeeAmountsInLakhs("Prices range from Rs 75 Lakh to Rs 88 Lakh")).toEqual([75, 88]);
      expect(extractRupeeAmountsInLakhs("Indicative price is ₹ 65 lakhs")).toEqual([65]);
      expect(extractRupeeAmountsInLakhs("Approx 110 lac")).toEqual([110]);
    });

    it("extracts crores and converts to lakhs", () => {
      expect(extractRupeeAmountsInLakhs("From 0.98 Cr to 1.2 Crore")).toEqual([98, 120]);
      expect(extractRupeeAmountsInLakhs("Budget is 1.5 crore")).toEqual([150]);
    });

    it("extracts Hindi and Gujarati number expressions", () => {
      expect(extractRupeeAmountsInLakhs("कीमत 75 लाख से 85 लाख के बीच है")).toEqual([75, 85]);
      expect(extractRupeeAmountsInLakhs("કિંમત 65 લાખ થી 80 લાખ સુધી છે")).toEqual([65, 80]);
      expect(extractRupeeAmountsInLakhs("બજેટ 1.10 કરોડ")).toEqual([110]);
    });
  });

  describe("Guardrail Checker Rule Enforcements (>= 25 test cases)", () => {
    // 1-5: Legitimate fact-sheet compliant replies (MUST PASS)
    it("Case 1: allows legitimate price range in English within 65L-1.2Cr", () => {
      const res = checkPriceGuardrails(
        "Project 1 residences range from Rs 75 Lakh to Rs 88 Lakh for 2 BHK units."
      );
      expect(res.passed).toBe(true);
    });

    it("Case 2: allows Project 2 price range starting at Rs 65 Lakh", () => {
      const res = checkPriceGuardrails(
        "At Serene Meadows, 2 BHK homes range from Rs 65 Lakh to Rs 76 Lakh."
      );
      expect(res.passed).toBe(true);
    });

    it("Case 3: allows legitimate 3 BHK range up to 1.2 Crore", () => {
      const res = checkPriceGuardrails(
        "3 BHK luxury apartments are priced between Rs 98 Lakh and Rs 1.20 Crore."
      );
      expect(res.passed).toBe(true);
    });

    it("Case 4: allows legitimate Hindi price range within bounds", () => {
      const res = checkPriceGuardrails(
        "प्रोजेक्ट 1 में 2 बीएचके की सांकेतिक कीमत 75 लाख से 88 लाख रुपये के बीच है।",
        "hi"
      );
      expect(res.passed).toBe(true);
    });

    it("Case 5: allows legitimate Gujarati price range within bounds", () => {
      const res = checkPriceGuardrails(
        "પ્રોજેક્ટ 2 માં 2 બીએચકે ની કિંમત 65 લાખ થી 76 લાખ ની વચ્ચે છે.",
        "gu"
      );
      expect(res.passed).toBe(true);
    });

    // 6-10: Out of bounds price violations (MUST FAIL)
    it("Case 6: flags price below Rs 65 Lakh (e.g. 50 Lakh)", () => {
      const res = checkPriceGuardrails("We can give you this apartment for Rs 50 Lakh!");
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("price_below_minimum");
    });

    it("Case 7: flags price below minimum in Hindi (40 लाख)", () => {
      const res = checkPriceGuardrails("यह फ्लैट आपको मात्र 40 लाख में मिल जाएगा।", "hi");
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("price_below_minimum");
    });

    it("Case 8: flags price below minimum in Gujarati (55 લાખ)", () => {
      const res = checkPriceGuardrails("આ ફ્લેટ તમને 55 લાખ માં મળશે.", "gu");
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("price_below_minimum");
    });

    it("Case 9: flags price above Rs 1.2 Crore (e.g. 1.5 Crore)", () => {
      const res = checkPriceGuardrails("Penthouse units start at Rs 1.5 Crore.");
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("price_above_maximum");
    });

    it("Case 10: flags price above 1.2 Crore in Hindi (1.8 करोड़)", () => {
      const res = checkPriceGuardrails("कीमत 1.8 करोड़ रुपये तक जाती है।", "hi");
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("price_above_maximum");
    });

    // 11-15: Forbidden discount and negotiation phrasing in English (MUST FAIL)
    it("Case 11: flags discount promise", () => {
      const res = checkPriceGuardrails("We can offer you a special 5% discount if you book today.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise");
    });

    it("Case 12: flags negotiation phrasing", () => {
      const res = checkPriceGuardrails("The prices are negotiable during your in-person visit.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise");
    });

    it("Case 13: flags 'best price' claim", () => {
      const res = checkPriceGuardrails("I will ensure you get the best price on your apartment.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise");
    });

    it("Case 14: flags 'final price' promise", () => {
      const res = checkPriceGuardrails("The final price for this 2 BHK is Rs 75 Lakh.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise");
    });

    it("Case 15: flags cashback and festive offers", () => {
      const res = checkPriceGuardrails("Book this week to avail our limited offer and cashback.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise");
    });

    // 16-20: Forbidden discount and negotiation phrasing in Hindi & Gujarati (MUST FAIL)
    it("Case 16: flags Hindi discount keyword (छूट)", () => {
      const res = checkPriceGuardrails("यदि आप कल आते हैं तो हम 2 लाख की छूट दे सकते हैं।", "hi");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise_hi");
    });

    it("Case 17: flags Hindi negotiation (मोलभाव)", () => {
      const res = checkPriceGuardrails("सेल्स ऑफिस में मोलभाव की गुंजाइश है।", "hi");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise_hi");
    });

    it("Case 18: flags Gujarati discount keyword (છૂટ)", () => {
      const res = checkPriceGuardrails("આ અઠવાડિયે બુક કરવા પર ખાસ છૂટ મળશે.", "gu");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise_gu");
    });

    it("Case 19: flags Gujarati negotiation (વાટાઘાટો)", () => {
      const res = checkPriceGuardrails("કિંમતમાં વાટાઘાટો શક્ય છે.", "gu");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise_gu");
    });

    it("Case 20: flags Hindi final rate (अंतिम भाव / पक्की कीमत)", () => {
      const res = checkPriceGuardrails("इस यूनिट की अंतिम कीमत 80 लाख है।", "hi");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("discount_or_exact_price_promise_hi");
    });

    // 21-25: Unauthorized guarantees and returns (MUST FAIL)
    it("Case 21: flags 'guaranteed' capital appreciation", () => {
      const res = checkPriceGuardrails("This project offers guaranteed 15% appreciation annually.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("unauthorized_guarantee_or_returns");
    });

    it("Case 22: flags 'assured returns' claim", () => {
      const res = checkPriceGuardrails("Invest now and get assured returns on rental lease.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("unauthorized_guarantee_or_returns");
    });

    it("Case 23: flags Hindi guarantee (गारंटी / सुनिश्चित रिटर्न)", () => {
      const res = checkPriceGuardrails("यह निवेश आपको सुनिश्चित रिटर्न की गारंटी देता है।", "hi");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("unauthorized_guarantee_or_returns_hi");
    });

    it("Case 24: flags Gujarati guarantee (ખાતરીબંધ વળતર / નફાની ખાતરી)", () => {
      const res = checkPriceGuardrails("આ પ્રોજેક્ટ માં ખાતરીબંધ વળતર મળશે.", "gu");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("unauthorized_guarantee_or_returns_gu");
    });

    it("Case 25: flags unapproved subvention scheme (No EMI till possession)", () => {
      const res = checkPriceGuardrails("We have a special no emi till possession scheme active.");
      expect(res.passed).toBe(false);
      expect(res.reason).toBe("unapproved_payment_scheme");
    });

    it("Case 26: fallback message replacement matches language", () => {
      const resEn = checkPriceGuardrails("We give you 20% discount!", "en");
      expect(resEn.passed).toBe(false);
      expect(resEn.fallbackMessage).toContain("Our sales team will confirm pricing");

      const resHi = checkPriceGuardrails("हम 20% छूट देंगे!", "hi");
      expect(resHi.passed).toBe(false);
      expect(resHi.fallbackMessage).toContain("हमारी सेल्स टीम आपसे सीधे संपर्क कर");

      const resGu = checkPriceGuardrails("અમે 20% છૂટ આપીશું!", "gu");
      expect(resGu.passed).toBe(false);
      expect(resGu.fallbackMessage).toContain("અમારી સેલ્સ ટીમ સીધો સંપર્ક કરીને");
    });
  });
});
