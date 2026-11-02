import { ToolDefinition } from "../types";

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "get_fact",
    description:
      "Look up verified project information from the official Gujarat RERA fact sheet. Use this to answer any question about project amenities, unit sizes, carpet areas, pricing bands, locations, possession, parking, or visit timings.",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Optional UUID of the project (Project 1 or Project 2).",
        },
        category: {
          type: "string",
          description: "Optional category: Overview, Unit Types, Pricing, Amenities, Location, Possession, RERA Details, Visit Guidelines, Parking, Loan Assistance, Contact Policy.",
        },
        query: {
          type: "string",
          description: "Keywords or topic of the question (e.g. 'pricing', 'clubhouse', 'parking', 'possession date').",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "save_lead_details",
    description:
      "Save or update the buyer's preferences, budget, unit requirements, preferred project, or detected language as they are learned in conversation.",
    parameters: {
      type: "object",
      properties: {
        wants: {
          type: "string",
          description: "Unit configuration preference, e.g. '2BHK', '3BHK', or '2 or 3 BHK'.",
        },
        budgetMin: {
          type: "number",
          description: "Minimum budget in INR (e.g. 7000000 for Rs 70 Lakh).",
        },
        budgetMax: {
          type: "number",
          description: "Maximum budget in INR (e.g. 11000000 for Rs 1.10 Crore).",
        },
        projectId: {
          type: "string",
          description: "UUID of the project the buyer is interested in.",
        },
        language: {
          type: "string",
          enum: ["en", "hi", "gu"],
          description: "Detected primary language used by the buyer.",
        },
        notes: {
          type: "string",
          description: "Any specific notes, family requirements, or preferences mentioned by the buyer.",
        },
      },
    },
  },
  {
    name: "list_free_slots",
    description:
      "List available 60-minute site visit slots for a project over the next 14 days. Excludes booked slots and slots within the 2-hour operational cutoff.",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "UUID of the project to check free visit slots for.",
        },
        from: {
          type: "string",
          description: "Optional ISO date string start window.",
        },
        to: {
          type: "string",
          description: "Optional ISO date string end window.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "book_visit",
    description:
      "Securely book a real-time visit slot for the buyer. Double-booking is strictly guarded at the database level. Returns confirmation details or alternative slots if the slot was just taken.",
    parameters: {
      type: "object",
      properties: {
        slotId: {
          type: "string",
          description: "UUID of the free visit slot selected by the buyer.",
        },
      },
      required: ["slotId"],
    },
  },
  {
    name: "handoff_to_executive",
    description:
      "Immediately transfer the buyer to a dedicated human sales executive. Call this whenever the buyer asks for a person/agent, when a fact is missing from the fact sheet, or for VIP high-intent situations.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["buyer_requested", "missing_fact", "high_intent", "guardrail", "error"],
          description: "The primary driver for transferring to a sales executive.",
        },
        summary_notes: {
          type: "string",
          description: "Short context or the unanswered question for the sales executive.",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "flag_conversation",
    description:
      "Flag the current conversation for administrative sales head review (e.g. for suspicious input, abusive language, or price discrepancies).",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Detailed reason for flagging this interaction.",
        },
      },
      required: ["reason"],
    },
  },
];
