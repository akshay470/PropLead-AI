import { z } from "zod";

export const messageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(1000, "Message length cannot exceed 1000 characters"),
});

export type MessageInput = z.infer<typeof messageSchema>;
