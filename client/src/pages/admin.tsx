import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, FileText, Package, TrendingUp, AlertCircle, CheckCircle, Clock, Shield, Activity } from "lucide-react";
import { format } from "date-fns";
import type { Settings } from "@shared/schema";

interface AdminStats {
  totalClients: number;
  activeClients: number;
  totalSessions: number;
  sessionsThisWeek: number;
  sessionsThisMonth: number;
  totalInvoices: number;
  pendingInvoices: number;
  paidInvoicesThisMonth: number;
  totalRevenue: number;
  monthlyRevenue: number;
  activePackages: number;
  monthlySubscribers: number;
  totalNotes: number;
  totalForms: number;
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

export default function Admin() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "£";
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
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
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Account & Settings Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Business Name</span>
              <span className="text-sm font-medium">{settings?.businessName || settings?.trainerName || "-"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Trainer</span>
              <span className="text-sm font-medium">{settings?.trainerName || "-"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Contact Email</span>
              <span className="text-sm font-medium">{settings?.trainerEmail || "-"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Currency</span>
              <span className="text-sm font-medium">{settings?.currency || "£"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Subscription</span>
              <Badge variant={settings?.subscriptionStatus === "active" ? "default" : "secondary"} className="text-xs">
                {settings?.subscriptionStatus || "free"} · {settings?.subscriptionPlan || "starter"}
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">HIPAA Compliant</span>
              <Badge variant={settings?.hipaaCompliant ? "default" : "secondary"} className="text-xs">
                {settings?.hipaaCompliant ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Email Notifications</span>
              <Badge variant={settings?.enableEmailNotifications ? "default" : "secondary"} className="text-xs">
                {settings?.enableEmailNotifications ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Session Reminders</span>
              <Badge variant={settings?.enableSessionReminders ? "default" : "secondary"} className="text-xs">
                {settings?.enableSessionReminders ? `${settings.reminderHoursBefore}h before` : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Clients
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="Total Clients" value={stats?.totalClients ?? 0} icon={Users} color="blue" />
          <StatCard title="Active Clients" value={stats?.activeClients ?? 0} icon={Activity} color="green" />
          <StatCard title="Monthly Subscribers" value={stats?.monthlySubscribers ?? 0} icon={CheckCircle} color="purple" sub="on monthly billing" />
        </div>
      </div>

      {/* Sessions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Sessions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="Total Sessions" value={stats?.totalSessions ?? 0} icon={Calendar} color="blue" />
          <StatCard title="This Week" value={stats?.sessionsThisWeek ?? 0} icon={Calendar} color="green" />
          <StatCard title="This Month" value={stats?.sessionsThisMonth ?? 0} icon={Calendar} color="amber" />
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Revenue
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={`${currency}${(stats?.totalRevenue ?? 0).toFixed(0)}`}
            icon={TrendingUp}
            color="green"
            sub="all time (paid)"
          />
          <StatCard
            title="This Month"
            value={`${currency}${(stats?.monthlyRevenue ?? 0).toFixed(0)}`}
            icon={TrendingUp}
            color="blue"
          />
          <StatCard
            title="Pending Invoices"
            value={stats?.pendingInvoices ?? 0}
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Paid This Month"
            value={stats?.paidInvoicesThisMonth ?? 0}
            icon={CheckCircle}
            color="green"
          />
        </div>
      </div>

      {/* Data */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Data
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Active Packages" value={stats?.activePackages ?? 0} icon={Package} color="purple" />
          <StatCard title="Total Invoices" value={stats?.totalInvoices ?? 0} icon={FileText} color="blue" />
          <StatCard title="Session Notes" value={stats?.totalNotes ?? 0} icon={FileText} color="amber" />
          <StatCard title="Health Forms" value={stats?.totalForms ?? 0} icon={AlertCircle} color="red" />
        </div>
      </div>

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
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Database</span>
            <Badge variant="outline" className="text-xs">PostgreSQL (Drizzle ORM)</Badge>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Data Retention</span>
            <Badge variant="outline" className="text-xs">{settings?.dataRetentionDays ?? 365} days</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
