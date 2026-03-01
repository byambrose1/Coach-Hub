import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Calendar, FileText, TrendingUp, Activity, ShieldCheck, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { User } from "@shared/schema";

interface PlatformStats {
  totalUsers: number;
  totalClients: number;
  totalSessions: number;
  totalInvoices: number;
  totalRevenue: number;
  newUsersThisMonth: number;
  activeUsersThisMonth: number;
}

function StatCard({ title, value, icon: Icon, sub, color = "blue" }: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformAdmin() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PlatformStats>({
    queryKey: ["/api/platform-admin/stats"],
    retry: false,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/platform-admin/users"],
    retry: false,
    enabled: !!stats,
  });

  const today = format(new Date(), "EEEE, d MMMM yyyy");

  if (statsError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          This area is restricted to the platform owner only.
        </p>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Platform Admin</h1>
          <p className="text-sm text-muted-foreground">{today} · Owner access only</p>
        </div>
      </div>

      {/* Platform Stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Coaches / Users
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Coaches" value={stats?.totalUsers ?? 0} icon={Users} color="blue" sub="registered accounts" />
          <StatCard title="New This Month" value={stats?.newUsersThisMonth ?? 0} icon={Users} color="green" />
          <StatCard title="Active This Month" value={stats?.activeUsersThisMonth ?? 0} icon={Activity} color="purple" sub="with sessions" />
          <StatCard title="Total Clients" value={stats?.totalClients ?? 0} icon={Users} color="amber" sub="across all coaches" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Platform Activity
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="Total Sessions" value={stats?.totalSessions ?? 0} icon={Calendar} color="blue" sub="across all coaches" />
          <StatCard title="Total Invoices" value={stats?.totalInvoices ?? 0} icon={FileText} color="amber" />
          <StatCard
            title="Total Revenue Processed"
            value={`£${(stats?.totalRevenue ?? 0).toFixed(0)}`}
            icon={TrendingUp}
            color="green"
            sub="paid invoices"
          />
        </div>
      </div>

      {/* User List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Registered Coaches ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No registered coaches yet.</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {(user.firstName?.[0] || user.email?.[0] || "C").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName || user.email || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="text-xs font-medium">
                        {user.createdAt
                          ? format(new Date(user.createdAt), "dd/MM/yyyy")
                          : "—"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      Coach
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Auth Provider</span>
            <Badge variant="outline" className="text-xs">Replit Auth (OIDC)</Badge>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Email Provider</span>
            <Badge variant="outline" className="text-xs">Brevo Transactional</Badge>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Payment Provider</span>
            <Badge variant="outline" className="text-xs">GoCardless (Sandbox)</Badge>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Database</span>
            <Badge variant="outline" className="text-xs">PostgreSQL (Drizzle ORM)</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
