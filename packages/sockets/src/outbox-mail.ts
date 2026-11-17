/** Default mail sender: sends nothing over the network, keeps each message per tenant and logs one line. */
import type { MailSender } from "./socket-types.ts";

export interface SentMail {
  toAddress: string;
  subject: string;
  textBody: string;
}

const MAIL_ADDRESS_PATTERN = /^[^@\s]+@[^@\s]+$/;

export function buildOutboxMail(input: { writeLine: (line: string) => void }): MailSender & {
  listSent: (request: { tenantId: string }) => SentMail[];
} {
  const outbox = new Map<string, SentMail[]>();
  return {
    sendMail: async (message) => {
      if (!MAIL_ADDRESS_PATTERN.test(message.toAddress)) {
        throw new Error("Invalid mail address");
      }
      const sent = { toAddress: message.toAddress, subject: message.subject, textBody: message.textBody };
      outbox.set(message.tenantId, [...(outbox.get(message.tenantId) ?? []), sent]);
      input.writeLine(`Mail to ${message.toAddress}: ${message.subject}`);
    },
    listSent: (request) => [...(outbox.get(request.tenantId) ?? [])],
  };
}
