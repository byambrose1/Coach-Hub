import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Mail, Phone, User, Calendar, FileText, Package, Pencil, Trash2, ClipboardCheck, Check, X, Save, CreditCard, Copy } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Client, Session, Package as PackageType, SessionNote, ClientForm } from "@shared/schema";

function formatDateUK(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

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
          <DialogDescription>Fill in the details to add a new client.</DialogDescription>
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
                placeholder="+44 7700 900000"
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

const PARQ_QUESTIONS = [
  "Has your doctor ever said that you have a heart condition?",
  "Do you feel pain in your chest when you do physical activity?",
  "Have you had chest pain when you were not doing physical activity?",
  "Do you lose your balance because of dizziness?",
  "Do you have a bone or joint problem that could be made worse by exercise?",
  "Is your doctor currently prescribing drugs for your blood pressure or heart condition?",
  "Do you know of any other reason why you should not do physical activity?",
];

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showParqForm, setShowParqForm] = useState(false);
  const [viewingForm, setViewingForm] = useState<ClientForm | null>(null);
  const [editData, setEditData] = useState({
    name: client.name,
    email: client.email || "",
    phone: client.phone || "",
    notes: client.notes || "",
    sessionType: client.sessionType || "1:1",
    status: client.status || "active",
  });
  const [parqAnswers, setParqAnswers] = useState<Record<number, boolean>>({});

  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [mandateLink, setMandateLink] = useState<string | null>(null);
  const [isCreatingMandate, setIsMandateLoading] = useState(false);

  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editPkgTotal, setEditPkgTotal] = useState(0);
  const [editPkgUsed, setEditPkgUsed] = useState(0);

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const currentClient = allClients.find(c => c.id === client.id) || client;

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: packages = [] } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
  });

  const { data: notes = [] } = useQuery<SessionNote[]>({
    queryKey: ["/api/notes"],
  });

  const { data: forms = [] } = useQuery<ClientForm[]>({
    queryKey: ["/api/forms"],
  });

  const clientSessions = sessions.filter((s) => s.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date));
  const clientPackages = packages.filter((p) => p.clientId === client.id);
  const clientNotes = notes.filter((n) => n.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date));
  const clientForms = forms.filter((f) => f.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date));

  const completedCount = clientSessions.filter((s) => s.status === "completed").length;
  const upcomingCount = clientSessions.filter((s) => s.status === "scheduled").length;

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editData) => {
      const res = await apiRequest("PATCH", `/api/clients/${client.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsEditing(false);
      toast({ title: "Client updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating client", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clients/${client.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client deleted" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting client", description: err.message, variant: "destructive" });
    },
  });

  const parqMutation = useMutation({
    mutationFn: async (answers: Record<number, boolean>) => {
      const responses = PARQ_QUESTIONS.map((q, i) => ({
        question: q,
        answer: answers[i] ?? false,
      }));
      const res = await apiRequest("POST", "/api/forms", {
        clientId: client.id,
        formType: "parq",
        title: "PAR-Q Health Screening",
        responses: JSON.stringify(responses),
        date: new Date().toISOString().split("T")[0],
        status: "completed",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setShowParqForm(false);
      setParqAnswers({});
      toast({ title: "PARQ form submitted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error submitting form", description: err.message, variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/notes", {
        clientId: client.id,
        content,
        date: new Date().toISOString().split("T")[0],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNewNoteContent("");
      toast({ title: "Note added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding note", description: err.message, variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, {
        content,
        updatedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setEditingNoteId(null);
      setEditingNoteContent("");
      toast({ title: "Note updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating note", description: err.message, variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setDeletingNoteId(null);
      toast({ title: "Note deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting note", description: err.message, variant: "destructive" });
    },
  });

  const updatePkgMutation = useMutation({
    mutationFn: async ({ id, totalSessions, usedSessions }: { id: string; totalSessions: number; usedSessions: number }) => {
      const res = await apiRequest("PATCH", `/api/packages/${id}`, { totalSessions, usedSessions });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      setEditingPkgId(null);
      toast({ title: "Package updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating package", description: err.message, variant: "destructive" });
    },
  });

  const createMandateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/create-mandate-link", { clientId: client.id });
      return res.json();
    },
    onSuccess: (data) => {
      setMandateLink(data.link);
      toast({ title: "Mandate link created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create link", description: err.message, variant: "destructive" });
    }
  });

  const handleCloseDialog = () => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setShowParqForm(false);
    setViewingForm(null);
    setParqAnswers({});
    setEditData({
      name: currentClient.name,
      email: currentClient.email || "",
      phone: currentClient.phone || "",
      notes: currentClient.notes || "",
      sessionType: currentClient.sessionType || "1:1",
      status: currentClient.status || "active",
    });
    onClose();
  };

  return (
    <>
      <Dialog open={true} onOpenChange={() => handleCloseDialog()}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {currentClient.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-left truncate">{currentClient.name}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditData({
                        name: currentClient.name,
                        email: currentClient.email || "",
                        phone: currentClient.phone || "",
                        notes: currentClient.notes || "",
                        sessionType: currentClient.sessionType || "1:1",
                        status: currentClient.status || "active",
                      });
                      setIsEditing(true);
                    }}
                    data-testid="button-edit-client"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="button-delete-client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{currentClient.sessionType || "1:1"}</Badge>
                  <Badge variant={currentClient.status === "active" ? "default" : "secondary"} className="text-xs">{currentClient.status}</Badge>
                  <Badge variant={currentClient.gocardlessMandateStatus === "active" ? "default" : "secondary"} className="text-xs">
                    Monthly: {currentClient.gocardlessMandateStatus || "inactive"}
                  </Badge>
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">Details for client {currentClient.name}</DialogDescription>
          </DialogHeader>

          {showDeleteConfirm && (
            <div className="rounded-md border border-destructive p-4 space-y-3">
              <p className="text-sm font-medium">Are you sure you want to delete this client?</p>
              <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Client"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {currentClient.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span data-testid="text-client-email">{currentClient.email}</span>
              </div>
            )}
            {currentClient.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span data-testid="text-client-phone">{currentClient.phone}</span>
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

            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => createMandateMutation.mutate()}
                disabled={createMandateMutation.isPending}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {createMandateMutation.isPending ? "Generating Link..." : "Set Up Monthly Payment"}
              </Button>
              {mandateLink && (
                <div className="mt-2 p-2 bg-muted rounded-md flex items-center justify-between gap-2">
                  <p className="text-xs truncate flex-1">{mandateLink}</p>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8"
                    onClick={() => {
                      navigator.clipboard.writeText(mandateLink);
                      toast({ title: "Link copied to clipboard" });
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Tabs defaultValue="sessions" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="sessions" className="flex-1" data-testid="tab-client-sessions">Sessions</TabsTrigger>
              <TabsTrigger value="packages" className="flex-1" data-testid="tab-client-packages">Packages</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1" data-testid="tab-client-notes">Notes</TabsTrigger>
              <TabsTrigger value="forms" className="flex-1" data-testid="tab-client-forms">Forms</TabsTrigger>
            </TabsList>
            <TabsContent value="sessions" className="mt-3 space-y-2">
              {clientSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
              ) : (
                clientSessions.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0">
                    <div>
                      <p className="text-sm font-medium">{formatDateUK(s.date)} · {s.startTime}</p>
                      <p className="text-xs text-muted-foreground">{s.sessionType}{s.location ? ` · ${s.location}` : ""}</p>
                    </div>
                    <Badge variant={s.status === "completed" ? "secondary" : s.status === "cancelled" ? "destructive" : "default"} className="text-xs">
                      {s.status}
                    </Badge>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="packages" className="mt-3 space-y-3">
              {clientPackages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No packages</p>
              ) : (
                clientPackages.map((p) => {
                  const isEditingThis = editingPkgId === p.id;
                  const displayTotal = isEditingThis ? editPkgTotal : p.totalSessions;
                  const displayUsed = isEditingThis ? editPkgUsed : (p.usedSessions || 0);
                  const remaining = displayTotal - displayUsed;
                  const pct = (displayUsed / displayTotal) * 100;
                  return (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.billingType === "monthly" && p.monthlyRate && (
                            <p className="text-xs text-muted-foreground">{p.monthlyRate}/month</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={remaining <= 2 && p.status === "active" ? "destructive" : "secondary"} className="text-xs">
                            {remaining} left
                          </Badge>
                          {!isEditingThis && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7"
                              onClick={() => {
                                setEditingPkgId(p.id);
                                setEditPkgTotal(p.totalSessions);
                                setEditPkgUsed(p.usedSessions || 0);
                              }}
                              data-testid={`button-edit-pkg-${p.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {isEditingThis ? (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Total</Label>
                              <Input
                                type="number"
                                min={1}
                                value={editPkgTotal}
                                onChange={(e) => setEditPkgTotal(parseInt(e.target.value) || 1)}
                                data-testid="input-pkg-total"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Used</Label>
                              <Input
                                type="number"
                                min={0}
                                max={editPkgTotal}
                                value={editPkgUsed}
                                onChange={(e) => setEditPkgUsed(Math.min(parseInt(e.target.value) || 0, editPkgTotal))}
                                data-testid="input-pkg-used"
                              />
                            </div>
                          </div>
                          <div className="rounded-md bg-accent p-2 text-center">
                            <p className="text-xs text-muted-foreground">Remaining: <span className="font-bold text-sm">{remaining}</span></p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => updatePkgMutation.mutate({ id: p.id, totalSessions: editPkgTotal, usedSessions: editPkgUsed })}
                              disabled={updatePkgMutation.isPending}
                              data-testid="button-save-pkg"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              {updatePkgMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingPkgId(null)} data-testid="button-cancel-pkg-edit">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground">{p.usedSessions || 0} / {p.totalSessions} sessions used{p.price ? ` · ${p.price}` : ""}</p>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-3 space-y-3">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="input-new-note"
                />
                <Button
                  size="sm"
                  onClick={() => createNoteMutation.mutate(newNoteContent)}
                  disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {createNoteMutation.isPending ? "Adding..." : "Add Note"}
                </Button>
              </div>

              {clientNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
              ) : (
                clientNotes.map((n) => (
                  <div key={n.id} className="border rounded-md p-3 space-y-2" data-testid={`note-item-${n.id}`}>
                    {deletingNoteId === n.id ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-destructive">Delete this note?</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteNoteMutation.mutate(n.id)}
                            disabled={deleteNoteMutation.isPending}
                            data-testid="button-confirm-delete-note"
                          >
                            {deleteNoteMutation.isPending ? "Deleting..." : "Delete"}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setDeletingNoteId(null)} data-testid="button-cancel-delete-note">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : editingNoteId === n.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          className="min-h-[60px]"
                          data-testid="input-edit-note"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateNoteMutation.mutate({ id: n.id, content: editingNoteContent })}
                            disabled={!editingNoteContent.trim() || updateNoteMutation.isPending}
                            data-testid="button-save-note"
                          >
                            {updateNoteMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => { setEditingNoteId(null); setEditingNoteContent(""); }} data-testid="button-cancel-edit-note">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">{formatDateUK(n.date)}</p>
                            {n.updatedAt && <Badge variant="secondary" className="text-[10px]">edited</Badge>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6"
                              onClick={() => { setEditingNoteId(n.id); setEditingNoteContent(n.content); }}
                              data-testid={`button-edit-note-${n.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6"
                              onClick={() => setDeletingNoteId(n.id)}
                              data-testid={`button-delete-note-${n.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm">{n.content}</p>
                      </>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="forms" className="mt-3 space-y-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setParqAnswers({});
                  setShowParqForm(true);
                }}
                data-testid="button-new-parq-form"
              >
                <ClipboardCheck className="w-4 h-4 mr-1" />
                New PARQ Form
              </Button>
              {clientForms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No forms yet</p>
              ) : (
                clientForms.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 cursor-pointer hover-elevate rounded-md px-2"
                    onClick={() => setViewingForm(f)}
                    data-testid={`form-item-${f.id}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateUK(f.date)} · {f.formType}</p>
                    </div>
                    <Badge variant={f.status === "completed" ? "secondary" : "default"} className="text-xs">
                      {f.status}
                    </Badge>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={(open) => { if (!open) setIsEditing(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate(editData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                required
                data-testid="input-edit-client-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  data-testid="input-edit-client-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  data-testid="input-edit-client-phone"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Session Type</Label>
                <Select value={editData.sessionType} onValueChange={(v) => setEditData({ ...editData, sessionType: v })}>
                  <SelectTrigger data-testid="select-edit-session-type">
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
                <Label>Status</Label>
                <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                data-testid="input-edit-client-notes"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="submit" disabled={!editData.name || updateMutation.isPending} data-testid="button-save-edit">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showParqForm} onOpenChange={(open) => { if (!open) { setShowParqForm(false); setParqAnswers({}); } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PAR-Q Health Screening</DialogTitle>
            <DialogDescription>Please answer the following health screening questions for {currentClient.name}.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              parqMutation.mutate(parqAnswers);
            }}
            className="space-y-4"
          >
            {PARQ_QUESTIONS.map((q, i) => (
              <div key={i} className="space-y-2">
                <p className="text-sm">{i + 1}. {q}</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={parqAnswers[i] === true ? "default" : "secondary"}
                    onClick={() => setParqAnswers({ ...parqAnswers, [i]: true })}
                    data-testid={`button-parq-yes-${i}`}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Yes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={parqAnswers[i] === false ? "default" : "secondary"}
                    onClick={() => setParqAnswers({ ...parqAnswers, [i]: false })}
                    data-testid={`button-parq-no-${i}`}
                  >
                    <X className="w-3 h-3 mr-1" />
                    No
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="submit"
              className="w-full"
              disabled={parqMutation.isPending || Object.keys(parqAnswers).length < PARQ_QUESTIONS.length}
              data-testid="button-submit-parq"
            >
              {parqMutation.isPending ? "Submitting..." : "Submit PARQ Form"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingForm} onOpenChange={(open) => { if (!open) setViewingForm(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingForm?.title}</DialogTitle>
            <DialogDescription>{viewingForm?.date ? formatDateUK(viewingForm.date) : ""} · {viewingForm?.formType}</DialogDescription>
          </DialogHeader>
          {viewingForm && (() => {
            try {
              const responses = JSON.parse(viewingForm.responses) as Array<{ question: string; answer: boolean }>;
              return (
                <div className="space-y-3">
                  {responses.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b last:border-b-0">
                      <Badge variant={r.answer ? "destructive" : "secondary"} className="text-xs flex-shrink-0 mt-0.5">
                        {r.answer ? "Yes" : "No"}
                      </Badge>
                      <p className="text-sm">{r.question}</p>
                    </div>
                  ))}
                </div>
              );
            } catch {
              return <p className="text-sm text-muted-foreground">{viewingForm.responses}</p>;
            }
          })()}
        </DialogContent>
      </Dialog>
    </>
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
