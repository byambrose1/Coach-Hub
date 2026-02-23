import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, X, Check } from "lucide-react";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import type { Session, Client } from "@shared/schema";

function NewSessionDialog({ open, onOpenChange, clients, preselectedDate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  preselectedDate?: string;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    title: "",
    date: preselectedDate || format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    sessionType: "1:1",
    location: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/sessions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      onOpenChange(false);
      toast({ title: "Session booked successfully" });
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

  const selectedClient = clients.find((c) => c.id === formData.clientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book New Session</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const title = formData.title || (selectedClient ? `Session with ${selectedClient.name}` : "Training Session");
            mutation.mutate({ ...formData, title });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              placeholder={selectedClient ? `Session with ${selectedClient.name}` : "Training Session"}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              data-testid="input-session-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                data-testid="input-session-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.sessionType} onValueChange={(v) => setFormData({ ...formData, sessionType: v })}>
                <SelectTrigger data-testid="select-session-type">
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
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                data-testid="input-end-time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <Input
              placeholder="e.g. Gym, Park, Zoom link..."
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              data-testid="input-location"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Session notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              data-testid="input-session-notes"
            />
          </div>

          <Button type="submit" className="w-full" disabled={!formData.clientId || mutation.isPending} data-testid="button-submit-session">
            {mutation.isPending ? "Booking..." : "Book Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating session", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = sessionsLoading || clientsLoading;
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const typeColors: Record<string, string> = {
    "1:1": "bg-primary/10 text-primary",
    "group": "bg-chart-2/10 text-chart-2",
    "online": "bg-chart-4/10 text-chart-4",
    "outdoor": "bg-chart-5/10 text-chart-5",
  };

  const handleNewSession = (date?: string) => {
    setSelectedDate(date);
    setNewSessionOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-schedule-title">Schedule</h1>
        <Button onClick={() => handleNewSession()} data-testid="button-new-session">
          <Plus className="w-4 h-4 mr-1" />
          New Session
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))} data-testid="button-prev-week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(days[0], "MMM d")} - {format(days[6], "MMM d, yyyy")}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))} data-testid="button-next-week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const daySessions = sessions
            .filter((s) => s.date === dateStr && s.status !== "cancelled")
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isCurrentDay = isSameDay(day, new Date());

          return (
            <Card key={dateStr} className={isCurrentDay ? "ring-2 ring-primary" : ""}>
              <CardHeader className="p-3 pb-1">
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                    <p className={`text-lg font-bold ${isCurrentDay ? "text-primary" : ""}`}>{format(day, "d")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => handleNewSession(dateStr)}
                    data-testid={`button-add-session-${dateStr}`}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-1">
                {daySessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No sessions</p>
                ) : (
                  <div className="space-y-2">
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        className={`rounded-md p-2 text-xs ${typeColors[session.sessionType || "1:1"] || typeColors["1:1"]}`}
                        data-testid={`card-session-${session.id}`}
                      >
                        <p className="font-medium truncate">{clientMap.get(session.clientId) || "Unknown"}</p>
                        <p className="flex items-center gap-1 mt-0.5 opacity-80">
                          <Clock className="w-3 h-3" />
                          {session.startTime}
                        </p>
                        {session.location && (
                          <p className="flex items-center gap-1 mt-0.5 opacity-80 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {session.location}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          {session.status === "scheduled" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-5 h-5"
                                onClick={() => updateStatus.mutate({ id: session.id, status: "completed" })}
                                data-testid={`button-complete-${session.id}`}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-5 h-5"
                                onClick={() => updateStatus.mutate({ id: session.id, status: "cancelled" })}
                                data-testid={`button-cancel-${session.id}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          {session.status === "completed" && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Done</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <NewSessionDialog
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        clients={clients}
        preselectedDate={selectedDate}
      />
    </div>
  );
}
