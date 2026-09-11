import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Users, Activity, FileText, DollarSign, ShieldAlert,
  Link2, Crown, Search, ExternalLink, Save, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  profileImageUrl?: string;
  createdAt?: string;
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

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PlatformStats>({
    queryKey: ["/api/platform-admin/stats"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/platform-admin/users"],
  });

  const { data: config, isLoading: configLoading } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-admin/config"],
  });

  const { data: roleData } = useQuery<{ role: "owner" | "support" }>({
    queryKey: ["/api/platform-admin/role"],
  });
  const isSupportOnly = roleData?.role === "support";

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

  if (statsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm">This page is restricted to the platform owner.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
    return name.includes(q) || (u.email || "").toLowerCase().includes(q);
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
    <div className="min-h-screen bg-background p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Crown className="h-7 w-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Platform Admin</h1>
          <p className="text-sm text-muted-foreground">
            {isSupportOnly ? "Support access: view only for pricing and billing" : "Owner dashboard"}
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

      {/* Tier Config */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Subscription Tiers & Payment Links
          </h2>
          {!isSupportOnly && configDraft && (
            <Button size="sm" onClick={saveConfig} disabled={configMutation.isPending} data-testid="button-save-config">
              <Save className="h-4 w-4 mr-2" />
              {configMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="pt-5 space-y-6">
            {isSupportOnly && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                View only. Pricing and tier changes require the platform owner.
              </p>
            )}
            {configLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
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
                      disabled={isSupportOnly}
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
                      disabled={isSupportOnly}
                      data-testid={`input-tier${tier}-price`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground invisible">Link</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Payment link (Stripe, GoCardless, etc.)</p>
                    <Input
                      value={(currentConfig as any)[linkField] ?? ""}
                      onChange={e => updateDraft(linkField as keyof PlatformConfig, e.target.value)}
                      className="mt-1"
                      placeholder="https://buy.stripe.com/..."
                      disabled={isSupportOnly}
                      data-testid={`input-tier${tier}-link`}
                    />
                  </div>
                </div>
              ))
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t">
              When a coach hits their client limit, a popup appears with the relevant upgrade payment link. After payment, manually update their plan on the coach detail page.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coaches List */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Registered Coaches</h2>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
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

      {/* System Status */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">System</h2>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            {[
              { label: "Auth Provider", value: "Replit Auth (OIDC)", url: "https://replit.com", status: "operational" },
              { label: "Email Provider", value: "Brevo (transactional)", url: "https://app.brevo.com", status: "operational" },
              { label: "Payment Provider", value: "GoCardless (direct debit)", url: "https://manage.gocardless.com", status: "operational" },
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
    </div>
  );
}
