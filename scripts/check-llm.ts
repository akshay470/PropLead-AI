import "../src/server/env-load";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { categorizeLlmError, LlmErrorCategory } from "../src/server/ai/errors";

export interface CheckLlmExecutionResult {
  status: "OK" | "FAIL";
  provider: string;
  model: string;
  category?: LlmErrorCategory;
  hint?: string;
  reason?: string;
}

/**
 * Executes a single lightweight real call to verify LLM provider configuration.
 * Never prints or leaks secret API keys or full request payloads.
 */
export async function runLlmCheck(customEnv?: Record<string, string>): Promise<CheckLlmExecutionResult> {
  const envValues: Record<string, string> = {};

  if (customEnv) {
    Object.assign(envValues, customEnv);
  } else {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const parsedLocal = dotenv.parse(fs.readFileSync(envLocalPath));
      Object.assign(envValues, parsedLocal);
    }
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const parsedRoot = dotenv.parse(fs.readFileSync(envPath));
      Object.assign(envValues, parsedRoot);
    }
    // Fall back to process.env for any environment overrides
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && envValues[k] === undefined) {
        envValues[k] = v;
      }
    }
  }

  const provider = (envValues.LLM_PROVIDER || "mock").trim().toLowerCase();
  const model = (envValues.LLM_MODEL || "").trim();
  const apiKey = (envValues.LLM_API_KEY || "").trim();

  // 1. Mock Provider
  if (provider === "mock") {
    return {
      status: "OK",
      provider: "mock",
      model: model || "deterministic-mock-v1",
      reason: "Mock provider active (deterministic offline mode)",
    };
  }

  // 2. Google Gemini Provider
  if (provider === "gemini" || provider === "google") {
    if (!apiKey) {
      return {
        status: "FAIL",
        provider,
        model,
        category: "invalid key",
        reason: "LLM_API_KEY is not set or empty in .env.local",
      };
    }

    if (!model) {
      return {
        status: "FAIL",
        provider,
        model,
        category: "model not found",
        reason: "LLM_MODEL is not set in .env.local",
        hint: "Set LLM_MODEL in .env.local to a current model name (e.g. gemini-3.5-flash-lite, gemini-3.5-flash, or gemini-3.8-flash).",
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMessage = "";
        try {
          const errData = await res.json();
          errMessage = errData.error?.message || "";
        } catch {
          errMessage = await res.text().catch(() => "");
        }

        const categorized = categorizeLlmError(res.status, errMessage);
        const result: CheckLlmExecutionResult = {
          status: "FAIL",
          provider,
          model,
          category: categorized.category,
          reason: categorized.reason,
        };

        if (categorized.category === "model not found") {
          result.hint = "Set LLM_MODEL in .env.local to a current model name (e.g. gemini-3.5-flash-lite, gemini-3.5-flash, or gemini-3.8-flash).";
        }

        return result;
      }

      return {
        status: "OK",
        provider,
        model,
        reason: "Upstream connection and model response verified successfully.",
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const categorized = categorizeLlmError(err);
      const result: CheckLlmExecutionResult = {
        status: "FAIL",
        provider,
        model,
        category: categorized.category,
        reason: categorized.reason,
      };

      if (categorized.category === "model not found") {
        result.hint = "Set LLM_MODEL in .env.local to a current model name (e.g. gemini-3.5-flash-lite, gemini-3.5-flash, or gemini-3.8-flash).";
      }

      return result;
    }
  }

  return {
    status: "FAIL",
    provider,
    model,
    category: "network",
    reason: `Unsupported provider '${provider}'.`,
  };
}

async function main() {
  const result = await runLlmCheck();

  if (result.status === "OK") {
    console.log(`OK (Provider: ${result.provider}, Model: ${result.model})`);
    process.exit(0);
  } else {
    console.error(`FAIL - ${result.category}`);
    if (result.hint) {
      console.log(`Hint: ${result.hint}`);
    }
    process.exit(1);
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/check-llm.ts"))) {
  main().catch(() => {
    console.error("FAIL - network");
    process.exit(1);
  });
}
