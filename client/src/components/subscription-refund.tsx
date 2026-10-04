import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { SubscriptionRefundStatus } from "@shared/subscription-refund";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RotateCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ApiError } from "@/lib/api-error";

const refundQueryKey = ["/api/subscription/refund"] as const;

async function readRefundStatus(): Promise<SubscriptionRefundStatus> {
  const response = await apiRequest("GET", "/api/subscription/refund");
  return response.json() as Promise<SubscriptionRefundStatus>;
}

async function requestRefund(): Promise<SubscriptionRefundStatus> {
  const response = await apiRequest("POST", "/api/subscription/refund", { confirm: true });
  return response.json() as Promise<SubscriptionRefundStatus>;
}

function formatAmount(amount?: number, currency?: string) {
  if (typeof amount !== "number") return "the full first payment";
  const code = (currency || "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount / 100);
  } catch {
    return `${code} ${(amount / 100).toFixed(2)}`;
  }
}

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function remainingTime(expiresAt: string | undefined, now: number) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return null;
  const remaining = Math.max(0, expiry - now);
  if (remaining === 0) return "The 24-hour refund window has expired.";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${hours}h ${minutes}m ${seconds}s remaining`;
}

export function SubscriptionRefund({
  enabled,
  disabled = false,
  onPendingChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const refundQuery = useQuery<SubscriptionRefundStatus>({
    queryKey: refundQueryKey,
    queryFn: readRefundStatus,
    enabled,
    refetchInterval: (query) => query.state.data?.state === "processing" ? 5_000 : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const refundMutation = useMutation({
    mutationFn: requestRefund,
    onSuccess: (status) => {
      queryClient.setQueryData(refundQueryKey, status);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: refundQueryKey });
    },
    onError: () => {
      // Stripe may have accepted a refund before cancellation or the local
      // settings write failed. Recover the authoritative state for safe retry.
      queryClient.invalidateQueries({ queryKey: refundQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  useEffect(() => {
    onPendingChange?.(refundMutation.isPending || refundQuery.data?.state === "processing");
  }, [refundMutation.isPending, refundQuery.data?.state, onPendingChange]);

  useEffect(() => {
    if (refundQuery.data?.state !== "eligible") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [refundQuery.data?.state]);

  const expiresAt = refundQuery.data?.expiresAt;
  const countdown = useMemo(() => remainingTime(expiresAt, now), [expiresAt, now]);
  const expired = Boolean(expiresAt && countdown === "The 24-hour refund window has expired.");
  const actionDisabled = disabled || refundMutation.isPending;

  if (!enabled) return null;

  const retryStatus = () => {
    refundMutation.reset();
    refundQuery.refetch();
  };
  const startRequest = () => {
    refundMutation.reset();
    refundMutation.mutate();
  };
  const status = refundQuery.data;
  const billingLinkNeedsReview = refundQuery.error instanceof ApiError
    && refundQuery.error.code === "BILLING_ACCOUNT_REVIEW_REQUIRED";
  const amount = formatAmount(status?.amount, status?.currency);
  const paidAt = formatDate(status?.paidAt);
  const localizedExpiry = formatDate(status?.expiresAt);

  return (
    <section className="rounded-lg border bg-muted/20 p-4 space-y-3" aria-labelledby="refund-heading" data-testid="subscription-refund">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="refund-heading" className="text-sm font-semibold">First payment refund</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Refunds are available for the first subscription payment only, within 24 hours of payment.
          </p>
        </div>
        {status?.state === "eligible" && <Badge variant="outline">Eligible</Badge>}
      </div>

      {refundQuery.isLoading ? (
        <div className="h-14 animate-pulse rounded-md bg-muted" aria-label="Checking refund eligibility" data-testid="refund-loading" />
      ) : refundQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert" data-testid="refund-unavailable">
          <p className="font-medium">{billingLinkNeedsReview ? "Billing account needs reconnecting" : "Refund eligibility is unavailable"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{refundQuery.error instanceof Error ? refundQuery.error.message : "Please try again."}</p>
          {billingLinkNeedsReview ? (
            <a href="/support" className="mt-3 inline-block font-medium underline underline-offset-4">Contact support</a>
          ) : <Button type="button" size="sm" variant="outline" className="mt-3 gap-2" onClick={retryStatus} disabled={disabled} data-testid="button-refund-retry-status">
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry check
          </Button>}
        </div>
      ) : status?.state === "eligible" ? (
        <div className="space-y-3" data-testid="refund-state-eligible">
          <div className="rounded-md border border-primary/20 bg-background p-3">
            <p className="text-sm">You can request a full refund of <strong>{amount}</strong>.</p>
            {paidAt && <p className="mt-1 text-xs text-muted-foreground">First payment: {paidAt}</p>}
            {localizedExpiry && <p className="mt-1 text-xs text-muted-foreground">Deadline: {localizedExpiry}</p>}
            {countdown && <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${expired ? "text-destructive" : "text-primary"}`} aria-live="polite">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {countdown}
            </p>}
          </div>
          {refundMutation.isError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert" data-testid="refund-request-error">
              <p className="font-medium">Your refund request was not confirmed.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {refundMutation.error instanceof Error ? refundMutation.error.message : "Please retry or check your status."} No refund completion has been confirmed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={startRequest} disabled={actionDisabled || expired} data-testid="button-refund-retry-request">Retry request</Button>
                <Button type="button" size="sm" variant="ghost" onClick={retryStatus} disabled={disabled} data-testid="button-refund-refresh">Check status</Button>
              </div>
            </div>
          )}
          <Button type="button" onClick={() => setDialogOpen(true)} disabled={actionDisabled || expired} data-testid="button-refund-start">
            {refundMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancel and refund
          </Button>
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refund {amount} and end your subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  This immediately cancels your subscription and returns your account to the Free plan. Your client data will be retained. The refund is sent to your original payment method; your bank may take time to process it. This requests a refund for the first payment only.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-refund-cancel-dialog">Keep subscription</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    setDialogOpen(false);
                    startRequest();
                  }}
                  disabled={actionDisabled || expired}
                  data-testid="button-refund-confirm"
                >
                  Confirm refund and cancellation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : status?.state === "ineligible" ? (
        <div className="rounded-md border bg-background p-3 text-sm" role="status" data-testid="refund-state-ineligible">
          <p className="font-medium">{status.message?.includes("no paid subscription payment") || status.message?.includes("no successful subscription payment") ? "No payment to refund" : "Automatic refund unavailable"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{status.message || "Only the first subscription payment can be refunded within 24 hours."}</p>
        </div>
      ) : status?.state === "processing" ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3" role="status" data-testid="refund-state-processing">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Refund pending
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {status.subscriptionCancelled
              ? "Your subscription is cancelled and your account is returning to the Free plan. The refund is still being processed. Your bank may take time to post it."
              : "The refund is pending. Subscription cancellation is not yet confirmed, so you can retry the cancellation below."}
          </p>
          {status.subscriptionCancelled && <p className="mt-2 text-xs font-medium">Cancellation status: complete. Client data is retained.</p>}
          {!status.subscriptionCancelled && (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={startRequest} disabled={actionDisabled} data-testid="button-refund-retry-cancellation">
              {refundMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Retry cancellation
            </Button>
          )}
          {refundMutation.isError && <p className="mt-2 text-xs text-destructive" role="alert" data-testid="refund-processing-error">
            Cancellation retry failed: {refundMutation.error instanceof Error ? refundMutation.error.message : "Please try again."}
          </p>}
        </div>
      ) : status?.state === "completed" ? (
        <div className="rounded-md border border-green-600/30 bg-green-600/5 p-3" role="status" data-testid="refund-state-completed">
          <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Refund and cancellation confirmed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A refund of {amount} was confirmed. Your subscription is cancelled and your plan is Free. Your client data is retained. Your bank may take time to post the refund to your original payment method.
          </p>
        </div>
      ) : status?.state === "failed" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert" data-testid="refund-state-failed">
          <p className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" aria-hidden="true" /> Refund could not be completed</p>
          <p className="mt-1 text-xs text-muted-foreground">{status.message || "Please contact support for help with this refund. Do not submit another refund request."}</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background p-3 text-sm" role="status" data-testid="refund-state-unknown">
          <p className="text-muted-foreground">Refund status is not available.</p>
          <Button type="button" size="sm" variant="outline" className="mt-3 gap-2" onClick={retryStatus} disabled={disabled} data-testid="button-refund-refresh-unknown">
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Check again
          </Button>
        </div>
      )}
    </section>
  );
}