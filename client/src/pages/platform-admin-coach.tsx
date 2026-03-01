import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, Calendar, DollarSign, Eye, Crown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PLAN_LABELS: Record<string, string> = {
  free: "Free (up to 5 clients)",
  starter: "Starter (up to 10 clients) — £1.99/mo",
  professional: "Professional (up to 20 clients) — £4.99/mo",
  business: "Business (up to 50 clients) — £7.99/mo",
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
      const res = await fetch(`/api/platform-admin/coaches/${coachId}`);
      if (!res.ok) throw new Error("Failed to fetch coach");
      return res.json();
    },
    enabled: !!coachId,
  });

  const { data: authUser } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      await apiRequest("PATCH", `/api/platform-admin/coaches/${coachId}/plan`, { plan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/coaches", coachId] });
      toast({ title: "Plan updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
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
        <p className="text-destructive font-medium">Coach not found or access denied</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/platform-admin")}>
          Back to Admin
        </Button>
      </div>
    );
  }

  const { coach, clients, stats, plan } = data;
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
          <Button
            onClick={() => impersonateMutation.mutate()}
            disabled={impersonateMutation.isPending || isCurrentlyImpersonating}
            variant="outline"
            data-testid="button-impersonate"
          >
            <Eye className="h-4 w-4 mr-2" />
            {isCurrentlyImpersonating ? "Currently Impersonating" : "View as Coach"}
          </Button>
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
          <div className="flex items-center gap-4">
            <Select
              value={plan || "free"}
              onValueChange={(val) => planMutation.mutate(val)}
              disabled={planMutation.isPending}
            >
              <SelectTrigger className="max-w-sm" data-testid="select-coach-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free (up to 5 clients)</SelectItem>
                <SelectItem value="starter">Starter — up to 10 clients (£1.99/mo)</SelectItem>
                <SelectItem value="professional">Professional — up to 20 clients (£4.99/mo)</SelectItem>
                <SelectItem value="business">Business — up to 50 clients (£7.99/mo)</SelectItem>
              </SelectContent>
            </Select>
            {planMutation.isPending && (
              <span className="text-sm text-muted-foreground">Saving...</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Manually update a coach's subscription tier after they've completed payment.
          </p>
        </CardContent>
      </Card>

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
            <span>{coach.email || "—"}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Name</span>
            <span>
              {coach.firstName || coach.lastName
                ? `${coach.firstName || ""} ${coach.lastName || ""}`.trim()
                : "—"}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Joined</span>
            <span>{coach.createdAt ? format(new Date(coach.createdAt), "dd/MM/yyyy") : "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
