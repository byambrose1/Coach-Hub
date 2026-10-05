export type PlanName = "free" | "starter" | "professional" | "business";
export type FeatureName =
  | "emailNotifications"
  | "paymentTracking"
  | "revenueTracking"
  | "broadcastEmails"
  | "invoiceManagement"
  | "advancedRevenue"
  | "customBusinessDetails";

const planRanks: Record<PlanName, number> = {
  free: 0, starter: 1, professional: 2, business: 3,
};

export const featureMinimumPlan: Record<FeatureName, PlanName> = {
  emailNotifications: "free",
  paymentTracking: "starter",
  revenueTracking: "starter",
  broadcastEmails: "professional",
  invoiceManagement: "professional",
  advancedRevenue: "business",
  customBusinessDetails: "business",
};

export const featureLabels: Record<FeatureName, string> = {
  emailNotifications: "Email notifications",
  paymentTracking: "Payment tracking",
  revenueTracking: "Revenue tracking",
  broadcastEmails: "Broadcast client emails",
  invoiceManagement: "Invoice editing and sending",
  advancedRevenue: "Date and client revenue reports",
  customBusinessDetails: "Custom business details",
};

type PlanSettings = { subscriptionPlan?: string | null } | null | undefined;

// Billing synchronization owns this stored value. Never trust a plan supplied
// in a feature request, and never grant a testing/admin exception.
export function getPlan(settings: PlanSettings): PlanName {
  const plan = settings?.subscriptionPlan;
  return plan && Object.hasOwn(planRanks, plan) ? plan as PlanName : "free";
}

export function hasFeature(settings: PlanSettings, feature: FeatureName): boolean {
  return planRanks[getPlan(settings)] >= planRanks[featureMinimumPlan[feature]];
}