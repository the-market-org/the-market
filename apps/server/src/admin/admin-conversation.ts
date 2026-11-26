/** The merchant's conversation with the store's agent: a message box, the recent messages, and whether an agent listens. */
import { escapeHtml } from "@the-market/theme-engine";

type Message = { messageId: string; text: string; sentAt: string };
type Connection = { eventsUrl: string; eventNames: string[] } | undefined;

/** Says whether the store's agent will hear messages, so a store without one knows messages only wait. */
export function describeListener(connection: Connection): string {
  if (connection === undefined) {
    return "No agent is connected. Messages are saved, and the store keeps selling without one.";
  }
  return connection.eventNames.includes("merchant.message.sent") ? "The store's agent receives these messages." : "An agent is connected, but it does not listen for messages.";
}

/** The conversation section: who listens, a message notice, the form, and the last messages, newest first, escaped. */
export function renderConversation(input: { messages: Message[]; connection: Connection; notice: string; describe: typeof describeListener }): string {
  const notice = input.notice === "" ? "" : `<p role="alert">${escapeHtml(input.notice)}</p>`;
  const items = input.messages.map((message) => `<li><time datetime="${escapeHtml(message.sentAt)}">${escapeHtml(message.sentAt.slice(0, 16).replace("T", " "))}</time> ${escapeHtml(message.text)}</li>`).join("");
  return `<h2>Talk to your agent</h2><p>${escapeHtml(input.describe(input.connection))}</p>${notice}<form method="post" action="/admin/messages"><label>Message <textarea name="text" maxlength="2000" required></textarea></label><button>Send</button></form><ul>${items}</ul>`;
}
