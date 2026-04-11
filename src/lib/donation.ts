/**
 * Donation service — prepared for YooKassa integration.
 *
 * Future integration plan:
 * 1. Backend endpoint (Edge Function / API route) creates a payment via YooKassa API
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

// TODO: Replace with real backend call to create YooKassa payment
export async function createDonationIntent(intent: DonationIntent): Promise<{ success: boolean; redirectUrl?: string }> {
  console.log("[DonationService] Creating donation intent:", intent);
  // TODO: POST to /api/donations/create with intent payload
  // TODO: Backend calls YooKassa API: https://yookassa.ru/developers/api
  // TODO: Return confirmation URL or widget token
  return { success: false };
}

// TODO: Open YooKassa payment widget / redirect
export async function openYooKassaWidget(_token: string): Promise<void> {
  // TODO: Initialize YooKassa widget with token
  // TODO: Handle widget events (success, fail, close)
  console.log("[DonationService] YooKassa widget not yet integrated");
}

// TODO: Handle successful payment callback
export async function handlePaymentSuccess(_paymentId: string): Promise<void> {
  // TODO: Verify payment status with backend
  // TODO: Update UI, show thank you screen
  // TODO: Store donation record
  console.log("[DonationService] Payment success handler not yet implemented");
}

// TODO: Handle failed payment callback
export async function handlePaymentFailure(_paymentId: string, _reason?: string): Promise<void> {
  // TODO: Log failure, show user-friendly error
  // TODO: Offer retry or manual payment options
  console.log("[DonationService] Payment failure handler not yet implemented");
}
