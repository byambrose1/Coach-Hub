import { useState, useEffect } from "react";
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
  addWeeks,
  subWeeks,
  subDays,
  eachDayOfInterval,
} from "date-fns";
import type { Session, Client, Settings } from "@shared/schema";

type CalView = "month" | "week" | "day";

function NewSessionDialog({ open, onOpenChange, clients, preselectedDate, preselectedTime }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  preselectedDate?: string;
  preselectedTime?: string;
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

  // Sync date and time whenever the dialog opens or preselected values change
  useEffect(() => {
    if (open) {
      const newDate = preselectedDate || format(new Date(), "yyyy-MM-dd");
      const updates: Partial<typeof formData> = { date: newDate };
      if (preselectedTime) {
        const [h, m] = preselectedTime.split(":").map(Number);
        const endH = (h + 1) % 24;
        updates.startTime = preselectedTime;
        updates.endTime = `${endH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      }
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [open, preselectedDate, preselectedTime]);

  const handleStartTimeChange = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    const endH = (h + 1) % 24;
    const endTime = `${endH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    setFormData({ ...formData, startTime: value, endTime });
  };

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
                onChange={(e) => handleStartTimeChange(e.target.value)}
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={formData.endTime}
                min={formData.startTime}
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

function DayDetailDialog({ date, sessions, clientMap, onClose, onAddSession, updateStatus, cancellationNoticeHours }: {
  date: Date;
  sessions: Session[];
  clientMap: Map<string, string>;
  onClose: () => void;
  onAddSession: (date: string) => void;
  updateStatus: (args: { id: string; status: string; deductSession?: boolean }) => void;
  cancellationNoticeHours: number;
}) {
  const [cancellingSession, setCancellingSession] = useState<Session | null>(null);
  const [deductSession, setDeductSession] = useState(true);

  const getLateCancelType = (session: Session): "past" | "within_window" | null => {
    const sessionDateTime = new Date(`${session.date}T${session.startTime}:00`);
    const hoursUntil = (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 0) return "past"; // session time has already passed
    if (hoursUntil < cancellationNoticeHours) return "within_window"; // upcoming but within notice period
    return null; // far enough in future, no late cancel concern
  };

  const handleCancelClick = (session: Session) => {
    setCancellingSession(session);
    // Default to deducting for late cancellations (client should be charged)
    setDeductSession(getLateCancelType(session) !== null);
  };

  const handleConfirmCancel = () => {
    if (!cancellingSession) return;
    updateStatus({ id: cancellingSession.id, status: "cancelled", deductSession });
    setCancellingSession(null);
  };

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
          <DialogTitle>{format(date, "EEEE, d MMMM yyyy")}</DialogTitle>
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
                          onClick={() => handleCancelClick(session)}
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

        {cancellingSession && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 space-y-3 mt-2">
            <p className="text-sm font-medium">Cancel session with {clientMap.get(cancellingSession.clientId) || "client"}?</p>
            <p className="text-xs text-muted-foreground">{cancellingSession.startTime} – {cancellingSession.endTime}</p>

            {(() => {
              const lateType = getLateCancelType(cancellingSession);
              if (!lateType) return null;
              return (
                <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                    {lateType === "past"
                      ? "This session has already taken place."
                      : `This is within your ${cancellationNoticeHours}-hour cancellation window.`}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    {lateType === "past"
                      ? "The client cancelled after the session time. Do you want to still count this session (charge the slot) or return it to their package?"
                      : "The client cancelled late. Do you want to still charge this session or return it to their package?"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={deductSession ? "default" : "outline"}
                      onClick={() => setDeductSession(true)}
                      data-testid="button-deduct-yes"
                    >
                      Count it (charge)
                    </Button>
                    <Button
                      size="sm"
                      variant={!deductSession ? "default" : "outline"}
                      onClick={() => setDeductSession(false)}
                      data-testid="button-deduct-no"
                    >
                      Return to package
                    </Button>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancel}
                data-testid="button-confirm-cancel-session"
              >
                Confirm Cancellation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancellingSession(null)}
                data-testid="button-abort-cancel-session"
              >
                Keep Session
              </Button>
            </div>
          </div>
        )}

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

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

function SessionBlock({ session, clientMap, typeColors, onClick }: {
  session: Session;
  clientMap: Map<string, string>;
  typeColors: Record<string, string>;
  onClick?: () => void;
}) {
  const colorClass = session.status === "completed"
    ? "bg-muted text-muted-foreground"
    : typeColors[session.sessionType || "1:1"] || typeColors["1:1"];

  return (
    <div
      className={`text-xs px-2 py-1.5 rounded-md cursor-pointer ${colorClass}`}
      onClick={onClick}
      data-testid={`session-block-${session.id}`}
    >
      <div className="font-medium truncate">{clientMap.get(session.clientId)?.split(" ")[0] || "Unknown"}</div>
      <div className="opacity-80 flex items-center gap-1">
        <Clock className="w-3 h-3 flex-shrink-0" />
        {session.startTime} - {session.endTime}
      </div>
      {session.location && (
        <div className="opacity-70 flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {session.location}
        </div>
      )}
    </div>
  );
}

export default function Schedule() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [currentDay, setCurrentDay] = useState(() => new Date());
  const [calView, setCalView] = useState<CalView>("month");
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined);
  const [detailDate, setDetailDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const cancellationNoticeHours = settings?.cancellationNoticeHours ?? 24;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, deductSession }: { id: string; status: string; deductSession?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}`, { status, deductSession });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
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

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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

  const handleNewSession = (date?: string, time?: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setNewSessionOpen(true);
  };

  const navigatePrev = () => {
    if (calView === "month") setCurrentMonth(subMonths(currentMonth, 1));
    else if (calView === "week") setCurrentWeek(subWeeks(currentWeek, 1));
    else setCurrentDay(subDays(currentDay, 1));
  };

  const navigateNext = () => {
    if (calView === "month") setCurrentMonth(addMonths(currentMonth, 1));
    else if (calView === "week") setCurrentWeek(addWeeks(currentWeek, 1));
    else setCurrentDay(addDays(currentDay, 1));
  };

  const navigateToday = () => {
    const now = new Date();
    if (calView === "month") setCurrentMonth(now);
    else if (calView === "week") setCurrentWeek(now);
    else setCurrentDay(now);
  };

  const showTodayButton = () => {
    if (calView === "month") return !isSameMonth(currentMonth, new Date());
    if (calView === "week") {
      const nowWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      return !isSameDay(weekStart, nowWeekStart);
    }
    return !isToday(currentDay);
  };

  const headerLabel = () => {
    if (calView === "month") return format(currentMonth, "MMMM yyyy");
    if (calView === "week") {
      const ws = format(weekStart, "d MMM");
      const we = format(weekEnd, "d MMM yyyy");
      return `${ws} - ${we}`;
    }
    return format(currentDay, "EEEE, d MMMM yyyy");
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
        <Button
          onClick={() => {
            const dateForView = calView === "day"
              ? format(currentDay, "yyyy-MM-dd")
              : calView === "week"
              ? format(currentWeek, "yyyy-MM-dd")
              : undefined;
            handleNewSession(dateForView);
          }}
          data-testid="button-new-session"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Session
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1">
        {(["month", "week", "day"] as CalView[]).map((v) => (
          <Button
            key={v}
            variant={calView === v ? "default" : "outline"}
            size="sm"
            onClick={() => setCalView(v)}
            data-testid={`button-view-${v}`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={navigatePrev} data-testid="button-prev-month">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <span className="text-lg font-semibold" data-testid="text-current-month">
            {headerLabel()}
          </span>
          {showTodayButton() && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 text-xs underline"
              onClick={navigateToday}
              data-testid="button-today"
            >
              Today
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={navigateNext} data-testid="button-next-month">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {calView === "month" && (
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
                    onClick={() => { setCurrentDay(calDay); setCalView("day"); }}
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
      )}

      {calView === "week" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[700px]">
              {weekDays.map((wd) => {
                const today = isToday(wd);
                return (
                  <div key={format(wd, "yyyy-MM-dd")} className={`p-2 text-center text-xs font-medium border-b ${today ? "bg-primary/10" : ""}`}>
                    <div className="text-muted-foreground">{format(wd, "EEE")}</div>
                    <div className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-semibold ${today ? "bg-primary text-primary-foreground" : ""}`}>
                      {format(wd, "d")}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{format(wd, "dd/MM")}</div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 min-w-[700px]">
              {weekDays.map((wd) => {
                const dateStr = format(wd, "yyyy-MM-dd");
                const daySessions = sessions
                  .filter((s) => s.date === dateStr && s.status !== "cancelled")
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const today = isToday(wd);

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[300px] border-r p-1.5 space-y-1 cursor-pointer transition-colors hover:bg-accent/50 ${today ? "bg-primary/5" : ""}`}
                    onClick={() => { setCurrentDay(wd); setCalView("day"); }}
                    data-testid={`week-day-${dateStr}`}
                  >
                    {daySessions.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center pt-4">No sessions</p>
                    )}
                    {daySessions.map((session) => (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        clientMap={clientMap}
                        typeColors={typeColors}
                        onClick={() => { setCurrentDay(wd); setCalView("day"); }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {calView === "day" && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {HOURS.map((hour) => {
                const hourStr = hour.toString().padStart(2, "0");
                const dateStr = format(currentDay, "yyyy-MM-dd");
                const hourSessions = sessions.filter((s) => {
                  if (s.date !== dateStr || s.status === "cancelled") return false;
                  const startHour = parseInt(s.startTime.split(":")[0], 10);
                  return startHour === hour;
                }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                return (
                  <div
                    key={hour}
                    className="flex min-h-[60px] cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      if (hourSessions.length > 0) {
                        setDetailDate(currentDay);
                      } else {
                        handleNewSession(dateStr, `${hourStr}:00`);
                      }
                    }}
                    data-testid={`day-hour-${hourStr}`}
                  >
                    <div className="w-16 flex-shrink-0 p-2 text-xs text-muted-foreground text-right border-r">
                      {`${hourStr}:00`}
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      {hourSessions.map((session) => (
                        <SessionBlock
                          key={session.id}
                          session={session}
                          clientMap={clientMap}
                          typeColors={typeColors}
                          onClick={() => setDetailDate(currentDay)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
        preselectedTime={selectedTime}
      />

      {detailDate && (
        <DayDetailDialog
          date={detailDate}
          sessions={sessions}
          clientMap={clientMap}
          onClose={() => setDetailDate(null)}
          onAddSession={handleNewSession}
          updateStatus={(args) => updateStatus.mutate(args)}
          cancellationNoticeHours={cancellationNoticeHours}
        />
      )}
    </div>
  );
}
