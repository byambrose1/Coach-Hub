import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, Activity, FileText, DollarSign, ShieldAlert,
  Crown, Search, ExternalLink, Save, ChevronRight, ArrowRight,
  UserPlus, UserRoundCog, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { permissionMessage } from "@/lib/permission-message";

interface PlatformStats {
  totalUsers: number;
  totalClients: number;
  totalSessions: number;
  totalInvoices: number;
  totalRevenue: number;
  newUsersThisMonth: number;
  activeUsersThisMonth: number;
}

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string | null;
  profileImageUrl?: string;
  createdAt?: string;
}

interface PlatformStaff {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  source: "database" | "environment";
}

interface PlatformRole {
  role: "owner" | "support";
}

interface PlatformConfig {
  tier1MaxClients: number;
  tier1Price: string;
  tier1PaymentLink: string;
  tier2MaxClients: number;
  tier2Price: string;
  tier2PaymentLink: string;
  tier3MaxClients: number;
  tier3Price: string;
  tier3PaymentLink: string;
  tier4MaxClients: number;
  tier4Price: string;
  tier4PaymentLink: string;
}

function StatCard({ title, value, icon: Icon, color = "text-primary" }: {
  title: string;
  value: string | number;
  icon: any;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-8 w-8 ${color}`} />
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformAdmin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [configDraft, setConfigDraft] = useState<Partial<PlatformConfig> | null>(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [revokeStaffId, setRevokeStaffId] = useState<string | null>(null);

  const roleQuery = useQuery<PlatformRole>({
    queryKey: ["/api/platform-admin/role"],
  });
  const isOwner = roleQuery.data?.role === "owner";
  const isSupport = roleQuery.data?.role === "support";

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PlatformStats>({
    queryKey: ["/api/platform-admin/stats"],
    enabled: isOwner || isSupport,
  });

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/platform-admin/users"],
    enabled: isOwner || isSupport,
  });

  const { data: config, isLoading: configLoading, error: configError } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-admin/config"],
    enabled: isOwner,
  });
  const staffQuery = useQuery<{ staff: PlatformStaff[] }>({
    queryKey: ["/api/platform-admin/staff"],
    enabled: isOwner,
  });
  const { data: currentUser } = useQuery<{ id: string; email?: string }>({
    queryKey: ["/api/auth/user"],
  });
  const isCurrentOwnerEmail = isOwner && Boolean(currentUser?.email)
    && staffEmail.trim().toLowerCase() === currentUser?.email?.toLowerCase();

  const grantStaffMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/platform-admin/staff", { email });
      return response.json();
    },
    onSuccess: () => {
      setStaffEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/staff"] });
      toast({ title: "Account manager access granted", description: "The existing verified account can now help coaches." });
    },
    onError: (error: Error) => toast({ title: "Could not add account manager", description: error.message, variant: "destructive" }),
  });

  const revokeStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/platform-admin/staff/${encodeURIComponent(userId)}`);
    },
    onSuccess: () => {
      setRevokeStaffId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/staff"] });
      toast({ title: "Account manager access revoked" });
    },
    onError: (error: Error) => toast({ title: "Could not revoke access", description: error.message, variant: "destructive" }),
  });

  const configMutation = useMutation({
    mutationFn: async (data: Partial<PlatformConfig>) => {
      await apiRequest("PUT", "/api/platform-admin/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/config"] });
      setConfigDraft(null);
      toast({ title: "Tier configuration saved" });
    },
    onError: () => {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    },
  });

  if (roleQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Card><CardContent className="pt-6 space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
        </CardContent></Card>
      </div>
    );
  }

  if (roleQuery.error || (!isOwner && !isSupport) || statsError) {
    const message = permissionMessage(
      roleQuery.error || statsError,
      "Only the verified owner and authorised account managers can access Platform Admin.",
    );
    return (
      <div className="min-h-[60dvh] flex items-center justify-center p-4 sm:p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p role="alert" className="text-muted-foreground text-sm">
              Platform Admin is available to the verified owner and authorised account managers. {message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
    return name.includes(q) || (u.email || "").toLowerCase().includes(q) || (u.businessName || "").toLowerCase().includes(q);
  });

  const currentConfig = configDraft || config || {};

  function updateDraft(field: keyof PlatformConfig, value: string | number) {
    setConfigDraft(prev => ({
      ...(prev || config || {}),
      [field]: value,
    }));
  }

  function saveConfig() {
    if (!configDraft) return;
    const merged = { ...config, ...configDraft };
    configMutation.mutate(merged);
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 space-y-6 max-w-5xl mx-auto sm:p-6 sm:space-y-8">
      <div className="flex items-center gap-3">
        <Crown className="h-7 w-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Platform Admin</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Owner workspace · account access and platform controls" : "Account manager · coach account support only"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Platform Overview</h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5 pb-4 h-20 animate-pulse bg-muted rounded" /></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Total Coaches" value={stats?.totalUsers || 0} icon={Users} color="text-blue-500" />
            <StatCard title="New This Month" value={stats?.newUsersThisMonth || 0} icon={Activity} color="text-green-500" />
            <StatCard title="Active Coaches" value={stats?.activeUsersThisMonth || 0} icon={Activity} color="text-violet-500" />
            <StatCard title="Total Clients" value={stats?.totalClients || 0} icon={Users} color="text-orange-500" />
            <StatCard title="Total Sessions" value={stats?.totalSessions || 0} icon={Activity} color="text-cyan-500" />
            <StatCard title="Total Invoices" value={stats?.totalInvoices || 0} icon={FileText} color="text-pink-500" />
            <StatCard title="Platform Revenue" value={`£${(stats?.totalRevenue || 0).toFixed(2)}`} icon={DollarSign} color="text-amber-500" />
          </div>
        )}
      </div>

      {isOwner && (
        <section aria-labelledby="account-managers-title">
          <div className="mb-3">
            <h2 id="account-managers-title" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account managers</h2>
            <p className="mt-1 text-xs text-muted-foreground">Managers can inspect and help coach accounts, but cannot change pricing, billing plans, or add staff.</p>
          </div>
          <Card>
            <CardContent className="space-y-5 pt-5">
              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => {
                event.preventDefault();
                const email = staffEmail.trim();
                if (email && !isCurrentOwnerEmail) grantStaffMutation.mutate(email);
              }}>
                <div className="min-w-0 flex-1">
                  <Label htmlFor="account-manager-email">Existing verified account email</Label>
                  <Input
                    id="account-manager-email"
                    type="email"
                    autoComplete="email"
                    placeholder="person@example.com"
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    required
                    data-testid="input-account-manager-email"
                  />
                </div>
                <Button type="submit" className="min-h-11 self-end" disabled={!staffEmail.trim() || isCurrentOwnerEmail || grantStaffMutation.isPending} data-testid="button-add-account-manager">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {grantStaffMutation.isPending ? "Adding…" : "Add account manager"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Access is granted to an existing verified Practably account. No passwords or sign-in credentials are requested. The owner account cannot be added or revoked.
              </p>
              {isCurrentOwnerEmail && <p role="alert" className="text-xs text-destructive">The owner account cannot be added as an account manager.</p>}
              {staffQuery.isLoading ? (
                <div role="status" aria-label="Loading account managers" className="space-y-2">
                  <div className="h-12 animate-pulse rounded bg-muted" />
                  <div className="h-12 animate-pulse rounded bg-muted" />
                </div>
              ) : staffQuery.isError ? (
                <div className="flex flex-col gap-2 rounded-md border border-destructive/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p role="alert" className="text-destructive">Could not load account managers: {staffQuery.error.message}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => staffQuery.refetch()}>Try again</Button>
                </div>
              ) : staffQuery.data?.staff.length ? (
                <div className="divide-y rounded-md border">
                  {staffQuery.data.staff.map((staff) => (
                    <div key={staff.userId} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-account-manager-${staff.userId}`}>
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserRoundCog className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {[staff.firstName, staff.lastName].filter(Boolean).join(" ") || staff.email}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">{staff.email}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {staff.businessName || "No business name"} · {staff.source === "environment" ? "Legacy environment access" : "Persistent staff grant"}
                          </p>
                          {revokeStaffId === staff.userId && (
                            <div role="alert" className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                              <p>Revoke this account manager’s access? This also removes legacy environment access.</p>
                              <div className="mt-2 flex gap-2">
                                <Button type="button" size="sm" variant="destructive" className="min-h-10" disabled={revokeStaffMutation.isPending} onClick={() => revokeStaffMutation.mutate(staff.userId)}>
                                  {revokeStaffMutation.isPending ? "Revoking…" : "Confirm revoke"}
                                </Button>
                                <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={revokeStaffMutation.isPending} onClick={() => setRevokeStaffId(null)}>Keep access</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {revokeStaffId !== staff.userId && staff.userId !== currentUser?.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 shrink-0 sm:min-h-9"
                          onClick={() => setRevokeStaffId(staff.userId)}
                          data-testid={`button-revoke-account-manager-${staff.userId}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Revoke access
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <p className="text-sm font-medium">No account managers yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Only the verified owner can add or revoke manager access.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Waitlist & Blog: owner-only platform administration */}
      {isOwner && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/platform-admin/waitlist")} data-testid="link-admin-waitlist">
          <CardContent className="pt-5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-violet-500" />
              <div>
                <p className="font-semibold text-sm">Waitlist</p>
                <p className="text-xs text-muted-foreground">See and export waitlist signups</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/platform-admin/blog")} data-testid="link-admin-blog">
          <CardContent className="pt-5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-violet-500" />
              <div>
                <p className="font-semibold text-sm">Blog</p>
                <p className="text-xs text-muted-foreground">Write and publish posts for SEO</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
      )}

      {/* Tier Config */}
      {isOwner && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Subscription Tiers & Payment Links
          </h2>
          {configDraft && (
            <Button size="sm" onClick={saveConfig} disabled={configMutation.isPending} data-testid="button-save-config">
              <Save className="h-4 w-4 mr-2" />
              {configMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="pt-5 space-y-6">
            {configLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
              </div>
            ) : configError ? (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p role="alert" className="text-destructive">Could not load platform billing settings: {configError.message}</p>
                <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/config"] })}>Try again</Button>
              </div>
            ) : (
              [
                { tier: 1, label: "Free", priceField: "tier1Price", maxField: "tier1MaxClients", linkField: "tier1PaymentLink" },
                { tier: 2, label: "Starter", priceField: "tier2Price", maxField: "tier2MaxClients", linkField: "tier2PaymentLink" },
                { tier: 3, label: "Professional", priceField: "tier3Price", maxField: "tier3MaxClients", linkField: "tier3PaymentLink" },
                { tier: 4, label: "Business", priceField: "tier4Price", maxField: "tier4MaxClients", linkField: "tier4PaymentLink" },
              ].map(({ tier, label, priceField, maxField, linkField }) => (
                <div key={tier} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tier {tier} - {label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Max clients</p>
                    <Input
                      type="number"
                      value={(currentConfig as any)[maxField] ?? ""}
                      onChange={e => updateDraft(maxField as keyof PlatformConfig, parseInt(e.target.value) || 0)}
                      className="mt-1"
                      data-testid={`input-tier${tier}-max`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground invisible">Price</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Price (£/month)</p>
                    <Input
                      value={(currentConfig as any)[priceField] ?? ""}
                      onChange={e => updateDraft(priceField as keyof PlatformConfig, e.target.value)}
                      className="mt-1"
                      placeholder="0"
                      data-testid={`input-tier${tier}-price`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground invisible">Link</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Your external payment link</p>
                    <Input
                      value={(currentConfig as any)[linkField] ?? ""}
                      onChange={e => updateDraft(linkField as keyof PlatformConfig, e.target.value)}
                      className="mt-1"
                      placeholder="https://buy.stripe.com/..."
                      data-testid={`input-tier${tier}-link`}
                    />
                  </div>
                </div>
              ))
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Coaches upgrade through verified Stripe checkout. Account plan adjustments change app access only; they do not create subscriptions, change Stripe charges, or confirm payment.
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Coaches List */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Registered Coaches</h2>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or business..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-coaches"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse bg-muted rounded" />)}
              </div>
            ) : usersError ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p role="alert" className="text-sm text-destructive">Could not load coach accounts: {usersError.message}</p>
                <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/users"] })}>Try again</Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? "No coaches match your search" : "No coaches registered yet"}
              </p>
            ) : (
              <div className="divide-y">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 py-3 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/platform-admin/coaches/${user.id}`)}
                    data-testid={`row-coach-${user.id}`}
                  >
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.firstName || user.lastName
                          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                          : user.email || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.businessName || "Business name not included in the account list"}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        Joined {user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy") : "-"}
                      </p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operational links are reserved for the owner workspace. */}
      {isOwner && (
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">System</h2>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            {[
              { label: "Auth Provider", value: "Supabase Auth", url: null, status: "configured" },
              { label: "Email Provider", value: "Brevo (transactional)", url: "https://app.brevo.com", status: "operational" },
              { label: "Subscription billing", value: "Stripe", url: "https://dashboard.stripe.com", status: "configured" },
              { label: "Database", value: "PostgreSQL / Drizzle ORM", url: null, status: "operational" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.value}</p>
                  </div>
                </div>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    data-testid={`link-system-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    Dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">operational</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
