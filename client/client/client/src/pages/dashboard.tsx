import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Users, Clock, AlertTriangle, Plus, ChevronRight, Bell } from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Session, Client, Package } from "@shared/schema";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { trackActivationEvent } from "@/lib/activation";

function QuickBookDialog({ open, onOpenChange, clients }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    sessionType: "1:1",
    location: "",
    notes: "",
  });

  const selectedClient = clients.find((c) => c.id === formData.clientId);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const title = data.title || (selectedClient ? `Session with ${selectedClient.name}` : "Training Session");
      const res = await apiRequest("POST", "/api/sessions", { ...data, title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      onOpenChange(false);
      toast({ title: "Session booked!" });
      trackActivationEvent("first_booking_created");
      setFormData({
        clientId: "",
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        sessionType: "1:1",
        location: "",
        notes: "",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error booking session", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Book Session</DialogTitle>
          <DialogDescription>Book a session without leaving the dashboard.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
              <SelectTrigger data-testid="select-quickbook-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                data-testid="input-quickbook-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.sessionType} onValueChange={(v) => setFormData({ ...formData, sessionType: v })}>
                <SelectTrigger data-testid="select-quickbook-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                data-testid="input-quickbook-start"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                data-testid="input-quickbook-end"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <Input
              placeholder="Gym, Park, Zoom..."
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              data-testid="input-quickbook-location"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Session notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-[60px]"
              data-testid="input-quickbook-notes"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!formData.clientId || mutation.isPending}
            data-testid="button-submit-quickbook"
          >
            {mutation.isPending ? "Booking..." : "Book Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ title, value, icon: Icon, subtitle, href }: { title: string; value: string | number; icon: any; subtitle?: string; href?: string }) {
  const card = (
    <Card className={href ? "cursor-pointer hover-elevate" : ""}>
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

  if (href) {
    return (
      <a href={href} className="block" data-testid="link-stat-active-clients">
        {card}
      </a>
    );
  }

  return card;
}

function SessionRow({ session, clientName }: { session: Session; clientName: string }) {
  const statusColors: Record<string, string> = {
    scheduled: "default",
    completed: "secondary",
    cancelled: "destructive",
    no_show: "outline",
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

function NotifyButton({ packageId }: { packageId: string }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/packages/${packageId}/notify-low-sessions`, {});
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send");
      }
    },
    onSuccess: () => toast({ title: "Notification sent", description: "Client has been emailed about their remaining sessions." }),
    onError: (err: Error) => toast({ title: "Could not send notification", description: err.message, variant: "destructive" }),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs flex-shrink-0"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); mutation.mutate(); }}
      disabled={mutation.isPending || mutation.isSuccess}
      data-testid={`button-notify-${packageId}`}
      title="Email client about low sessions"
    >
      <Bell className="w-3 h-3 mr-1" />
      {mutation.isPending ? "..." : mutation.isSuccess ? "Sent" : "Notify"}
    </Button>
  );
}

export default function Dashboard() {
  const [quickBookOpen, setQuickBookOpen] = useState(false);
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
    (p) => p.status === "active" && (p.totalSessions - (p.usedSessions || 0)) <= 2 && clientMap.has(p.clientId)
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
          <p className="text-muted-foreground text-sm">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
        </div>
        <Button onClick={() => setQuickBookOpen(true)} data-testid="button-quick-book">
          <Plus className="w-4 h-4 mr-1" />
          Quick Book
        </Button>
      </div>

      <OnboardingChecklist />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sessions" value={todaySessions.length} icon={Calendar} subtitle={`${completedToday} completed`} />
        <StatCard title="Active Clients" value={activeClients} icon={Users} href="/clients" />
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
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => setQuickBookOpen(true)}>
                  Book a Session
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
                        : format(parseISO(session.date), "EEE, d MMM");
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
                      <div key={pkg.id} className="flex items-center gap-2 py-2 border-b last:border-b-0" data-testid={`row-low-package-${pkg.id}`}>
                        <a
                          href={`/clients?client=${pkg.clientId}`}
                          className="flex-1 min-w-0 hover:opacity-75 transition-opacity"
                        >
                          <p className="text-sm font-medium truncate">{clientMap.get(pkg.clientId)}</p>
                          <p className="text-xs text-muted-foreground">{pkg.name}</p>
                        </a>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="destructive" className="text-xs">
                            {remaining} sessions left
                          </Badge>
                          <NotifyButton packageId={pkg.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <QuickBookDialog open={quickBookOpen} onOpenChange={setQuickBookOpen} clients={clients} />
    </div>
  );
}
