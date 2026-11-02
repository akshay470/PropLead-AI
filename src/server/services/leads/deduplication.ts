import { normalizePhoneToE164 } from "@/lib/phone";

export interface DedupeLeadRecord {
  id: string;
  leadCode: string;
  name: string;
  phoneE164: string;
  email?: string | null;
  createdAt: Date | string;
  duplicateOfId?: string | null;
  optedOut?: boolean;
}

export interface FindDuplicateCandidate {
  id?: string;
  phone: string;
  email?: string | null;
  name?: string;
  createdAt?: Date | string;
  optedOut?: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  canonicalLead: DedupeLeadRecord | null;
  matchedBy?: "phone" | "email";
}

/**
 * Pure function to detect duplicates against existing leads.
 * Rules:
 * 1. Primary match: same E.164 normalized phone number.
 * 2. Secondary match: same case-insensitive email address.
 * 3. The OLDEST matching lead (by createdAt) is the canonical lead.
 * 4. Resolves multi-hop duplicate chains to the root canonical lead.
 * 5. Returns null if candidate does not match any existing lead.
 */
export function findDuplicate(
  candidate: FindDuplicateCandidate,
  existingLeads: DedupeLeadRecord[]
): DuplicateCheckResult {
  if (!existingLeads || existingLeads.length === 0) {
    return { isDuplicate: false, canonicalLead: null };
  }

  // Normalize candidate phone to E.164
  let normalizedCandidatePhone: string;
  try {
    normalizedCandidatePhone = normalizePhoneToE164(candidate.phone);
  } catch {
    normalizedCandidatePhone = candidate.phone.trim();
  }

  const normalizedCandidateEmail = candidate.email?.trim().toLowerCase() || null;

  // Find direct matches (excluding self if candidate already has an ID)
  const matches: DedupeLeadRecord[] = [];
  let matchedBy: "phone" | "email" | undefined;

  for (const lead of existingLeads) {
    if (candidate.id && lead.id === candidate.id) {
      continue;
    }

    let leadPhoneE164: string;
    try {
      leadPhoneE164 = normalizePhoneToE164(lead.phoneE164);
    } catch {
      leadPhoneE164 = lead.phoneE164;
    }

    const leadEmail = lead.email?.trim().toLowerCase() || null;

    const phoneMatch = leadPhoneE164 === normalizedCandidatePhone;
    const emailMatch =
      Boolean(normalizedCandidateEmail && leadEmail && leadEmail === normalizedCandidateEmail);

    if (phoneMatch) {
      matches.push(lead);
      if (!matchedBy) matchedBy = "phone";
    } else if (emailMatch) {
      matches.push(lead);
      if (!matchedBy) matchedBy = "email";
    }
  }

  if (matches.length === 0) {
    return { isDuplicate: false, canonicalLead: null };
  }

  // Resolve canonical lead:
  // Build a set of all leads involved in the chain (direct matches + any canonical parents they point to)
  const leadsById = new Map<string, DedupeLeadRecord>();
  for (const lead of existingLeads) {
    leadsById.set(lead.id, lead);
  }

  const candidatePool: DedupeLeadRecord[] = [];

  for (const match of matches) {
    candidatePool.push(match);

    // If match is already a duplicate, trace up to root
    let current: DedupeLeadRecord = match;
    const visited = new Set<string>([current.id]);

    while (current.duplicateOfId && leadsById.has(current.duplicateOfId)) {
      const parent = leadsById.get(current.duplicateOfId)!;
      if (visited.has(parent.id)) break; // cycle protection
      visited.add(parent.id);
      candidatePool.push(parent);
      current = parent;
    }
  }

  // Deduplicate pool by ID
  const uniquePool = Array.from(
    new Map(candidatePool.map((lead) => [lead.id, lead])).values()
  );

  // Sort by createdAt ascending (oldest first)
  uniquePool.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  });

  const canonicalLead = uniquePool[0];

  return {
    isDuplicate: true,
    canonicalLead,
    matchedBy,
  };
}
