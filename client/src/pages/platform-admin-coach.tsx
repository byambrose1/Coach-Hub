import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Calendar, DollarSign, Eye, Crown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { permissionMessage } from "@/lib/permission-message";

const PLAN_LABELS: Record<string, string> = {
  free: "Free (up to 5 clients)",
  starter: "Starter (up to 10 clients) - £1.99/mo",
  professional: "Professional (up to 20 clients) - £4.99/mo",
  business: "Business (up to 50 clients) - £7.99/mo",
};

const PLAN_BADGE_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-700",
  starter: "bg-blue-100 text-blue-700",
  professional: "bg-violet-100 text-violet-700",
  business: "bg-amber-100 text-amber-700",
};

export default function PlatformAdminCoach() {
  const [, params] = useRoute("/platform-admin/coaches/:coachId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const coachId = params?.coachId || "";

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/platform-admin/coaches", coachId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/platform-admin/coaches/${coachId}`);
      return res.json();
    },
    enabled: !!coachId,
  });

  const { data: authUser } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { data: role } = useQuery<{ role: "owner" | "support" }>({ queryKey: ["/api/platform-admin/role"] });
  const isOwner = role?.role === "owner";
  const isOwnAccount = authUser?.id === coachId;
  const [expiryDate, setExpiryDate] = useState("");

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      if (!isOwner) throw new Error("Only the verified owner can change billing plans.");
      await apiRequest("PATCH", `/api/platform-admin/coaches/${coachId}/plan`, {
        plan,
        expiresAt: expiryDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/coaches", coachId] });
      toast({ title: "Plan updated successfully" });
      setExpiryDate("");
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
    },
  });

  const markPlanManualMutation = useMutation({
    mutationFn: async () => {
      if (!isOwner) throw new Error("Only the verified owner can mark a plan as manual.");
      await apiRequest("POST", `/api/platform-admin/coaches/${coachId}/mark-plan-manual`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/coaches", coachId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/refund"] });
      toast({
        title: "Manual plan recorded",
        description: "Plan access is unchanged; billing checks now treat this as manual access.",
      });
    },
    onError: () => {
      toast({ title: "Could not mark plan as manual", variant: "destructive" });
    },
  });

  const clearBillingMutation = useMutation({
    mutationFn: async () => {
      if (!isOwner) throw new Error("Only the verified owner can reconnect billing.");
      await apiRequest("POST", `/api/platform-admin/coaches/${coachId}/clear-billing-reference`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/coaches", coachId] });
      toast({ title: "Billing reference cleared", description: "The next upgrade will connect a fresh Stripe customer." });
    },
    onError: () => {
      toast({ title: "Failed to clear billing reference", variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platform-admin/impersonate/${coachId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
      toast({ title: `Now viewing as ${data?.coach?.firstName || "this coach"}`, description: "A banner at the top lets you exit impersonation." });
    },
    onError: () => {
      toast({ title: "Failed to start impersonation", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading coach details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p role="alert" className="text-destructive font-medium">
          {permissionMessage(error, "Access denied: only the owner and authorised account managers can inspect coach accounts.")}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/platform-admin")}>
          Back to Admin
        </Button>
      </div>
    );
  }

  const { coach, clients, stats, plan, planGrantedManually, manualPlanExpiresAt, stripeCustomerId, stripeSubscriptionId } = data;
  const isCurrentlyImpersonating = authUser?.impersonatedUserId === coachId;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/platform-admin")} data-testid="button-back-admin">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {coach.firstName && coach.lastName
              ? `${coach.firstName} ${coach.lastName}`
              : coach.email || "Unknown Coach"}
          </h1>
          <p className="text-sm text-muted-foreground">{coach.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={PLAN_BADGE_COLORS[plan] || "bg-slate-100 text-slate-700"}>
            <Crown className="h-3 w-3 mr-1" />
            {plan || "free"}
          </Badge>
          {!isOwnAccount && (
            <Button
              onClick={() => impersonateMutation.mutate()}
              disabled={impersonateMutation.isPending || isCurrentlyImpersonating}
              variant="outline"
              data-testid="button-impersonate"
            >
              <Eye className="h-4 w-4 mr-2" />
              {isCurrentlyImpersonating ? "Currently Impersonating" : "View as Coach"}
            </Button>
          )}
          {isOwnAccount && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Your account
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalClients}</p>
                <p className="text-sm text-muted-foreground">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">£{stats.totalRevenue.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Revenue Processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Subscription Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Badge className={`${PLAN_BADGE_COLORS[plan] || "bg-slate-100 text-slate-700"} w-fit`}>
              {PLAN_LABELS[plan] || "Free"}
            </Badge>
            {isOwner && (
              <Select
                value={plan || "free"}
                onValueChange={(val) => planMutation.mutate(val)}
                disabled={planMutation.isPending}
              >
                <SelectTrigger className="min-h-11 max-w-sm" data-testid="select-coach-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (up to 5 clients)</SelectItem>
                  <SelectItem value="starter">Starter - up to 10 clients (£1.99/mo)</SelectItem>
                  <SelectItem value="professional">Professional - up to 20 clients (£4.99/mo)</SelectItem>
                  <SelectItem value="business">Business - up to 50 clients (£7.99/mo)</SelectItem>
                </SelectContent>
              </Select>
            )}
            {planMutation.isPending && <span className="text-sm text-muted-foreground">Saving…</span>}
          </div>
          {isOwner && (
            <div className="flex flex-col gap-1.5 max-w-sm">
              <Label htmlFor="plan-expiry" className="text-xs text-muted-foreground">
                Auto-revert to Free on (optional - leave blank for a permanent manual grant)
              </Label>
              <Input
                id="plan-expiry"
                type="date"
                className="min-h-11"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                data-testid="input-plan-expiry"
              />
            </div>
          )}
          {planGrantedManually && (
            <Badge variant="outline" className="w-fit text-xs" data-testid="badge-manual-grant">
              Manually granted{manualPlanExpiresAt ? ` · reverts to Free on ${format(new Date(manualPlanExpiresAt), "dd/MM/yyyy")}` : " · no expiry set"}
            </Badge>
          )}
          {isOwner && plan !== "free" && !planGrantedManually && !stripeSubscriptionId && (
            <div className="space-y-2 rounded-md border border-muted p-3">
              <p className="text-sm text-muted-foreground">
                For an older manual plan change, record it here after confirming this account has never had a successful subscription payment. This leaves the plan and access unchanged.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const confirmed = window.confirm(
                    "Confirm this plan was granted manually and this account has never had a successful subscription payment. The plan and access will stay unchanged."
                  );
                  if (confirmed) markPlanManualMutation.mutate();
                }}
                disabled={markPlanManualMutation.isPending}
                data-testid="button-mark-plan-manual"
              >
                {markPlanManualMutation.isPending ? "Saving…" : "Mark current plan as manually granted"}
              </Button>
            </div>
          )}
          {isOwner && plan !== "free" && !planGrantedManually && stripeSubscriptionId && (
            <p className="text-sm text-muted-foreground">
              A Stripe subscription is linked to this account, so the plan cannot be marked as manual.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Subscription billing is handled through verified checkout. Use the date above only to comp a plan manually (e.g. a free month) - it never charges a card or creates a Stripe subscription."
              : "Account managers can review plan status and help troubleshoot, but cannot change pricing or billing plans."}
          </p>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Billing Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {stripeCustomerId
                ? "This coach has a saved Stripe customer reference. If upgrade/refund/portal actions say it can't be found (e.g. after a Stripe account switch), clear it here - the next real checkout will connect a fresh one. This never affects app access or existing payment history."
                : "No Stripe customer reference saved yet - nothing to clear."}
            </p>
            {stripeCustomerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearBillingMutation.mutate()}
                disabled={clearBillingMutation.isPending}
                data-testid="button-clear-billing-reference"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {clearBillingMutation.isPending ? "Clearing…" : "Clear billing reference"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clients ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No clients yet</p>
          ) : (
            <div className="divide-y">
              {clients.map((client: any) => (
                <div key={client.id} className="py-3 flex items-center justify-between" data-testid={`row-client-${client.id}`}>
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">{client.email || "No email"}</p>
                  </div>
                  <Badge variant={client.status === "active" ? "default" : "secondary"} className="text-xs">
                    {client.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coach Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs">{coach.id}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Email</span>
            <span>{coach.email || "-"}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Name</span>
            <span>
              {coach.firstName || coach.lastName
                ? `${coach.firstName || ""} ${coach.lastName || ""}`.trim()
                : "-"}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Joined</span>
            <span>{coach.createdAt ? format(new Date(coach.createdAt), "dd/MM/yyyy") : "-"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
