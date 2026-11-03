import { z } from "zod";

export class InvalidPhoneNumberError extends Error {
  constructor(message = "Invalid phone number format") {
    super(message);
    this.name = "InvalidPhoneNumberError";
  }
}

/**
 * Normalizes a phone number to standard E.164 format (+91XXXXXXXXXX for India).
 * Supports standard local variations:
 * - "9876543210" -> "+919876543210"
 * - "09876543210" -> "+919876543210"
 * - "+91 98765 43210" -> "+919876543210"
 * - "919876543210" -> "+919876543210"
 * - "+91-98765-43210" -> "+919876543210"
 */
export function normalizePhoneToE164(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== "string") {
    throw new InvalidPhoneNumberError("Phone number is required");
  }

  // Remove common punctuation and whitespace
  const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, "");

  // Match optional leading plus, optional 0 or 91 country code, followed by 10 digits
  // Indian mobile numbers start with 6, 7, 8, or 9
  let digits = cleaned;
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  // Case 1: Prefixed with country code 91 (e.g. 919876543210 -> 12 digits)
  if (digits.length === 12 && digits.startsWith("91")) {
    const subscriber = digits.slice(2);
    if (/^[6-9]\d{9}$/.test(subscriber)) {
      return `+91${subscriber}`;
    }
  }

  // Case 2: Prefixed with trunk prefix 0 (e.g. 09876543210 -> 11 digits)
  if (digits.length === 11 && digits.startsWith("0")) {
    const subscriber = digits.slice(1);
    if (/^[6-9]\d{9}$/.test(subscriber)) {
      return `+91${subscriber}`;
    }
  }

  // Case 3: 10-digit mobile number (e.g. 9876543210)
  if (digits.length === 10) {
    if (/^[6-9]\d{9}$/.test(digits)) {
      return `+91${digits}`;
    }
  }

  // Case 4: Explicit international E.164 number (must start with '+')
  if (cleaned.startsWith("+")) {
    const intlDigits = cleaned.slice(1);
    // E.164 allows 7 to 15 digits
    if (/^[1-9]\d{6,14}$/.test(intlDigits)) {
      return `+${intlDigits}`;
    }
  }

  throw new InvalidPhoneNumberError(
    `Unable to normalize phone number: "${rawPhone}". Expected valid 10-digit Indian mobile number.`
  );
}

/**
 * Validates if the phone number can be normalized to valid E.164.
 */
export function isValidPhone(phone: string): boolean {
  try {
    normalizePhoneToE164(phone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats an E.164 phone number into human-readable spaced format: +91 98765 43210
 */
export function formatPhoneDisplay(e164Phone: string): string {
  if (!e164Phone) return "";
  if (e164Phone.startsWith("+91") && e164Phone.length === 13) {
    return `+91 ${e164Phone.slice(3, 8)} ${e164Phone.slice(8)}`;
  }
  return e164Phone;
}

/**
 * Privacy helper masking recipient phone numbers or emails to the last 4 digits.
 * Example: "+919825012345" -> "+91 ******2345"
 * Example: "buyer@example.com" -> "b***@example.com"
 */
export function maskRecipient(to: string): string {
  if (!to) return "******";
  const trimmed = to.trim();
  const last4 = trimmed.slice(-4);
  if (trimmed.startsWith("+91")) {
    return `+91 ******${last4}`;
  }
  if (trimmed.includes("@")) {
    const [user, domain] = trimmed.split("@");
    return `${user.slice(0, 1)}***@${domain}`;
  }
  return `******${last4}`;
}

/**
 * Zod schema validator and transformer for phone numbers.
 */
export const phoneSchema = z
  .string()
  .min(10, "Phone number is too short")
  .max(20, "Phone number is too long")
  .transform((val, ctx) => {
    try {
      return normalizePhoneToE164(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : "Invalid phone number",
      });
      return z.NEVER;
    }
  });
