import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import type { Client, Session, SessionNote } from "@shared/schema";

function NewNoteDialog({ open, onOpenChange, clients, sessions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  sessions: Session[];
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    sessionId: "",
    content: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const clientSessions = sessions.filter((s) => s.clientId === formData.clientId);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      onOpenChange(false);
      toast({ title: "Note saved" });
      setFormData({ clientId: "", sessionId: "", content: "", date: format(new Date(), "yyyy-MM-dd") });
    },
    onError: (err: Error) => {
      toast({ title: "Error saving note", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Session Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          const submitData = {
            ...formData,
            sessionId: formData.sessionId === "none" || formData.sessionId === "" ? null : formData.sessionId,
          };
          mutation.mutate(submitData as any);
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v, sessionId: "" })}>
              <SelectTrigger data-testid="select-note-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {formData.clientId && clientSessions.length > 0 && (
            <div className="space-y-2">
              <Label>Link to Session (optional)</Label>
              <Select value={formData.sessionId} onValueChange={(v) => setFormData({ ...formData, sessionId: v })}>
                <SelectTrigger data-testid="select-note-session">
                  <SelectValue placeholder="Select a session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No session</SelectItem>
                  {clientSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.date} · {s.startTime} - {s.sessionType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              data-testid="input-note-date"
            />
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              placeholder="Session notes, progress, exercises, measurements..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="min-h-[120px]"
              required
              data-testid="input-note-content"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!formData.clientId || !formData.content || mutation.isPending} data-testid="button-submit-note">
            {mutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Notes() {
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");

  const { data: notes = [], isLoading: notesLoading } = useQuery<SessionNote[]>({
    queryKey: ["/api/notes"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const isLoading = notesLoading || clientsLoading;
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const filtered = notes
    .filter((n) => {
      if (clientFilter !== "all" && n.clientId !== clientFilter) return false;
      if (search && !n.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-notes-title">Session Notes</h1>
          <p className="text-sm text-muted-foreground">{notes.length} notes</p>
        </div>
        <Button onClick={() => setNewNoteOpen(true)} data-testid="button-add-note">
          <Plus className="w-4 h-4 mr-1" />
          Add Note
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-notes"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-client">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search || clientFilter !== "all" ? "No notes match your filters" : "No session notes yet. Add one to start tracking progress."}
          </p>
          {!search && clientFilter === "all" && (
            <Button variant="secondary" className="mt-4" onClick={() => setNewNoteOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <Card key={note.id} data-testid={`card-note-${note.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(clientMap.get(note.clientId) || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{clientMap.get(note.clientId) || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{note.date}</p>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewNoteDialog open={newNoteOpen} onOpenChange={setNewNoteOpen} clients={clients} sessions={sessions} />
    </div>
  );
}
