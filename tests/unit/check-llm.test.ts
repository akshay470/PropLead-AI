import { describe, it, expect } from "vitest";
import { categorizeLlmError } from "../../src/server/ai/errors";
import { runLlmCheck } from "../../scripts/check-llm";

describe("LLM Configuration and Health Checker (check:llm)", () => {
  describe("categorizeLlmError categorization rules", () => {
    it("should categorize 400 with invalid API key as 'invalid key'", () => {
      const cat = categorizeLlmError(400, "API key not valid. Please pass a valid API key.");
      expect(cat.category).toBe("invalid key");
    });

    it("should categorize 401 / 403 as 'invalid key'", () => {
      expect(categorizeLlmError(401, "Unauthorized").category).toBe("invalid key");
      expect(categorizeLlmError(403, "Forbidden caller").category).toBe("invalid key");
    });

    it("should categorize 404 as 'model not found'", () => {
      const cat = categorizeLlmError(
        404,
        "models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent."
      );
      expect(cat.category).toBe("model not found");
    });

    it("should categorize 'no longer available' notice as 'model not found'", () => {
      const cat = categorizeLlmError(
        404,
        "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite."
      );
      expect(cat.category).toBe("model not found");
    });

    it("should categorize 429 and RESOURCE_EXHAUSTED as 'quota'", () => {
      const cat1 = categorizeLlmError(429, "Rate limit exceeded for requests per minute.");
      expect(cat1.category).toBe("quota");

      const cat2 = categorizeLlmError(undefined, "RESOURCE_EXHAUSTED: Quota exceeded for quota metric");
      expect(cat2.category).toBe("quota");
    });

    it("should categorize 503 high demand spikes as 'quota'", () => {
      const cat = categorizeLlmError(
        503,
        "This model is currently experiencing high demand. Spikes in demand are usually temporary."
      );
      expect(cat.category).toBe("quota");
    });

    it("should categorize fetch errors and timeouts as 'network'", () => {
      const netError = new Error("fetch failed: ECONNREFUSED 127.0.0.1:443");
      expect(categorizeLlmError(netError).category).toBe("network");

      const timeoutError = new Error("The operation was aborted due to timeout");
      expect(categorizeLlmError(timeoutError).category).toBe("network");
    });
  });

  describe("runLlmCheck environment execution logic", () => {
    it("should report OK for mock provider", async () => {
      const res = await runLlmCheck({
        LLM_PROVIDER: "mock",
        LLM_MODEL: "deterministic-mock-v1",
      });
      expect(res.status).toBe("OK");
      expect(res.provider).toBe("mock");
    });

    it("should report FAIL with 'invalid key' if LLM_API_KEY is missing", async () => {
      const res = await runLlmCheck({
        LLM_PROVIDER: "gemini",
        LLM_MODEL: "gemini-3.5-flash-lite",
        LLM_API_KEY: "",
      });
      expect(res.status).toBe("FAIL");
      expect(res.category).toBe("invalid key");
    });

    it("should report FAIL with 'model not found' and hint if LLM_MODEL is missing", async () => {
      const res = await runLlmCheck({
        LLM_PROVIDER: "gemini",
        LLM_MODEL: "",
        LLM_API_KEY: "AIzaSyDummyKeyForTesting",
      });
      expect(res.status).toBe("FAIL");
      expect(res.category).toBe("model not found");
      expect(res.hint).toContain("Set LLM_MODEL in .env.local to a current model name");
    });
  });
});
