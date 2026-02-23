import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Mail, Phone, User, Calendar, FileText, Package } from "lucide-react";
import type { Client, Session, Package as PackageType, SessionNote } from "@shared/schema";

function NewClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    sessionType: "1:1",
    status: "active",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onOpenChange(false);
      toast({ title: "Client added successfully" });
      setFormData({ name: "", email: "", phone: "", notes: "", sessionType: "1:1", status: "active" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding client", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Client name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-client-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-client-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+1 234 567 890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                data-testid="input-client-phone"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preferred Session Type</Label>
            <Select value={formData.sessionType} onValueChange={(v) => setFormData({ ...formData, sessionType: v })}>
              <SelectTrigger data-testid="select-client-session-type">
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
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any notes about this client..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              data-testid="input-client-notes"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!formData.name || mutation.isPending} data-testid="button-submit-client">
            {mutation.isPending ? "Adding..." : "Add Client"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: packages = [] } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
  });

  const { data: notes = [] } = useQuery<SessionNote[]>({
    queryKey: ["/api/notes"],
  });

  const clientSessions = sessions.filter((s) => s.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date));
  const clientPackages = packages.filter((p) => p.clientId === client.id);
  const clientNotes = notes.filter((n) => n.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date));

  const completedCount = clientSessions.filter((s) => s.status === "completed").length;
  const upcomingCount = clientSessions.filter((s) => s.status === "scheduled").length;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {client.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-left">{client.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{client.sessionType || "1:1"}</Badge>
                <Badge variant={client.status === "active" ? "default" : "secondary"} className="text-xs">{client.status}</Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {client.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-accent p-3 text-center">
              <p className="text-xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="rounded-md bg-accent p-3 text-center">
              <p className="text-xl font-bold">{upcomingCount}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="sessions" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="sessions" className="flex-1" data-testid="tab-client-sessions">Sessions</TabsTrigger>
            <TabsTrigger value="packages" className="flex-1" data-testid="tab-client-packages">Packages</TabsTrigger>
            <TabsTrigger value="notes" className="flex-1" data-testid="tab-client-notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="sessions" className="mt-3 space-y-2">
            {clientSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
            ) : (
              clientSessions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{s.date} · {s.startTime}</p>
                    <p className="text-xs text-muted-foreground">{s.sessionType}{s.location ? ` · ${s.location}` : ""}</p>
                  </div>
                  <Badge variant={s.status === "completed" ? "secondary" : s.status === "cancelled" ? "destructive" : "default"} className="text-xs">
                    {s.status}
                  </Badge>
                </div>
              ))
            )}
          </TabsContent>
          <TabsContent value="packages" className="mt-3 space-y-2">
            {clientPackages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No packages</p>
            ) : (
              clientPackages.map((p) => {
                const remaining = p.totalSessions - (p.usedSessions || 0);
                const pct = ((p.usedSessions || 0) / p.totalSessions) * 100;
                return (
                  <div key={p.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-medium">{p.name}</p>
                      <Badge variant={remaining <= 2 ? "destructive" : "secondary"} className="text-xs">
                        {remaining} left
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.usedSessions || 0} / {p.totalSessions} sessions used{p.price ? ` · ${p.price}` : ""}</p>
                  </div>
                );
              })
            )}
          </TabsContent>
          <TabsContent value="notes" className="mt-3 space-y-2">
            {clientNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
            ) : (
              clientNotes.map((n) => (
                <div key={n.id} className="border-b last:border-b-0 py-2">
                  <p className="text-xs text-muted-foreground">{n.date}</p>
                  <p className="text-sm mt-1">{n.content}</p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function Clients() {
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-clients-title">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} total clients</p>
        </div>
        <Button onClick={() => setNewClientOpen(true)} data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-1" />
          Add Client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-clients"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search ? "No clients match your search" : "No clients yet. Add your first client to get started."}
          </p>
          {!search && (
            <Button variant="secondary" className="mt-4" onClick={() => setNewClientOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Client
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedClient(client)}
              data-testid={`card-client-${client.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {client.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium text-sm truncate">{client.name}</p>
                      <Badge
                        variant={client.status === "active" ? "default" : "secondary"}
                        className="text-xs flex-shrink-0"
                      >
                        {client.status}
                      </Badge>
                    </div>
                    {client.email && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{client.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{client.sessionType || "1:1"}</Badge>
                      {client.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewClientDialog open={newClientOpen} onOpenChange={setNewClientOpen} />
      {selectedClient && <ClientDetail client={selectedClient} onClose={() => setSelectedClient(null)} />}
    </div>
  );
}
