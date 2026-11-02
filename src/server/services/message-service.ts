import { db } from "../db";
import { messageLog } from "../db/schema";

export type MessageChannel = "whatsapp" | "sms" | "email";

export interface SendMessageOptions {
  channel: MessageChannel;
  to: string;
  template: string;
  body: string;
}

export interface IMessageService {
  sendMessage(options: SendMessageOptions): Promise<{ id: string; status: "queued" | "sent" | "delivered" | "failed" }>;
}

/**
 * Mocked message service that logs all outgoing dispatches to the message_log table.
 */
export class MockMessageService implements IMessageService {
  async sendMessage(options: SendMessageOptions, dbOrTx: typeof db = db) {
    const [log] = await dbOrTx
      .insert(messageLog)
      .values({
        channel: options.channel,
        to: options.to,
        template: options.template,
        body: options.body,
        status: "sent",
      })
      .returning({
        id: messageLog.id,
        status: messageLog.status,
      });

    return log;
  }
}

export const messageService = new MockMessageService();
