import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, Clock, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import type { Session, Client, Package } from "@shared/schema";

function StatCard({ title, value, icon: Icon, subtitle }: { title: string; value: string | number; icon: any; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-1">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1" data-testid={`text-stat-${title.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionRow({ session, clientName }: { session: Session; clientName: string }) {
  const statusColors: Record<string, string> = {
    scheduled: "default",
    completed: "secondary",
    cancelled: "destructive",
  };

  const typeLabels: Record<string, string> = {
    "1:1": "1:1",
    "group": "Group",
    "online": "Online",
    "outdoor": "Outdoor",
  };

  return (
    <div className="flex items-center justify-between gap-2 py-3 border-b last:border-b-0" data-testid={`row-session-${session.id}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{clientName}</p>
          <p className="text-xs text-muted-foreground">
            {session.startTime} - {session.endTime}
            {session.location && ` · ${session.location}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {typeLabels[session.sessionType || "1:1"] || session.sessionType}
        </Badge>
        <Badge variant={statusColors[session.status || "scheduled"] as any} className="text-xs">
          {session.status}
        </Badge>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const isLoading = sessionsLoading || clientsLoading || packagesLoading;

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const todaySessions = sessions
    .filter((s) => s.date === today && s.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingSessions = sessions
    .filter((s) => s.date > today && s.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  const lowSessionPackages = packages.filter(
    (p) => p.status === "active" && (p.totalSessions - (p.usedSessions || 0)) <= 2
  );

  const activeClients = clients.filter((c) => c.status === "active").length;
  const completedToday = todaySessions.filter((s) => s.status === "completed").length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Button asChild data-testid="button-quick-book">
          <a href="/schedule?new=true">
            <Plus className="w-4 h-4 mr-1" />
            Quick Book
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sessions" value={todaySessions.length} icon={Calendar} subtitle={`${completedToday} completed`} />
        <StatCard title="Active Clients" value={activeClients} icon={Users} />
        <StatCard title="This Week" value={sessions.filter((s) => {
          const d = s.date;
          const now = new Date();
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          return d >= format(start, "yyyy-MM-dd") && d < format(end, "yyyy-MM-dd") && s.status !== "cancelled";
        }).length} icon={Clock} subtitle="sessions" />
        <StatCard title="Low Sessions" value={lowSessionPackages.length} icon={AlertTriangle} subtitle="packages running low" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-1">
              <CardTitle className="text-base">Today's Schedule</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a href="/schedule" data-testid="link-view-schedule">
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {todaySessions.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No sessions scheduled for today</p>
                <Button variant="secondary" size="sm" className="mt-3" asChild>
                  <a href="/schedule?new=true">Book a Session</a>
                </Button>
              </div>
            ) : (
              <div>
                {todaySessions.map((session) => (
                  <SessionRow key={session.id} session={session} clientName={clientMap.get(session.clientId) || "Unknown"} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Sessions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingSessions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No upcoming sessions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingSessions.map((session) => {
                    const dateLabel = isToday(parseISO(session.date))
                      ? "Today"
                      : isTomorrow(parseISO(session.date))
                        ? "Tomorrow"
                        : format(parseISO(session.date), "EEE, MMM d");
                    return (
                      <div key={session.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0" data-testid={`row-upcoming-${session.id}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{clientMap.get(session.clientId) || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{dateLabel} · {session.startTime}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">{session.sessionType}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {lowSessionPackages.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Low Session Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {lowSessionPackages.map((pkg) => {
                    const remaining = pkg.totalSessions - (pkg.usedSessions || 0);
                    return (
                      <div key={pkg.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0" data-testid={`row-low-package-${pkg.id}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{clientMap.get(pkg.clientId) || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{pkg.name}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs flex-shrink-0">
                          {remaining} left
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
