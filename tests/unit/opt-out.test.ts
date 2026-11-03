import { describe, it, expect } from "vitest";
import { isOptOutMessage, isAmbiguousOptOutQuery } from "@/server/ai/agent";

describe("DPDP Opt-Out Keyword and Phrase Detection", () => {
  describe("Exact Keywords & Unambiguous Opt-Outs (MUST trigger opt-out)", () => {
    it("recognizes standard English keyword 'STOP'", () => {
      expect(isOptOutMessage("STOP")).toBe(true);
      expect(isOptOutMessage("stop")).toBe(true);
      expect(isOptOutMessage(" Stop ")).toBe(true);
      expect(isOptOutMessage("STOP!")).toBe(true);
    });

    it("recognizes standard English keyword 'UNSUBSCRIBE'", () => {
      expect(isOptOutMessage("UNSUBSCRIBE")).toBe(true);
      expect(isOptOutMessage("unsubscribe")).toBe(true);
      expect(isOptOutMessage("optout")).toBe(true);
      expect(isOptOutMessage("opt-out")).toBe(true);
    });

    it("recognizes explicit phrases like 'stop messaging me'", () => {
      expect(isOptOutMessage("stop messaging me")).toBe(true);
      expect(isOptOutMessage("stop sending messages")).toBe(true);
      expect(isOptOutMessage("please stop messaging me")).toBe(true);
      expect(isOptOutMessage("do not message me")).toBe(true);
      expect(isOptOutMessage("unsubscribe me")).toBe(true);
    });

    it("recognizes exact Hindi opt-out keywords & phrases", () => {
      expect(isOptOutMessage("बंद करो")).toBe(true);
      expect(isOptOutMessage("रोकें")).toBe(true);
      expect(isOptOutMessage("रोको")).toBe(true);
      expect(isOptOutMessage("मुझे मैसेज भेजना बंद करो")).toBe(true);
      expect(isOptOutMessage("मैसेज मत भेजो")).toBe(true);
    });

    it("recognizes exact Gujarati opt-out keywords & phrases", () => {
      expect(isOptOutMessage("બંધ કરો")).toBe(true);
      expect(isOptOutMessage("રોકો")).toBe(true);
      expect(isOptOutMessage("મને મેસેજ મોકલવાનું બંધ કરો")).toBe(true);
      expect(isOptOutMessage("મેસેજ ના મોકલો")).toBe(true);
    });
  });

  describe("Non-Opt-Outs & Longer Sentences (MUST NOT trigger opt-out)", () => {
    it("does NOT opt out on 'cancel my visit'", () => {
      expect(isOptOutMessage("cancel my visit")).toBe(false);
    });

    it("does NOT opt out on standalone 'cancel'", () => {
      expect(isOptOutMessage("cancel")).toBe(false);
      expect(isOptOutMessage("I want to cancel")).toBe(false);
    });

    it("does NOT opt out on Hindi 'रद्द' / 'रद्द करें' inside visit cancellation requests", () => {
      expect(isOptOutMessage("मेरी विजिट रद्द करें")).toBe(false);
      expect(isOptOutMessage("स्लॉट रद्द करो")).toBe(false);
    });

    it("does NOT opt out on Gujarati 'રદ કરો' inside appointment changes", () => {
      expect(isOptOutMessage("મારી મુલાકાત રદ કરો")).toBe(false);
      expect(isOptOutMessage("વિઝિટ રદ કરવી છે")).toBe(false);
    });

    it("does NOT opt out on 'stop' in a longer unrelated sentence", () => {
      expect(isOptOutMessage("Can we stop by the clubhouse during our visit?")).toBe(false);
      expect(isOptOutMessage("What is the nearest BRTS bus stop?")).toBe(false);
      expect(isOptOutMessage("Where does the elevator stop?")).toBe(false);
      expect(isOptOutMessage("Please stop at the security gate to get the key")).toBe(false);
    });
  });

  describe("Ambiguous Opt-Out Inquiries", () => {
    it("identifies ambiguous queries to offer opt-out confirmation prompt", () => {
      expect(isAmbiguousOptOutQuery("How do I stop receiving notifications?")).toBe(true);
      expect(isAmbiguousOptOutQuery("how to unsubscribe")).toBe(true);
      expect(isAmbiguousOptOutQuery("how do i opt out")).toBe(true);
      expect(isAmbiguousOptOutQuery("STOP")).toBe(false); // exact opt-out is not ambiguous
    });
  });
});
