/**
 * Donation service — prepared for YooKassa integration.
 *
 * Future integration plan:
 * 1. Backend endpoint creates a payment via YooKassa API
 * 2. Client receives a confirmation_url or widget token
 * 3. User completes payment via redirect or embedded widget
 * 4. Webhook endpoint processes payment.succeeded / payment.canceled
 * 5. Payment status stored in DB (donations table)
 */

export interface DonationIntent {
  amount: number;
  currency: string;
  recurring: boolean;
  donor: {
    name: string;
    phone: string;
    email: string;
  };
}

export interface PaymentResult {
  payment_id: string;
  status: "pending" | "succeeded" | "canceled";
  confirmation_url?: string;
}

// TODO: Replace with real backend call to create YooKassa payment
export async function createPayment(intent: DonationIntent): Promise<PaymentResult> {
  console.log("[DonationService] Creating payment:", intent);
  // TODO: POST to /api/payments/create
  // TODO: Body: { amount, currency, description, donor_name, donor_email, donor_phone }
  // TODO: Backend calls YooKassa API: https://yookassa.ru/developers/api
  return { payment_id: "", status: "pending" };
}

// TODO: Redirect user to YooKassa payment page
export async function redirectToYooKassa(confirmationUrl: string): Promise<void> {
  console.log("[DonationService] Redirecting to YooKassa:", confirmationUrl);
  // TODO: window.location.href = confirmationUrl;
}

// TODO: Handle return from YooKassa payment page
export async function handlePaymentReturn(paymentId: string): Promise<PaymentResult> {
  console.log("[DonationService] Handling payment return:", paymentId);
  // TODO: GET /api/payments/status?payment_id=paymentId
  // TODO: Check payment status and update UI
  return { payment_id: paymentId, status: "pending" };
}

// TODO: Check payment status (polling or webhook-driven)
export async function handlePaymentStatus(paymentId: string): Promise<PaymentResult> {
  console.log("[DonationService] Checking payment status:", paymentId);
  // TODO: GET /api/payments/status?payment_id=paymentId
  return { payment_id: paymentId, status: "pending" };
}
