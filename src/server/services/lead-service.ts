import { normalizePhoneToE164 } from "@/lib/phone";

/**
 * Generates human-friendly lead code format: "LD-58210"
 */
export function generateLeadCode(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `LD-${randomNum}`;
}

export interface LeadFilterOptions {
  projectId?: string;
  source?: string;
  assignedExecutiveId?: string;
  status?: string;
}

export const leadService = {
  generateCode: generateLeadCode,
  normalizePhone: normalizePhoneToE164,
};
