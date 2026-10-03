import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Clipboard, FilePlus2, Link2, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import type { ClientForm } from "@shared/schema";
import type { CustomQuestion, FormAnswers, FormRequest, FormTemplate, TemplateInput } from "@shared/custom-forms";
import { validateFormAnswers } from "@shared/custom-forms";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const emptyTemplate = (): TemplateInput => ({ title: "", description: "", questions: [] });
const newQuestion = (): CustomQuestion => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  type: "text",
  required: false,
});

export function FormAnswerFields({ questions, answers, onChange, questionNumberOffset = 0 }: {
  questions: CustomQuestion[];
  answers: FormAnswers;
  onChange: (id: string, value: string | string[]) => void;
  questionNumberOffset?: number;
}) {
  return <div className="space-y-5">
    {questions.map((question, index) => {
      const value = answers[question.id];
      return <fieldset key={question.id} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{questionNumberOffset + index + 1}. {question.label}{question.required && <span className="ml-1 text-destructive" aria-label="required">*</span>}</legend>
        {question.type === "text" && <><Label htmlFor={`answer-${question.id}`} className="sr-only">Answer for {question.label}</Label><Input id={`answer-${question.id}`} value={typeof value === "string" ? value : ""} required={question.required} maxLength={4000} onChange={event => onChange(question.id, event.target.value)} /></>}
        {question.type === "textarea" && <><Label htmlFor={`answer-${question.id}`} className="sr-only">Answer for {question.label}</Label><Textarea id={`answer-${question.id}`} value={typeof value === "string" ? value : ""} required={question.required} maxLength={4000} rows={3} onChange={event => onChange(question.id, event.target.value)} /></>}
        {question.type === "yes_no" && <div className="flex gap-2">{["Yes", "No"].map(choice => <Button key={choice} type="button" variant={value === choice ? "secondary" : "outline"} aria-pressed={value === choice} onClick={() => onChange(question.id, choice)}>{choice}</Button>)}</div>}
        {question.type === "single_choice" && <div className="space-y-2">{(question.options || []).map(choice => <label key={choice} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name={question.id} required={question.required} checked={value === choice} onChange={() => onChange(question.id, choice)} />{choice}</label>)}</div>}
        {question.type === "multiple_choice" && <div className="space-y-2">{(question.options || []).map(choice => {
          const selected = Array.isArray(value) ? value : [];
          return <label key={choice} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={selected.includes(choice)} onCheckedChange={checked => onChange(question.id, checked ? [...selected, choice] : selected.filter(item => item !== choice))} />{choice}</label>;
        })}</div>}
      </fieldset>;
    })}
  </div>;
}

export function CustomFormsPanel({ clientId, clientName, clientForms, onViewForm }: {
  clientId: string;
  clientName: string;
  clientForms: ClientForm[];
  onViewForm: (form: ClientForm) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<FormTemplate | "new" | null>(null);
  const [draft, setDraft] = useState<TemplateInput>(emptyTemplate());
  const [assignTemplate, setAssignTemplate] = useState<FormTemplate | null>(null);
  const [completionRequest, setCompletionRequest] = useState<FormRequest | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [issuedLink, setIssuedLink] = useState<{ url: string; requestId: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FormTemplate | null>(null);

  const templatesQuery = useQuery<FormTemplate[]>({ queryKey: ["/api/form-templates"] });
  const requestsQuery = useQuery<FormRequest[]>({ queryKey: [`/api/form-requests?clientId=${encodeURIComponent(clientId)}`] });
  const templates = templatesQuery.data || [];
  const requests = (requestsQuery.data || []).filter(item => item.clientId === clientId);
  const pending = templatesQuery.isPending || requestsQuery.isPending;
  const loadError = templatesQuery.error || requestsQuery.error;

  const refreshRequests = () => queryClient.invalidateQueries({
    predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/form-requests"),
  });
  const templateMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: TemplateInput }) => {
      const res = await apiRequest(id ? "PATCH" : "POST", id ? `/api/form-templates/${id}` : "/api/form-templates", data);
      return res.json() as Promise<FormTemplate>;
    },
    onSuccess: saved => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      setEditing(null);
      toast({ title: "Form saved", description: saved.title });
    },
    onError: (error: Error) => toast({ title: "Could not save form", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (template: FormTemplate) => { await apiRequest("DELETE", `/api/form-templates/${template.id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] }); setConfirmDelete(null); toast({ title: "Template deleted" }); },
    onError: (error: Error) => toast({ title: "Could not delete template", description: error.message, variant: "destructive" }),
  });
  const assignMutation = useMutation({
    mutationFn: async ({ template, coachAnswers }: { template: FormTemplate; coachAnswers?: FormAnswers }) => {
      if (coachAnswers) validateFormAnswers(template.questions, coachAnswers);
      const templateId = template.id;
      const res = await apiRequest("POST", "/api/form-requests", { templateId, clientId });
      const payload = await res.json() as { request: FormRequest; token: string };
      if (coachAnswers) {
        try {
          await apiRequest("POST", `/api/form-requests/${payload.request.id}/complete`, { answers: coachAnswers });
        } catch (error) {
          setCompletionRequest(payload.request);
          throw error;
        }
      } else {
        setIssuedLink({ url: `${window.location.origin}/f#${payload.token}`, requestId: payload.request.id });
      }
      return payload.request;
    },
    onSuccess: (_request, variables) => {
      refreshRequests();
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setAssignTemplate(null);
      setCompletionRequest(null);
      setAnswers({});
      toast({ title: variables.coachAnswers ? "Responses saved" : "Private link created", description: variables.coachAnswers ? "The completed form is now on the client record." : "Copy this one-time link now. It will not be shown again." });
    },
    onError: (error: Error) => toast({ title: "Could not create form request", description: error.message, variant: "destructive" }),
  });
  const completeMutation = useMutation({
    mutationFn: async ({ requestId, value, questions }: { requestId: string; value: FormAnswers; questions: CustomQuestion[] }) => {
      validateFormAnswers(questions, value);
      const res = await apiRequest("POST", `/api/form-requests/${requestId}/complete`, { answers: value });
      return res.json();
    },
    onSuccess: () => {
      refreshRequests();
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setAssignTemplate(null);
      setCompletionRequest(null);
      setAnswers({});
      toast({ title: "Responses saved", description: "The completed form is now on the client record." });
    },
    onError: (error: Error) => toast({ title: "Could not save responses", description: error.message, variant: "destructive" }),
  });
  const revokeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("POST", `/api/form-requests/${requestId}/revoke`, {});
    },
    onSuccess: () => { refreshRequests(); toast({ title: "Link revoked" }); },
    onError: (error: Error) => toast({ title: "Could not revoke link", description: error.message, variant: "destructive" }),
  });

  const beginEdit = (template: FormTemplate | null) => {
    setDraft(template ? { title: template.title, description: template.description, questions: template.questions.map(question => ({ ...question, options: question.options ? [...question.options] : undefined })) } : emptyTemplate());
    setEditing(template || "new");
  };
  const updateQuestion = (index: number, patch: Partial<CustomQuestion>) => setDraft(current => ({
    ...current,
    questions: current.questions.map((question, currentIndex) => currentIndex === index ? { ...question, ...patch } : question),
  }));
  const moveQuestion = (index: number, delta: number) => setDraft(current => {
    const next = [...current.questions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, questions: next };
  });
  const copyLink = async () => {
    if (!issuedLink) return;
    try {
      await navigator.clipboard.writeText(issuedLink.url);
      toast({ title: "Link copied", description: "The private link is ready to share." });
      setIssuedLink(null);
    } catch {
      toast({ title: "Copy was blocked", description: "Select and copy the link below. Close this panel when finished.", variant: "destructive" });
    }
  };

  return <section className="space-y-4" aria-label="Custom client forms">
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div><CardTitle className="text-base">Custom forms</CardTitle><p className="mt-1 text-sm text-muted-foreground">Build forms for client work beyond PAR-Q. Use a private link or record answers together.</p></div>
        <Button size="sm" variant="outline" onClick={() => beginEdit(null)}><FilePlus2 className="mr-2 h-4 w-4" />New template</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending && <div className="space-y-2" aria-label="Loading custom forms"><div className="h-10 animate-pulse rounded-md bg-muted" /><div className="h-10 animate-pulse rounded-md bg-muted" /></div>}
        {!!loadError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>Custom forms could not be loaded.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => { void templatesQuery.refetch(); void requestsQuery.refetch(); }}>Try again</Button></div>}
        {!pending && !loadError && templates.length === 0 && <div className="rounded-lg border border-dashed p-5 text-center"><p className="font-medium">Start with a form you use often.</p><p className="mt-1 text-sm text-muted-foreground">Add a few questions, then send a link or complete it in session.</p><Button className="mt-3" variant="secondary" onClick={() => beginEdit(null)}><Plus className="mr-2 h-4 w-4" />Create first template</Button></div>}
        {templates.map(template => <div key={template.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="font-medium">{template.title}</p><p className="text-xs text-muted-foreground">{template.questions.length} {template.questions.length === 1 ? "question" : "questions"}{template.description ? ` · ${template.description}` : ""}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAssignTemplate(template)}><Send className="mr-1.5 h-3.5 w-3.5" />Send link</Button>
            <Button size="sm" variant="secondary" onClick={() => {
              setAssignTemplate(template);
              setCompletionRequest({ ...template, id: "", clientId, templateId: template.id, status: "pending", expiresAt: "", completedAt: null, clientFormId: null });
              setAnswers({});
            }}><Clipboard className="mr-1.5 h-3.5 w-3.5" />Enter answers</Button>
            <Button size="sm" variant="outline" onClick={() => beginEdit(template)}>Edit</Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${template.title}`} onClick={() => setConfirmDelete(template)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>)}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Requests and responses</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {requests.length === 0 && !pending && <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">No custom forms have been started for {clientName}.</p>}
        {requests.map(request => <div key={request.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">{request.title}</p><p className="text-xs text-muted-foreground">Link expires {new Date(request.expiresAt).toLocaleDateString()} · {request.questions.length} questions</p></div>
          <div className="flex items-center gap-2">
            <Badge variant={request.status === "completed" ? "secondary" : request.status === "revoked" ? "destructive" : "outline"}>{request.status}</Badge>
            {request.status === "pending" && <>
              <Button size="sm" variant="outline" onClick={() => { setCompletionRequest(request); setAnswers({}); }}><Clipboard className="mr-1.5 h-3.5 w-3.5" />Enter responses</Button>
              <Button size="icon" variant="ghost" aria-label="Revoke link" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(request.id)}><X className="h-4 w-4" /></Button>
            </>}
            {request.status === "completed" && request.clientFormId && <Button size="sm" variant="outline" onClick={() => {
              const form = clientForms.find(item => item.id === request.clientFormId);
              if (form) onViewForm(form);
              else toast({ title: "Completed form", description: "Responses are listed in the forms below." });
            }}>View responses</Button>}
          </div>
        </div>)}
      </CardContent>
    </Card>

    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing === "new" ? "New form template" : "Edit form template"}</DialogTitle><DialogDescription>Keep questions clear and focused. Up to 40 questions per form.</DialogDescription></DialogHeader>
        <form className="space-y-5" onSubmit={event => {
          event.preventDefault();
          const data: TemplateInput = {
            title: draft.title.trim(),
            description: draft.description.trim(),
            questions: draft.questions.map(question => ({
              ...question,
              label: question.label.trim(),
              options: ["single_choice", "multiple_choice"].includes(question.type)
                ? (question.options || []).map(option => option.trim()).filter(Boolean).slice(0, 20)
                : undefined,
            })),
          };
          templateMutation.mutate({ id: editing !== "new" && editing ? editing.id : undefined, data });
        }}>
          <div className="space-y-2"><Label htmlFor="custom-template-title">Form title</Label><Input id="custom-template-title" value={draft.title} maxLength={160} required onChange={event => setDraft({ ...draft, title: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="custom-template-description">Description <span className="text-muted-foreground">(optional)</span></Label><Textarea id="custom-template-description" value={draft.description} maxLength={2000} rows={2} onChange={event => setDraft({ ...draft, description: event.target.value })} /></div>
          <div className="space-y-3">
            {draft.questions.map((question, index) => <div key={question.id} className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question {index + 1}</p><div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Move question up" disabled={index === 0} onClick={() => moveQuestion(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Move question down" disabled={index === draft.questions.length - 1} onClick={() => moveQuestion(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove question" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}><X className="h-4 w-4" /></Button>
              </div></div>
              <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
                <Input value={question.label} required maxLength={300} placeholder="Question wording" aria-label={`Question ${index + 1} wording`} onChange={event => updateQuestion(index, { label: event.target.value })} />
                <Select value={question.type} onValueChange={type => updateQuestion(index, { type: type as CustomQuestion["type"], options: ["single_choice", "multiple_choice"].includes(type) ? question.options || ["Option 1", "Option 2"] : undefined })}>
                  <SelectTrigger aria-label="Question type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short text</SelectItem><SelectItem value="textarea">Long text</SelectItem><SelectItem value="yes_no">Yes / no</SelectItem><SelectItem value="single_choice">Choose one</SelectItem><SelectItem value="multiple_choice">Choose many</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["single_choice", "multiple_choice"].includes(question.type) && <div className="space-y-2"><Label>Options, one per line</Label><Textarea value={(question.options || []).join("\n")} rows={3} onChange={event => updateQuestion(index, { options: event.target.value.split("\n").slice(0, 20) })} /><p className="text-xs text-muted-foreground">Use at least two distinct options.</p></div>}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={question.required} onCheckedChange={checked => updateQuestion(index, { required: !!checked })} />Response required</label>
            </div>)}
            <Button type="button" variant="outline" disabled={draft.questions.length >= 40} onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQuestion()] })}><Plus className="mr-2 h-4 w-4" />Add question</Button>
            {draft.questions.length === 0 && <p className="text-sm text-muted-foreground">A template needs at least one question.</p>}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={templateMutation.isPending || draft.questions.length === 0}>{templateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save template</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!assignTemplate || !!completionRequest} onOpenChange={open => { if (!open) { setAssignTemplate(null); setCompletionRequest(null); setAnswers({}); } }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{completionRequest ? `Enter responses · ${completionRequest.title}` : assignTemplate?.title}</DialogTitle><DialogDescription>{completionRequest ? `Record ${clientName}'s answers in Practably.` : `Choose how ${clientName} will complete this form.`}</DialogDescription></DialogHeader>
        {assignTemplate && !completionRequest && <div className="space-y-3"><Button className="w-full justify-start" onClick={() => assignMutation.mutate({ template: assignTemplate })} disabled={assignMutation.isPending}><Link2 className="mr-2 h-4 w-4" />Create private client link</Button><p className="text-xs leading-relaxed text-muted-foreground">This private link expires after 30 days and allows one submission. Anyone who has the link can submit it, so share it directly with {clientName} and do not forward it.</p></div>}
        {completionRequest && <form className="space-y-5" onSubmit={event => { event.preventDefault(); if (completionRequest.id) completeMutation.mutate({ requestId: completionRequest.id, value: answers, questions: completionRequest.questions }); else if (assignTemplate) assignMutation.mutate({ template: assignTemplate, coachAnswers: answers }); }}>
          {completionRequest.description && <p className="text-sm text-muted-foreground">{completionRequest.description}</p>}
          <FormAnswerFields questions={completionRequest.questions} answers={answers} onChange={(id, value) => setAnswers(current => ({ ...current, [id]: value }))} />
          <DialogFooter><Button type="button" variant="outline" onClick={() => { setAssignTemplate(null); setCompletionRequest(null); }}>Cancel</Button><Button disabled={completeMutation.isPending || assignMutation.isPending}>{(completeMutation.isPending || assignMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save responses</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!issuedLink} onOpenChange={open => { if (!open) setIssuedLink(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Your private form link</DialogTitle><DialogDescription>This link is shown only once. Share it directly with {clientName}; it expires after 30 days and allows one submission.</DialogDescription></DialogHeader>
        <div className="space-y-3"><Input readOnly value={issuedLink?.url || ""} aria-label="Private form link" onFocus={event => event.currentTarget.select()} /><Button className="w-full" onClick={() => void copyLink()}><Clipboard className="mr-2 h-4 w-4" />Copy link and close</Button><Button variant="ghost" className="w-full" onClick={() => setIssuedLink(null)}>Close without copying</Button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmDelete} onOpenChange={open => { if (!open) setConfirmDelete(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Delete this template?</DialogTitle><DialogDescription>“{confirmDelete?.title}” will no longer be available for new requests. Existing requests keep their question snapshot.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmDelete(null)}>Keep template</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>Delete template</Button></DialogFooter></DialogContent>
    </Dialog>
  </section>;
}