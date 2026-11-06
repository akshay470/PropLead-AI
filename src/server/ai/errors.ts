export type LlmErrorCategory = "invalid key" | "model not found" | "quota" | "network";

export interface CategorizedError {
  category: LlmErrorCategory;
  reason: string;
}

/**
 * Categorizes an LLM API error or response into a standard error category:
 * - 'invalid key': Bad, missing, or unauthorized API key (HTTP 400 with key error, 401, 403)
 * - 'model not found': Deprecated, retired, or invalid model name (HTTP 404, "no longer available")
 * - 'quota': Rate limit or quota exhaustion (HTTP 429, RESOURCE_EXHAUSTED, 503 high demand)
 * - 'network': Fetch failure, DNS failure, timeout, or socket disconnect
 *
 * Never echoes secret keys or raw request payloads.
 */
export function categorizeLlmError(
  statusOrError?: number | unknown,
  message?: string
): CategorizedError {
  let status: number | undefined;
  let rawMessage = message || "";

  if (typeof statusOrError === "number") {
    status = statusOrError;
  } else if (statusOrError instanceof Error) {
    rawMessage = `${statusOrError.name}: ${statusOrError.message} ${rawMessage}`.trim();
    const statusMatch = statusOrError.message.match(/status\s+(\d{3})/i);
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    }
  } else if (typeof statusOrError === "string") {
    rawMessage = `${statusOrError} ${rawMessage}`.trim();
  } else if (statusOrError && typeof statusOrError === "object") {
    try {
      rawMessage = `${JSON.stringify(statusOrError)} ${rawMessage}`.trim();
    } catch {
      rawMessage = `${String(statusOrError)} ${rawMessage}`.trim();
    }
  }

  const lower = rawMessage.toLowerCase();

  // 1. Invalid API Key
  if (
    status === 400 &&
    (lower.includes("api key") ||
      lower.includes("api_key") ||
      lower.includes("key not valid") ||
      lower.includes("invalid_argument") ||
      lower.includes("api_key_invalid"))
  ) {
    return { category: "invalid key", reason: "API key is rejected or invalid" };
  }
  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("invalid api key") ||
    lower.includes("api key missing") ||
    lower.includes("unauthenticated")
  ) {
    return { category: "invalid key", reason: "API key is missing or unauthorized" };
  }

  // 2. Model Not Found
  if (
    status === 404 ||
    lower.includes("not found for api version") ||
    lower.includes("is not found") ||
    lower.includes("no longer available") ||
    lower.includes("not supported for generatecontent") ||
    lower.includes("unknown model") ||
    lower.includes("model name is not configured")
  ) {
    return { category: "model not found", reason: "Model identifier not found or retired upstream" };
  }

  // 3. Quota Exceeded / Rate Limit
  if (
    status === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    (status === 503 && lower.includes("high demand"))
  ) {
    return { category: "quota", reason: "Upstream rate limit or quota exceeded" };
  }

  // 4. Network / Connectivity / Timeout
  return { category: "network", reason: "Network connection or request timed out" };
}
