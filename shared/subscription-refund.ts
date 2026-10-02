export interface SubscriptionRefundStatus {
  state: "eligible" | "ineligible" | "processing" | "completed" | "failed";
  amount?: number;
  currency?: string;
  paidAt?: string;
  expiresAt?: string;
  subscriptionCancelled?: boolean;
  message?: string;
}