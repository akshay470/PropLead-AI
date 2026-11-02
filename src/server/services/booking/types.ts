export type BookingOutcome = "visited" | "no_show";

export interface FreeSlot {
  id: string;
  projectId: string;
  projectName?: string;
  executiveId: string | null;
  executiveFirstName: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

export type BookVisitResult =
  | {
      success: true;
      booking: {
        id: string;
        slotId: string;
        leadId: string;
        status: "confirmed";
        createdAt: Date;
      };
      reminders: Array<{
        id: string;
        type: "1_day" | "2_hour";
        scheduledAt: Date;
        status: string;
      }>;
    }
  | {
      success: false;
      code: "SLOT_TAKEN";
      message: string;
      alternativeSlots: FreeSlot[];
    }
  | {
      success: false;
      code:
        | "SLOT_NOT_FOUND"
        | "PAST_SLOT"
        | "SLOT_UNDER_CUTOFF"
        | "LEAD_NOT_FOUND"
        | "NO_CONSENT"
        | "OPTED_OUT"
        | "ALREADY_BOOKED"
        | "CONCURRENCY_ERROR";
      message: string;
      existingBookingId?: string;
    };

export interface CancelBookingResult {
  success: boolean;
  message?: string;
  booking?: {
    id: string;
    status: string;
  };
}

export interface RescheduleBookingResult {
  success: boolean;
  code?: string;
  message?: string;
  previousBookingId?: string;
  newBooking?: {
    id: string;
    slotId: string;
    status: string;
  };
  alternativeSlots?: FreeSlot[];
}
