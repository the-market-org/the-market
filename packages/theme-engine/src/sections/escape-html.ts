const HTML_ENTITIES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
]);

/** Makes any text safe to place in HTML content or a quoted attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ENTITIES.get(character) ?? character);
}

/** A setting as text: anything that is not a string reads as "". */
export function readSettingText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
