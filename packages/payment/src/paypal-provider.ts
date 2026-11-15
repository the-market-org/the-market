import type { PaymentProvider } from "./payment-provider.ts";

/**
 * Placeholder showing where a second gateway plugs in.
 * A real implementation maps the contract onto PayPal's Orders API:
 *   createPayment  -> create order (intent AUTHORIZE), return the approval link as redirectUrl
 *   capturePayment -> capture the authorization
 *   refundPayment  -> refund the capture
 *   cancelPayment  -> void the authorization
 *   parseWebhook   -> verify the webhook signature, map the event type to a PaymentStatus
 * No other package changes when this file is filled in.
 */
export function buildPaypalProvider(): PaymentProvider {
  const rejectCall = async (): Promise<never> => {
    throw new Error("PayPal provider is not implemented yet");
  };
  return {
    providerId: "paypal",
    createPayment: rejectCall,
    capturePayment: rejectCall,
    refundPayment: rejectCall,
    cancelPayment: rejectCall,
    parseWebhook: rejectCall,
  };
}
