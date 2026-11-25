/** The attributes every storefront cookie shares: `Secure` everywhere but local development over plain http. */
export function buildCookieAttributes(input: { secure: boolean }): string {
  return input.secure ? "Path=/; HttpOnly; SameSite=Lax; Secure" : "Path=/; HttpOnly; SameSite=Lax";
}
