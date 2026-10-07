import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionUpgradeButton } from "@/components/subscription-upgrade-button";
import { SubscriptionRefund } from "@/components/subscription-refund";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, User, FileText, CreditCard, Bell, Shield, Trash2, Mail, Phone, MapPin, Receipt, Crown, ArrowUp, ArrowDown, ExternalLink, Check, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Settings } from "@shared/schema";
import { siteConfig } from "@/config/site";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { UpgradeNotice } from "@/components/upgrade-notice";
import type { NotificationUsage } from "@shared/email-notifications";

interface Tier {
  name: string;
  label: string;
  max: number;
  price: string;
}

interface SubscriptionStatus {
  ready: boolean;
  checkoutPaused?: boolean;
  billingCustomerNeedsReconnect?: boolean;
  code?: string;
  message?: string;
  status?: string;
  subscriptionStatus?: string;
}

interface SubscriptionConfirmation {
  verified?: boolean;
  status?: string;
  subscriptionStatus?: string;
  paymentStatus?: string;
  payment_status?: string;
  subscription?: { status?: string };
  message?: string;
}

const PLAN_ORDER = ["free", "starter", "professional", "business"];
const SERVER_MANAGED_SETTINGS_FIELDS = new Set([
  "stripeCustomerId",
  "stripeSubscriptionId",
  "subscriptionPlan",
  "subscriptionStatus",
]);
const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Dublin", label: "Dublin (GMT/IST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "UTC", label: "UTC" },
];

function SubscriptionSection({ settings }: { settings: Settings | undefined }) {
  const { toast } = useToast();
  const currentPlan = settings?.subscriptionPlan || "free";
  const currentTierIndex = PLAN_ORDER.indexOf(currentPlan);
  const canManageBilling = Boolean(
    settings?.stripeSubscriptionId || settings?.stripeCustomerId || currentPlan !== "free",
  );
  const [billingFeedback, setBillingFeedback] = useState<{
    kind: "verifying" | "active" | "unpaid" | "pending" | "failure" | "cancelled";
    message?: string;
  } | null>(null);
  const [refundPending, setRefundPending] = useState(false);
  const handleRefundPendingChange = useCallback((pending: boolean) => {
    setRefundPending(pending);
  }, []);
  const processedCheckoutRef = useRef<string | null>(null);

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<Tier[]>({
    queryKey: ["/api/subscription/tiers"],
    enabled: !!settings,
  });

  const subscriptionStatusQuery = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    enabled: !!settings,
  });
  const billingLinkNeedsReview = subscriptionStatusQuery.data?.code === "BILLING_ACCOUNT_REVIEW_REQUIRED";

  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await fetch("/api/settings/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to change plan");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Plan updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot downgrade", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/subscription/checkout", { plan });
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (err: Error) => {
      toast({ title: "Unable to start checkout", description: err.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/portal", {});
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (err: Error) => {
      toast({ title: "Unable to open billing", description: err.message, variant: "destructive" });
    },
  });

  const confirmationMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", "/api/subscription/confirm", { sessionId });
      return res.json() as Promise<SubscriptionConfirmation>;
    },
    onSuccess: (confirmation) => {
      if (confirmation.verified !== true) {
        setBillingFeedback({
          kind: "failure",
          message: "We couldn't verify this checkout. Check your billing status or manage billing before trying again.",
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/refund"] });
      const status = (
        confirmation.subscription?.status
        ?? confirmation.subscriptionStatus
        ?? confirmation.status
        ?? confirmation.paymentStatus
        ?? confirmation.payment_status
        ?? ""
      ).toLowerCase();

      if (status === "active" || status === "trialing") {
        setBillingFeedback({ kind: "active" });
      } else if (status === "unpaid") {
        setBillingFeedback({
          kind: "unpaid",
          message: "Checkout was verified, but payment is still unpaid. Your plan will update once payment completes.",
        });
      } else if (status === "pending" || status === "incomplete" || status === "processing") {
        setBillingFeedback({
          kind: "pending",
          message: "Checkout was verified and payment is still processing. Your plan will update when it is confirmed.",
        });
      } else {
        setBillingFeedback({
          kind: "failure",
          message: confirmation.message || "Checkout was verified, but the subscription is not active. Please manage billing or contact support.",
        });
      }
    },
    onError: (err: Error) => {
      setBillingFeedback({
        kind: "failure",
        message: `We couldn't verify this checkout. Check your billing status or manage billing before trying again. ${err.message}`,
      });
    },
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const billing = url.searchParams.get("billing");
    if (billing === "cancelled" || billing === "canceled") {
      setBillingFeedback({ kind: "cancelled" });
      url.searchParams.delete("billing");
      url.searchParams.delete("session_id");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      return;
    }
    if (billing !== "success") return;

    const sessionId = url.searchParams.get("session_id");
    url.searchParams.delete("billing");
    url.searchParams.delete("session_id");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    if (!sessionId) {
      setBillingFeedback({
        kind: "failure",
        message: "We couldn't verify this checkout because its session is missing. Check your billing status before trying again.",
      });
      return;
    }
    if (processedCheckoutRef.current === sessionId) return;

    processedCheckoutRef.current = sessionId;
    setBillingFeedback({ kind: "verifying" });
    confirmationMutation.mutate(sessionId);
  }, [confirmationMutation.mutate]);

  const billingOperationPending = planMutation.isPending
    || checkoutMutation.isPending
    || portalMutation.isPending
    || confirmationMutation.isPending;
  const subscriptionMutationPending = billingOperationPending || refundPending;

  if (tiersLoading) {
    return <Card><CardContent className="pt-6 h-32 animate-pulse bg-muted rounded" /></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Subscription Plan</CardTitle>
          </div>
          {canManageBilling && !subscriptionStatusQuery.data?.billingCustomerNeedsReconnect && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 w-full gap-1.5 text-xs sm:min-h-9 sm:w-auto"
              onClick={() => portalMutation.mutate()}
              disabled={subscriptionMutationPending || billingLinkNeedsReview}
            >
              <CreditCard className="h-3 w-3" />
              {portalMutation.isPending ? "Opening..." : "Manage billing"}
            </Button>
          )}
        </div>
        <CardDescription>
          You currently have {clients.length} client{clients.length !== 1 ? "s" : ""}. Upgrade for more capacity, or downgrade if you're within the limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {subscriptionStatusQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Checking billing setup...</p>
        ) : subscriptionStatusQuery.data?.ready === true ? (
          (subscriptionStatusQuery.data.subscriptionStatus || subscriptionStatusQuery.data.status) ? (
            <Badge variant="secondary">
              Billing status: {subscriptionStatusQuery.data.subscriptionStatus || subscriptionStatusQuery.data.status}
            </Badge>
          ) : null
        ) : (
          <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <p>{subscriptionStatusQuery.data?.message || "Billing status could not be verified. Please try again later or contact support."}</p>
            {billingLinkNeedsReview && <a href="/support" className="mt-2 inline-block font-medium underline underline-offset-4">Contact support to reconnect billing</a>}
          </div>
        )}
        {subscriptionStatusQuery.data?.billingCustomerNeedsReconnect && (
          <p className="text-sm text-muted-foreground">Choose Upgrade to set up billing for your first paid plan.</p>
        )}
        {subscriptionStatusQuery.data?.checkoutPaused && (
          <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            New subscription checkouts are temporarily paused while Practably verifies its Stripe account. Existing subscriptions are unchanged.
          </div>
        )}

        <SubscriptionRefund
          enabled={Boolean(settings)}
          disabled={billingOperationPending}
          onPendingChange={handleRefundPendingChange}
        />

        {billingFeedback && (
          <div
            role={billingFeedback.kind === "failure" ? "alert" : "status"}
            className={`rounded-md border p-3 text-sm ${
              billingFeedback.kind === "active"
                ? "border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-200"
                : billingFeedback.kind === "failure"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : billingFeedback.kind === "cancelled"
                    ? "border-border bg-muted/50 text-muted-foreground"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            }`}
          >
            {billingFeedback.kind === "verifying" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying your checkout with Stripe...
              </span>
            ) : billingFeedback.kind === "active" ? (
              "Payment confirmed. Your subscription is active."
            ) : billingFeedback.kind === "cancelled" ? (
              "Checkout was cancelled. If you completed payment in another tab, check billing status before trying again."
            ) : (
              billingFeedback.message
            )}
          </div>
        )}

        {tiers.map((tier, i) => {
          const isCurrent = tier.name === currentPlan;
          const isUpgrade = i > currentTierIndex;
          const isDowngrade = i < currentTierIndex;
          const canDowngrade = isDowngrade && clients.length <= tier.max;
          const blockedDowngrade = isDowngrade && clients.length > tier.max && !settings?.stripeSubscriptionId;

          return (
            <div
              key={tier.name}
              className={`flex flex-col items-stretch gap-3 p-3 rounded-lg border transition-colors sm:flex-row sm:items-center sm:justify-between ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background"
              }`}
              data-testid={`tier-card-${tier.name}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {isCurrent ? (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${isCurrent ? "text-primary" : ""}`}>
                      {tier.label}
                    </span>
                    {isCurrent && <Badge className="text-xs h-4">Current</Badge>}
                    <span className="text-xs text-muted-foreground">
                      Up to {tier.max} clients
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tier.price === "0" ? "Free" : `£${tier.price}/month`}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto sm:flex-shrink-0 [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:min-h-9 sm:[&>button]:w-auto">
                {isCurrent ? (
                  <span className="text-xs text-muted-foreground">{currentPlan === "free" ? "Active" : "Current"}</span>
                ) : isUpgrade ? (
                  <SubscriptionUpgradeButton
                    plan={tier.name}
                    selectedPlan={checkoutMutation.variables}
                    pending={checkoutMutation.isPending}
                    onUpgrade={(plan) => checkoutMutation.mutate(plan)}
                    disabled={
                      subscriptionMutationPending ||
                      subscriptionStatusQuery.data?.ready !== true ||
                      (subscriptionStatusQuery.data?.checkoutPaused === true && !settings?.stripeSubscriptionId)
                    }
                  />
                ) : canDowngrade ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 w-full gap-1.5 text-xs sm:min-h-9 sm:w-auto"
                    onClick={() => settings?.stripeSubscriptionId
                      ? portalMutation.mutate()
                      : planMutation.mutate(tier.name)}
                    disabled={subscriptionMutationPending || billingLinkNeedsReview}
                    data-testid={`button-downgrade-${tier.name}`}
                  >
                    {settings?.stripeSubscriptionId ? <CreditCard className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {portalMutation.isPending
                      ? "Opening..."
                      : settings?.stripeSubscriptionId
                        ? "Change in billing"
                        : "Downgrade"}
                  </Button>
                ) : isDowngrade && settings?.stripeSubscriptionId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 w-full gap-1.5 text-xs sm:min-h-9 sm:w-auto"
                    onClick={() => portalMutation.mutate()}
                    disabled={subscriptionMutationPending || billingLinkNeedsReview}
                  >
                    <CreditCard className="h-3 w-3" />
                    {portalMutation.isPending ? "Opening..." : "Change in billing"}
                  </Button>
                ) : blockedDowngrade ? (
                  <span className="text-xs text-muted-foreground text-right max-w-[120px]">
                    Remove {clients.length - tier.max} client{clients.length - tier.max !== 1 ? "s" : ""} first
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const featureAccess = useFeatureAccess();
  const canEditBusinessDetails = featureAccess.hasFeature("customBusinessDetails");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  const notificationUsageQuery = useQuery<NotificationUsage>({
    queryKey: ["/api/notifications/usage"],
    queryFn: async () => {
      const response = await fetch("/api/notifications/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Could not load notification usage.");
      }
      return response.json();
    },
  });

  const [formData, setFormData] = useState({
    trainerName: "",
    businessName: "",
    trainerEmail: "",
    trainerPhone: "",
    businessAddress: "",
    cancellationPolicy: "",
    cancellationNoticeHours: 24,
    acceptsCash: false,
    acceptsCardMachine: false,
    acceptsBankTransfer: false,
    bankTransferDetails: "",
    acceptsPaypal: false,
    paypalLink: "",
    acceptsStripeLink: false,
    stripePaymentLink: "",
    acceptsOtherPayment: false,
    otherPaymentDetails: "",
    invoicePrefix: "INV",
    lowSessionThreshold: 3,
    enableEmailNotifications: false,
    enableSessionReminders: false,
    reminderHoursBefore: 24,
    hipaaCompliant: false,
    dataRetentionDays: 365,
    termsAccepted: false,
    currency: "£",
    timezone: "Europe/London",
    hasAcceptedTerms: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        trainerName: settings.trainerName || "",
        businessName: settings.businessName || "",
        trainerEmail: settings.trainerEmail || "",
        trainerPhone: settings.trainerPhone || "",
        businessAddress: settings.businessAddress || "",
        cancellationPolicy: settings.cancellationPolicy || "",
        cancellationNoticeHours: settings.cancellationNoticeHours ?? 24,
        acceptsCash: settings.acceptsCash || false,
        acceptsCardMachine: settings.acceptsCardMachine || false,
        acceptsBankTransfer: settings.acceptsBankTransfer || false,
        bankTransferDetails: settings.bankTransferDetails || "",
        acceptsPaypal: settings.acceptsPaypal || false,
        paypalLink: settings.paypalLink || "",
        acceptsStripeLink: settings.acceptsStripeLink || false,
        stripePaymentLink: settings.stripePaymentLink || "",
        acceptsOtherPayment: settings.acceptsOtherPayment || false,
        otherPaymentDetails: settings.otherPaymentDetails || "",
        invoicePrefix: settings.invoicePrefix || "INV",
        lowSessionThreshold: settings.lowSessionThreshold || 3,
        enableEmailNotifications: settings.enableEmailNotifications || false,
        enableSessionReminders: settings.enableSessionReminders || false,
        reminderHoursBefore: settings.reminderHoursBefore || 24,
        hipaaCompliant: settings.hipaaCompliant || false,
        dataRetentionDays: settings.dataRetentionDays || 365,
        termsAccepted: settings.termsAccepted || false,
        currency: settings.currency || "£",
        timezone: settings.timezone || "Europe/London",
        hasAcceptedTerms: settings.hasAcceptedTerms || false,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = Object.fromEntries(
        Object.entries(data).filter(([field]) =>
          !SERVER_MANAGED_SETTINGS_FIELDS.has(field)
          && (canEditBusinessDetails || (field !== "businessName" && field !== "businessAddress"))
        ),
      );
      const res = await apiRequest("PUT", "/api/settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/account");
      return res.json();
    },
    onSuccess: (data: { stripeCancelFailed?: boolean }) => {
      if (data.stripeCancelFailed) {
        toast({
          title: "Account deleted",
          description: "Your data was deleted, but we couldn't confirm your Stripe subscription was cancelled — please check your Stripe billing or contact support.",
        });
      }
      window.location.href = "/api/logout";
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting account", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl sm:p-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl sm:p-6">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => mutation.mutate(formData)} disabled={mutation.isPending} data-testid="button-save-settings">
          <Save className="w-4 h-4 mr-1" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input
                placeholder="Coach Name"
                value={formData.trainerName}
                onChange={(e) => setFormData({ ...formData, trainerName: e.target.value })}
                data-testid="input-trainer-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Name</Label>
              {canEditBusinessDetails ? <Input
                placeholder="e.g. FitCoach Pro"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                data-testid="input-business-name"
              /> : <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" data-testid="text-business-name-readonly">{formData.businessName || "Not set"}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
              <Input
                type="email"
                placeholder="coach@example.com"
                value={formData.trainerEmail}
                onChange={(e) => setFormData({ ...formData, trainerEmail: e.target.value })}
                data-testid="input-trainer-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
              <Input
                placeholder="+1 234 567 890"
                value={formData.trainerPhone}
                onChange={(e) => setFormData({ ...formData, trainerPhone: e.target.value })}
                data-testid="input-trainer-phone"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Business Address</Label>
            {canEditBusinessDetails ? <Input
              placeholder="123 Fitness St, City, State"
              value={formData.businessAddress}
              onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
              data-testid="input-business-address"
            /> : <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" data-testid="text-business-address-readonly">{formData.businessAddress || "Not set"}</p>}
          </div>
          {!canEditBusinessDetails && <UpgradeNotice feature="customBusinessDetails" compact />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Cancellation Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notice period required (hours)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={168}
                value={formData.cancellationNoticeHours}
                onChange={(e) => setFormData({ ...formData, cancellationNoticeHours: parseInt(e.target.value) || 24 })}
                className="w-28"
                data-testid="input-cancellation-notice-hours"
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
            <p className="text-xs text-muted-foreground">When a session is cancelled within this window, you'll be prompted to choose whether to deduct the session from the client's package.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Policy wording</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                onClick={() => setFormData({
                  ...formData,
                  cancellationPolicy: `A minimum of ${formData.cancellationNoticeHours} hours' notice is required to cancel or reschedule a session. Cancellations made within ${formData.cancellationNoticeHours} hours of the scheduled start time may result in the session being deducted from your package. We appreciate your understanding and cooperation.`
                })}
                data-testid="button-use-policy-template"
              >
                Use template
              </Button>
            </div>
            <Textarea
              placeholder="Your cancellation policy wording..."
              value={formData.cancellationPolicy}
              onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
              className="min-h-[100px]"
              data-testid="input-cancellation-policy"
            />
            <p className="text-xs text-muted-foreground">Click "Use template" to auto-fill based on your notice period, then customise as needed.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Payment Methods
          </CardTitle>
          <CardDescription>
            Choose how your clients can pay you. These are all your own arrangements — money
            never passes through Practably, we just show clients what you accept and (where you
            give us a link) put a "Pay" button on their invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Cash</Label>
              <p className="text-xs text-muted-foreground">Client pays you in person.</p>
            </div>
            <Switch
              checked={formData.acceptsCash}
              onCheckedChange={(v) => setFormData({ ...formData, acceptsCash: v })}
              data-testid="switch-accepts-cash"
            />
          </div>

          <Separator />

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Card machine</Label>
              <p className="text-xs text-muted-foreground">You take card payment in person with your own terminal.</p>
            </div>
            <Switch
              checked={formData.acceptsCardMachine}
              onCheckedChange={(v) => setFormData({ ...formData, acceptsCardMachine: v })}
              data-testid="switch-accepts-card-machine"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>Bank transfer</Label>
                <p className="text-xs text-muted-foreground">Client pays directly into your bank account.</p>
              </div>
              <Switch
                checked={formData.acceptsBankTransfer}
                onCheckedChange={(v) => setFormData({ ...formData, acceptsBankTransfer: v })}
                data-testid="switch-accepts-bank-transfer"
              />
            </div>
            {formData.acceptsBankTransfer && (
              <Textarea
                placeholder="Account name, sort code, account number, reference instructions..."
                value={formData.bankTransferDetails}
                onChange={(e) => setFormData({ ...formData, bankTransferDetails: e.target.value })}
                className="min-h-[70px]"
                data-testid="input-bank-transfer-details"
              />
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>PayPal</Label>
                <p className="text-xs text-muted-foreground">Add your own PayPal.me link.</p>
              </div>
              <Switch
                checked={formData.acceptsPaypal}
                onCheckedChange={(v) => setFormData({ ...formData, acceptsPaypal: v })}
                data-testid="switch-accepts-paypal"
              />
            </div>
            {formData.acceptsPaypal && (
              <Input
                placeholder="e.g. https://paypal.me/yourname"
                value={formData.paypalLink}
                onChange={(e) => setFormData({ ...formData, paypalLink: e.target.value })}
                data-testid="input-paypal-link"
              />
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>Stripe payment link</Label>
                <p className="text-xs text-muted-foreground">
                  Add a Payment Link from your own Stripe account (create one for free at{" "}
                  <a href="https://dashboard.stripe.com/payment-links" target="_blank" rel="noopener noreferrer" className="break-all underline">
                    dashboard.stripe.com/payment-links
                  </a>
                  ). Payments go straight into your Stripe account, not ours.
                </p>
              </div>
              <Switch
                checked={formData.acceptsStripeLink}
                onCheckedChange={(v) => setFormData({ ...formData, acceptsStripeLink: v })}
                data-testid="switch-accepts-stripe-link"
              />
            </div>
            {formData.acceptsStripeLink && (
              <Input
                placeholder="e.g. https://buy.stripe.com/xxxxx"
                value={formData.stripePaymentLink}
                onChange={(e) => setFormData({ ...formData, stripePaymentLink: e.target.value })}
                data-testid="input-stripe-payment-link"
              />
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>Other</Label>
                <p className="text-xs text-muted-foreground">Any other payment method you accept (e.g. Klarna, another provider).</p>
              </div>
              <Switch
                checked={formData.acceptsOtherPayment}
                onCheckedChange={(v) => setFormData({ ...formData, acceptsOtherPayment: v })}
                data-testid="switch-accepts-other-payment"
              />
            </div>
            {formData.acceptsOtherPayment && (
              <Input
                placeholder="e.g. Klarna - link or instructions"
                value={formData.otherPaymentDetails}
                onChange={(e) => setFormData({ ...formData, otherPaymentDetails: e.target.value })}
                data-testid="input-other-payment-details"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            App Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger className="max-w-[120px]" data-testid="select-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="£">£ GBP</SelectItem>
                <SelectItem value="$">$ USD</SelectItem>
                <SelectItem value="€">€ EUR</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Currency symbol used across the app.</p>
          </div>
          <div className="space-y-2">
            <Label>Business timezone</Label>
            <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
              <SelectTrigger className="max-w-xs" data-testid="select-timezone">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((timezone) => (
                  <SelectItem key={timezone.value} value={timezone.value}>{timezone.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Keep this aligned with the timezone where you run your coaching business.</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Receipt className="w-3 h-3" /> Invoice Number Prefix</Label>
            <Input
              placeholder="INV"
              value={formData.invoicePrefix}
              onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
              className="max-w-[120px]"
              data-testid="input-invoice-prefix"
            />
            <p className="text-xs text-muted-foreground">Prefix for auto-generated invoice numbers (e.g. INV-0001).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </CardTitle>
          <CardDescription>Configure alerts and reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Low Session Alert Threshold</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={formData.lowSessionThreshold}
              onChange={(e) => setFormData({ ...formData, lowSessionThreshold: parseInt(e.target.value) || 3 })}
              className="max-w-[120px]"
              data-testid="input-low-session-threshold"
            />
            <p className="text-xs text-muted-foreground">Show an alert when a block package has this many sessions or fewer. The automatic client email alert is triggered at three remaining sessions.</p>
          </div>

          <Separator />

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="switch-email-notifications">Client email notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Emails go to your clients for bookings, cancellations, reschedules, and low-session alerts.</p>
            </div>
            <Switch
              checked={formData.enableEmailNotifications}
              onCheckedChange={(v) => setFormData({
                ...formData,
                enableEmailNotifications: v,
                ...(v ? {} : { enableSessionReminders: false }),
              })}
              id="switch-email-notifications"
              aria-label="Enable client email notifications"
              data-testid="switch-email-notifications"
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3" aria-live="polite" data-testid="notification-usage">
            {notificationUsageQuery.isLoading ? (
              <div role="status" aria-label="Loading weekly notification usage" className="space-y-2">
                <Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-56" />
                <span className="sr-only">Loading weekly notification usage</span>
              </div>
            ) : notificationUsageQuery.isError ? (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p role="alert" className="text-destructive">Notification usage is unavailable: {notificationUsageQuery.error.message}</p>
                <Button size="sm" variant="outline" onClick={() => notificationUsageQuery.refetch()}>Try again</Button>
              </div>
            ) : notificationUsageQuery.data ? (
              <>
                <p className="text-sm font-medium">
                  {notificationUsageQuery.data.enabled ? "Client email notifications are on" : "Client email notifications are off"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {notificationUsageQuery.data.limit === null
                    ? `${notificationUsageQuery.data.used} used this week · no weekly plan cap${notificationUsageQuery.data.remaining !== null ? ` · ${notificationUsageQuery.data.remaining} remaining` : ""}. Provider limits may still apply.`
                    : `${notificationUsageQuery.data.used} of ${notificationUsageQuery.data.limit} notifications used this week${notificationUsageQuery.data.remaining !== null ? ` · ${notificationUsageQuery.data.remaining} remaining` : ""}.`}
                  {" "}Weekly usage resets Monday at 00:00 UTC ({new Date(notificationUsageQuery.data.resetsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC).
                </p>
                {notificationUsageQuery.data.limit !== null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Weekly email notifications used" aria-valuemin={0} aria-valuemax={notificationUsageQuery.data.limit} aria-valuenow={Math.min(notificationUsageQuery.data.used, notificationUsageQuery.data.limit)}>
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, notificationUsageQuery.data.used / Math.max(1, notificationUsageQuery.data.limit) * 100)}%` }} />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p>Weekly notification usage is not available yet.</p>
                <Button size="sm" variant="outline" onClick={() => notificationUsageQuery.refetch()}>Try again</Button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Session Reminders</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Send one email before each upcoming scheduled session.</p>
            </div>
            <Switch
              checked={formData.enableSessionReminders}
              disabled={!formData.enableEmailNotifications}
              onCheckedChange={(v) => setFormData({ ...formData, enableSessionReminders: v })}
              aria-label="Enable scheduled session reminders"
              data-testid="switch-session-reminders"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="input-reminder-hours">Send reminder</Label>
            <Input
              id="input-reminder-hours"
              type="number"
              min={1}
              max={168}
              step={1}
              value={formData.reminderHoursBefore}
              disabled={!formData.enableEmailNotifications || !formData.enableSessionReminders}
              onChange={(event) => {
                const hours = Number(event.target.value);
                if (Number.isInteger(hours) && hours >= 1 && hours <= 168) {
                  setFormData({ ...formData, reminderHoursBefore: hours });
                }
              }}
              className="w-24"
              aria-label="Hours before session to send reminder"
              data-testid="input-reminder-hours"
            />
            <span className="text-sm text-muted-foreground">hours before the session (1–168)</span>
          </div>
          <p className="text-xs text-muted-foreground">Both client email notifications and session reminders must be enabled. Free-plan reminders count toward the weekly 10-email allowance. Emails are attempted once; inbox delivery depends on the email provider.</p>

        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Privacy controls
          </CardTitle>
          <CardDescription>Review how you collect and manage client information in {siteConfig.name}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border p-4">
            <div>
              <Label>Handling client forms and health information</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Form responses are stored in the relevant client record. Only collect information you need for your practice, limit access, and review your retention policy.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <a href="/privacy" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Read privacy information <ExternalLink className="h-3 w-3" />
              </a>
              <a href="/terms" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Read service terms <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">This guidance is not a certification of legal or regulatory compliance.</p>
          </div>

          <div className="space-y-2">
            <Label>Data Retention (days)</Label>
            <Input
              type="number"
              min={30}
              max={3650}
              value={formData.dataRetentionDays}
              onChange={(e) => setFormData({ ...formData, dataRetentionDays: parseInt(e.target.value) || 365 })}
              className="max-w-[120px]"
              data-testid="input-data-retention"
            />
            <p className="text-xs text-muted-foreground">How long to retain client data after last activity. Default is 365 days.</p>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Terms & Conditions</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings?.hasAcceptedTerms
                  ? "Accepted during the required first sign-in review."
                  : "Not yet accepted. The required review appears on the dashboard."}
              </p>
            </div>
            <Badge variant={settings?.hasAcceptedTerms ? "default" : "secondary"} data-testid="status-terms">
              {settings?.hasAcceptedTerms ? <><Check className="mr-1 h-3 w-3" /> Accepted</> : "Pending"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <SubscriptionSection settings={settings} />
      {featureAccess.hasFeature("customBusinessDetails") && <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Business support</CardTitle><CardDescription>{siteConfig.paidPlanSupportResponse}</CardDescription></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <a className="mt-3 inline-flex font-medium text-primary hover:underline" href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent("Practably Business support request")}`}>Email priority support: {siteConfig.supportEmail}</a>
        </CardContent>
      </Card>}

      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account and all associated data. This cannot be undone.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="min-h-11 w-full sm:min-h-8 sm:w-auto" variant="destructive" size="sm" data-testid="button-delete-account">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. After subscription cancellation is confirmed, your account and client records are removed from the active application database. Export anything you need first. Provider records and infrastructure backups have separate retention arrangements; see the Privacy page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteAccountMutation.isPending}
                    onClick={() => deleteAccountMutation.mutate()}
                    data-testid="button-confirm-delete"
                  >
                    {deleteAccountMutation.isPending ? "Deleting..." : "Yes, delete my account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
