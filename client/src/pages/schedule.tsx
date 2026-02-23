import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, X, Check } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
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
          <DialogDescription>Schedule a training session with a client.</DialogDescription>
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

function DayDetailDialog({ date, sessions, clientMap, onClose, onAddSession, updateStatus }: {
  date: Date;
  sessions: Session[];
  clientMap: Map<string, string>;
  onClose: () => void;
  onAddSession: (date: string) => void;
  updateStatus: (args: { id: string; status: string }) => void;
}) {
  const typeColors: Record<string, string> = {
    "1:1": "bg-primary/10 text-primary border-primary/20",
    "group": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    "online": "bg-violet-500/10 text-violet-700 border-violet-500/20",
    "outdoor": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  };

  const dateStr = format(date, "yyyy-MM-dd");
  const daySessions = sessions
    .filter((s) => s.date === dateStr && s.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const cancelledSessions = sessions
    .filter((s) => s.date === dateStr && s.status === "cancelled");

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{format(date, "EEEE, MMMM d, yyyy")}</DialogTitle>
          <DialogDescription>{daySessions.length} session{daySessions.length !== 1 ? "s" : ""} scheduled</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {daySessions.length === 0 && cancelledSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sessions on this day</p>
          ) : (
            daySessions.map((session) => (
              <div
                key={session.id}
                className={`rounded-lg border p-3 ${typeColors[session.sessionType || "1:1"] || typeColors["1:1"]}`}
                data-testid={`detail-session-${session.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{clientMap.get(session.clientId) || "Unknown"}</p>
                    <p className="text-xs mt-1 flex items-center gap-1 opacity-80">
                      <Clock className="w-3 h-3" />
                      {session.startTime} - {session.endTime}
                    </p>
                    {session.location && (
                      <p className="text-xs mt-0.5 flex items-center gap-1 opacity-80">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {session.location}
                      </p>
                    )}
                    <Badge variant="secondary" className="text-[10px] mt-2">{session.sessionType}</Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {session.status === "scheduled" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => updateStatus({ id: session.id, status: "completed" })}
                          data-testid={`button-complete-${session.id}`}
                          title="Mark complete"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => updateStatus({ id: session.id, status: "cancelled" })}
                          data-testid={`button-cancel-${session.id}`}
                          title="Cancel session"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {session.status === "completed" && (
                      <Badge variant="secondary" className="text-xs">Done</Badge>
                    )}
                  </div>
                </div>
                {session.notes && (
                  <p className="text-xs mt-2 opacity-70 border-t pt-2">{session.notes}</p>
                )}
              </div>
            ))
          )}

          {cancelledSessions.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Cancelled ({cancelledSessions.length})</p>
              {cancelledSessions.map((s) => (
                <div key={s.id} className="text-xs text-muted-foreground line-through py-1">
                  {s.startTime} - {clientMap.get(s.clientId) || "Unknown"}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          className="w-full mt-2"
          variant="outline"
          onClick={() => { onClose(); onAddSession(dateStr); }}
          data-testid="button-add-session-day"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Session
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Schedule() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [detailDate, setDetailDate] = useState<Date | null>(null);
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const typeColors: Record<string, string> = {
    "1:1": "bg-primary text-primary-foreground",
    "group": "bg-emerald-500 text-white",
    "online": "bg-violet-500 text-white",
    "outdoor": "bg-amber-500 text-white",
  };

  const typeDotColors: Record<string, string> = {
    "1:1": "bg-primary",
    "group": "bg-emerald-500",
    "online": "bg-violet-500",
    "outdoor": "bg-amber-500",
  };

  const handleNewSession = (date?: string) => {
    setSelectedDate(date);
    setNewSessionOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-schedule-title">Schedule</h1>
        <Button onClick={() => handleNewSession()} data-testid="button-new-session">
          <Plus className="w-4 h-4 mr-1" />
          New Session
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <span className="text-lg font-semibold" data-testid="text-current-month">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          {!isSameMonth(currentMonth, new Date()) && (
            <Button
              variant="link"
              size="sm"
              className="ml-2 text-xs"
              onClick={() => setCurrentMonth(new Date())}
              data-testid="button-today"
            >
              Today
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((calDay, idx) => {
              const dateStr = format(calDay, "yyyy-MM-dd");
              const daySessions = sessions
                .filter((s) => s.date === dateStr && s.status !== "cancelled")
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              const inCurrentMonth = isSameMonth(calDay, currentMonth);
              const today = isToday(calDay);

              return (
                <div
                  key={dateStr}
                  className={`min-h-[80px] md:min-h-[100px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-accent/50 ${
                    !inCurrentMonth ? "bg-muted/30" : ""
                  } ${idx % 7 === 0 ? "border-l" : ""}`}
                  onClick={() => setDetailDate(calDay)}
                  data-testid={`day-cell-${dateStr}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        today ? "bg-primary text-primary-foreground" : !inCurrentMonth ? "text-muted-foreground" : ""
                      }`}
                    >
                      {format(calDay, "d")}
                    </span>
                    {daySessions.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{daySessions.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5 hidden md:block">
                    {daySessions.slice(0, 3).map((session) => (
                      <div
                        key={session.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate ${
                          session.status === "completed"
                            ? "bg-muted text-muted-foreground"
                            : typeColors[session.sessionType || "1:1"] || typeColors["1:1"]
                        }`}
                        data-testid={`cal-session-${session.id}`}
                      >
                        {session.startTime} {clientMap.get(session.clientId)?.split(" ")[0] || ""}
                      </div>
                    ))}
                    {daySessions.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center">+{daySessions.length - 3} more</p>
                    )}
                  </div>

                  <div className="flex gap-0.5 mt-1 md:hidden flex-wrap">
                    {daySessions.slice(0, 4).map((session) => (
                      <div
                        key={session.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          session.status === "completed"
                            ? "bg-muted-foreground/40"
                            : typeDotColors[session.sessionType || "1:1"] || typeDotColors["1:1"]
                        }`}
                      />
                    ))}
                    {daySessions.length > 4 && (
                      <span className="text-[8px] text-muted-foreground">+{daySessions.length - 4}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> 1:1</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Group</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Online</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Outdoor</span>
      </div>

      <NewSessionDialog
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        clients={clients}
        preselectedDate={selectedDate}
      />

      {detailDate && (
        <DayDetailDialog
          date={detailDate}
          sessions={sessions}
          clientMap={clientMap}
          onClose={() => setDetailDate(null)}
          onAddSession={handleNewSession}
          updateStatus={(args) => updateStatus.mutate(args)}
        />
      )}
    </div>
  );
}
