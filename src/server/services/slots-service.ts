export class SlotDoubleBookedError extends Error {
  constructor(message = "This slot was just booked by another buyer. Please select another slot.") {
    super(message);
    this.name = "SlotDoubleBookedError";
  }
}

export const slotsService = {
  // Service methods for booking and concurrency handling will be fully implemented in Step 3
};
