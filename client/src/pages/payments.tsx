import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, cacheSavedRecord } from "@/lib/queryClient";
import { Plus, Package, CreditCard, AlertTriangle, FileText, Clock, CheckCircle, Pencil, Download, Send, PoundSterling, TrendingUp, Users, Calendar } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import type { Client, Package as PackageType, Settings, Invoice } from "@shared/schema";
import { trackActivationEvent } from "@/lib/activation";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { emailNotificationFeedback } from "@/lib/email-notification-feedback";

function formatDateUK(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function NewPackageDialog({ open, onOpenChange, clients, currency, allowMonthly }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  currency: string;
  allowMonthly: boolean;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    totalSessions: 10,
    usedSessions: 0,
    price: "",
    status: "active",
    billingType: "block",
    monthlyRate: "",
    nextBillingDate: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = allowMonthly ? data : { ...data, billingType: "block", monthlyRate: "", nextBillingDate: "" };
      const res = await apiRequest("POST", "/api/packages", payload);
      return res.json();
    },
    onSuccess: async (saved) => {
      await cacheSavedRecord("/api/packages", saved);
      onOpenChange(false);
      toast({ title: "Package created successfully" });
      setFormData({ clientId: "", name: "", totalSessions: 10, usedSessions: 0, price: "", status: "active", billingType: "block", monthlyRate: "", nextBillingDate: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating package", description: err.message, variant: "destructive" });
    },
  });

  const selectedBillingType = allowMonthly ? formData.billingType : "block";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Session Package</DialogTitle>
          <DialogDescription>Add a new session package for a client.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
              <SelectTrigger data-testid="select-package-client">
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
            <Label>Package Name</Label>
            <Input
              placeholder="e.g. 10-Session Pack, Monthly Unlimited"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-package-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Billing Type</Label>
            <Select value={allowMonthly ? formData.billingType : "block"} onValueChange={(v) => setFormData({ ...formData, billingType: v })}>
              <SelectTrigger data-testid="select-billing-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block</SelectItem>
                {allowMonthly && <SelectItem value="monthly">Monthly</SelectItem>}
              </SelectContent>
            </Select>
            {!allowMonthly && <UpgradeNotice feature="paymentTracking" compact />}
          </div>
          <div className="space-y-2">
            <Label>Total Sessions</Label>
            <Input
              type="number"
              min={1}
              value={formData.totalSessions}
              onChange={(e) => setFormData({ ...formData, totalSessions: parseInt(e.target.value) || 1 })}
              data-testid="input-total-sessions"
            />
          </div>
          {selectedBillingType === "block" ? (
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                placeholder={`e.g. ${currency}500`}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                data-testid="input-package-price"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Monthly Rate</Label>
                <Input
                  placeholder={`e.g. ${currency}200`}
                  value={formData.monthlyRate}
                  onChange={(e) => setFormData({ ...formData, monthlyRate: e.target.value })}
                  data-testid="input-monthly-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Next Billing Date</Label>
                <Input
                  type="date"
                  className="w-full min-w-0 max-w-full"
                  value={formData.nextBillingDate}
                  onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
                  data-testid="input-next-billing-date"
                />
              </div>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={!formData.clientId || !formData.name || mutation.isPending} data-testid="button-submit-package">
            {mutation.isPending ? "Creating..." : "Create Package"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewInvoiceDialog({ open, onOpenChange, clients, currency, allowPaymentTracking }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  currency: string;
  allowPaymentTracking: boolean;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    invoiceNumber: `INV-${String(Math.floor(1000 + Math.random() * 9000))}`,
    amount: "",
    dueDate: "",
    notes: "",
    paymentMethod: "",
    status: "pending",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = allowPaymentTracking
        ? data
        : {
            clientId: data.clientId,
            invoiceNumber: data.invoiceNumber,
            amount: data.amount,
            dueDate: data.dueDate,
            notes: data.notes,
            status: "pending",
          };
      const res = await apiRequest("POST", "/api/invoices", payload);
      return res.json();
    },
    onSuccess: async (saved) => {
      await cacheSavedRecord("/api/invoices", saved);
      onOpenChange(false);
      toast({ title: "Invoice created successfully" });
      trackActivationEvent("first_invoice_created");
      setFormData({
        clientId: "",
        invoiceNumber: `INV-${String(Math.floor(1000 + Math.random() * 9000))}`,
        amount: "",
        dueDate: "",
        notes: "",
        paymentMethod: "",
        status: "pending",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating invoice", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>Generate a new invoice for a client.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
              <SelectTrigger data-testid="select-invoice-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                data-testid="input-invoice-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount ({currency})</Label>
              <Input
                placeholder={`e.g. ${currency}200`}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                data-testid="input-invoice-amount"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                className="w-full min-w-0 max-w-full"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
                data-testid="input-invoice-due-date"
              />
            </div>
            {allowPaymentTracking && <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card_machine">Card machine</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>}
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              placeholder="Optional notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              data-testid="input-invoice-notes"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!formData.clientId || !formData.amount || !formData.dueDate || mutation.isPending} data-testid="button-submit-invoice">
            {mutation.isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    pending: "secondary",
    sent: "default",
    paid: "default",
    overdue: "destructive",
  };
  return (
    <Badge variant={variants[status] || "secondary"} data-testid={`badge-invoice-status-${status}`}>
      {status}
    </Badge>
  );
}

function EditSessionsDialog({ open, onOpenChange, pkg }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: PackageType;
}) {
  const { toast } = useToast();
  const [totalSessions, setTotalSessions] = useState(pkg.totalSessions);
  const [usedSessions, setUsedSessions] = useState(pkg.usedSessions || 0);

  const remaining = totalSessions - usedSessions;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/packages/${pkg.id}`, { totalSessions, usedSessions });
      return res.json();
    },
    onSuccess: async (saved) => {
      await cacheSavedRecord("/api/packages", saved);
      toast({ title: "Sessions updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error updating sessions", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Sessions</DialogTitle>
          <DialogDescription>{pkg.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Total Sessions</Label>
            <Input
              type="number"
              min={1}
              value={totalSessions}
              onChange={(e) => setTotalSessions(parseInt(e.target.value) || 1)}
              data-testid="input-edit-total-sessions"
            />
          </div>
          <div className="space-y-2">
            <Label>Used Sessions</Label>
            <Input
              type="number"
              min={0}
              max={totalSessions}
              value={usedSessions}
              onChange={(e) => setUsedSessions(Math.min(parseInt(e.target.value) || 0, totalSessions))}
              data-testid="input-edit-used-sessions"
            />
          </div>
          <div className="rounded-md bg-accent p-3 text-center">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold" data-testid="text-edit-remaining">{remaining}</p>
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-sessions">
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDetailDialog({ invoice, clientName, settings, onClose, allowInvoiceManagement, allowPaymentTracking }: {
  invoice: Invoice;
  clientName: string;
  settings: Settings | undefined;
  onClose: () => void;
  allowInvoiceManagement: boolean;
  allowPaymentTracking: boolean;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(invoice.status || "pending");
  const [paymentMethod, setPaymentMethod] = useState(invoice.paymentMethod || "");
  const currency = settings?.currency || "£";
  const [editData, setEditData] = useState({
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    status: invoice.status || "pending",
    paymentMethod: invoice.paymentMethod || "",
    notes: invoice.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editData) => {
      if (!allowInvoiceManagement) throw new Error("Invoice editing requires the Professional plan.");
      const payload = allowPaymentTracking ? data : { ...data, status: invoice.status || "pending", paymentMethod: invoice.paymentMethod || "" };
      const res = await apiRequest("PATCH", `/api/invoices/${invoice.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsEditing(false);
      toast({ title: "Invoice updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating invoice", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!allowInvoiceManagement) throw new Error("Sending invoices requires the Professional plan.");
      const res = await apiRequest("POST", `/api/invoices/${invoice.id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice email accepted",
        description: `Invoice ${invoice.invoiceNumber} for ${clientName} was accepted for sending. Inbox delivery is not yet confirmed.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error sending invoice", description: err.message, variant: "destructive" });
    },
  });

  const overdueReminderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${invoice.id}/remind-overdue`);
      return res.json();
    },
    onSuccess: (payload) => {
      const feedback = emailNotificationFeedback(payload, "Overdue invoice reminder", "overdue invoice reminder");
      toast({ title: feedback.title, description: feedback.description, variant: feedback.variant });
    },
    onError: (err: Error) => {
      toast({ title: "Could not send overdue reminder", description: err.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/usage"] }),
  });

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/invoice-pdf");
      await downloadInvoicePdf(invoice, clientName, settings);
      toast({ title: "PDF download started", description: "Check your browser downloads." });
    } catch {
      toast({ title: "Unable to download PDF", description: "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isEditing ? "Edit Invoice" : `Invoice ${invoice.invoiceNumber}`}
          </DialogTitle>
          <DialogDescription>
            {clientName} · <InvoiceStatusBadge status={currentStatus} />
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate(editData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input
                  value={editData.invoiceNumber}
                  onChange={(e) => setEditData({ ...editData, invoiceNumber: e.target.value })}
                  data-testid="input-edit-invoice-number"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount ({currency})</Label>
                <Input
                  value={editData.amount}
                  onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                  data-testid="input-edit-invoice-amount"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  className="w-full min-w-0 max-w-full"
                  value={editData.dueDate}
                  onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                  data-testid="input-edit-invoice-due-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                  <SelectTrigger data-testid="select-edit-invoice-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent" disabled={!allowInvoiceManagement}>Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {allowPaymentTracking && <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={editData.paymentMethod} onValueChange={(v) => setEditData({ ...editData, paymentMethod: v })}>
                <SelectTrigger data-testid="select-edit-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card_machine">Card machine</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                data-testid="input-edit-invoice-notes"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-invoice">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit-invoice">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-lg font-bold" data-testid="text-detail-amount">{currency}{invoice.amount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="text-sm font-medium" data-testid="text-detail-due-date">{formatDateUK(invoice.dueDate)}</p>
              </div>
            </div>

              {invoice.paymentMethod && (
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="text-sm capitalize">{invoice.paymentMethod}</p>
              </div>
            )}

            {invoice.sentDate && (
              <div>
                <p className="text-xs text-muted-foreground">Sent Date</p>
                <p className="text-sm">{formatDateUK(invoice.sentDate)}</p>
              </div>
            )}

            {invoice.paidDate && (
              <div>
                <p className="text-xs text-muted-foreground">Paid Date</p>
                <p className="text-sm">{formatDateUK(invoice.paidDate)}</p>
              </div>
            )}

            {invoice.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {allowInvoiceManagement ? <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-invoice">
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </Button> : <UpgradeNotice feature="invoiceManagement" compact />}
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading} data-testid="button-download-invoice">
                <Download className="w-3 h-3 mr-1" />
                {downloading ? "Downloading…" : "Download PDF"}
              </Button>
              {allowInvoiceManagement && currentStatus !== "sent" && currentStatus !== "paid" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  data-testid="button-send-invoice"
                >
                  <Send className="w-3 h-3 mr-1" />
                  {sendMutation.isPending ? "Sending..." : "Send"}
                </Button>
              )}
              {allowInvoiceManagement
                && invoice.dueDate < format(new Date(), "yyyy-MM-dd")
                && currentStatus !== "paid"
                && currentStatus !== "cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => overdueReminderMutation.mutate()}
                  disabled={overdueReminderMutation.isPending}
                  data-testid="button-remind-overdue-invoice"
                >
                  <Send className="w-3 h-3 mr-1" />
                  {overdueReminderMutation.isPending ? "Sending reminder…" : "Send overdue reminder"}
                </Button>
              )}
              {allowPaymentTracking && (
                <Select value={currentStatus} onValueChange={(status) => {
                  if (!allowPaymentTracking) return;
                  const data = status === "paid"
                    ? { status, paidDate: new Date().toISOString().split("T")[0] }
                    : { status };
                  apiRequest("PATCH", `/api/invoices/${invoice.id}`, data).then(() => {
                    setCurrentStatus(status);
                    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                    toast({ title: "Invoice status updated" });
                  }).catch((err: Error) => toast({ title: "Could not update invoice status", description: err.message, variant: "destructive" }));
                }}>
                  <SelectTrigger className="h-8 min-h-11 w-36" aria-label="Invoice status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {allowPaymentTracking && (
                <Select value={paymentMethod || "none"} onValueChange={(v) => {
                  if (!allowPaymentTracking) return;
                  const value = v === "none" ? "" : v;
                  apiRequest("PATCH", `/api/invoices/${invoice.id}`, { paymentMethod: value }).then(() => {
                    setPaymentMethod(value);
                    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                    toast({ title: "Payment method updated" });
                  }).catch((err: Error) => toast({ title: "Could not update payment method", description: err.message, variant: "destructive" }));
                }}>
                  <SelectTrigger className="h-8 min-h-11 w-40" aria-label="Record payment method"><SelectValue placeholder="Payment method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No method recorded</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card_machine">Card machine</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {!allowPaymentTracking && currentStatus !== "paid" && <UpgradeNotice feature="paymentTracking" compact />}
              {allowPaymentTracking && currentStatus !== "paid" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (!allowPaymentTracking) return;
                    apiRequest("PATCH", `/api/invoices/${invoice.id}`, {
                      status: "paid",
                      paidDate: new Date().toISOString().split("T")[0],
                    }).then(() => {
                      setCurrentStatus("paid");
                      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                      toast({ title: "Invoice marked as paid" });
                    }).catch((err: Error) => toast({ title: "Could not mark invoice as paid", description: err.message, variant: "destructive" }));
                  }}
                  data-testid="button-detail-mark-paid"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Payments() {
  const featureAccess = useFeatureAccess();
  const canTrackPayments = featureAccess.hasFeature("paymentTracking");
  const canViewRevenue = featureAccess.hasFeature("revenueTracking");
  const canInvoiceManagement = featureAccess.hasFeature("invoiceManagement");
  const canBusinessReports = featureAccess.hasFeature("advancedRevenue");
  const canMonthlyPackages = canTrackPayments;
  const [newPackageOpen, setNewPackageOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageType | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [revenueScope, setRevenueScope] = useState<"week" | "month">("month");
  const [reportFrom, setReportFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [reportTo, setReportTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [reportClientId, setReportClientId] = useState("all");

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "£";

  type RevenueReport = {
    from: string;
    to: string;
    totalRevenue: number;
    pendingTotal: number;
    pendingCount: number;
    monthlyBilling: number;
    blockRevenue: number;
    monthlyRevenue: number;
    unallocatedPaidCount: number;
    byClient?: { clientId: string; clientName: string; invoiceCount: number; paidTotal: number }[];
  };
  const revenueParams = new URLSearchParams({ period: revenueScope });
  const validReportRange = !!reportFrom && !!reportTo && reportFrom <= reportTo;
  if (canBusinessReports && validReportRange) {
    revenueParams.set("from", reportFrom);
    revenueParams.set("to", reportTo);
    if (reportClientId !== "all") revenueParams.set("clientId", reportClientId);
  }
  const revenueQuery = useQuery<RevenueReport>({
    queryKey: ["/api/revenue", revenueScope, canBusinessReports ? reportFrom : "", canBusinessReports ? reportTo : "", canBusinessReports ? reportClientId : ""],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/revenue?${revenueParams.toString()}`);
      return response.json();
    },
    enabled: canViewRevenue && !!settings && (!canBusinessReports || validReportRange),
  });

  const isLoading = clientsLoading || packagesLoading || invoicesLoading;
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const activePackages = packages.filter((p) => p.status === "active");
  const lowPackages = activePackages.filter((p) => p.billingType !== "monthly" && (p.totalSessions - (p.usedSessions || 0)) <= 2);
  
  const report = revenueQuery.data;
  const pendingTotal = report?.pendingTotal ?? 0;
  const pendingCount = report?.pendingCount ?? 0;
  const monthlyRevenue = report?.monthlyBilling ?? 0;

  const monthlyClients = packages
    .filter(p => p.billingType === "monthly" && p.status === "active")
    .map(p => ({ pkg: p, client: clients.find(c => c.id === p.clientId) }))
    .filter(item => item.client);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
      <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl" data-testid="text-payments-title">Payments & Packages</h1>
          <p className="text-sm text-muted-foreground">{activePackages.length} active packages</p>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${canViewRevenue ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-4`}>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="stat-active-packages">{activePackages.length}</p>
              <p className="text-xs text-muted-foreground">Active Packages</p>
            </div>
          </CardContent>
        </Card>
        {canViewRevenue ? <>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <PoundSterling className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="stat-monthly-revenue">{revenueQuery.isLoading ? "—" : `${currency}${monthlyRevenue.toFixed(2)}`}</p>
              <p className="text-xs text-muted-foreground">Projected Monthly Billing</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="stat-pending-invoices">{revenueQuery.isLoading ? "—" : `${currency}${pendingTotal.toFixed(2)}`}</p>
              <p className="text-xs text-muted-foreground">{pendingCount} pending invoices</p>
            </div>
          </CardContent>
        </Card>
        </> : <Card><CardContent className="p-4"><p className="text-sm font-medium">Payment tracking</p><p className="mt-1 text-xs text-muted-foreground">Record payments and follow outstanding invoices in Starter.</p></CardContent></Card>}
      </div>

      {canViewRevenue ? <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Revenue Overview
            </CardTitle>
            {!canBusinessReports && <div className="flex border rounded-lg overflow-hidden">
              <button
                className={`px-3 py-1 text-sm font-medium transition-colors ${revenueScope === "week" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                onClick={() => setRevenueScope("week")}
                data-testid="button-scope-week"
              >This Week</button>
              <button
                className={`px-3 py-1 text-sm font-medium transition-colors ${revenueScope === "month" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                onClick={() => setRevenueScope("month")}
                data-testid="button-scope-month"
              >This Month</button>
            </div>}
          </div>
        </CardHeader>
        <CardContent>
          {canBusinessReports && <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="min-w-0 space-y-1"><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" className="w-full min-w-0 max-w-full" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} data-testid="input-revenue-from" /></div>
            <div className="min-w-0 space-y-1"><Label htmlFor="report-to">To</Label><Input id="report-to" type="date" className="w-full min-w-0 max-w-full" value={reportTo} onChange={(e) => setReportTo(e.target.value)} data-testid="input-revenue-to" /></div>
            <div className="space-y-1"><Label htmlFor="report-client">Client</Label><Select value={reportClientId} onValueChange={setReportClientId}><SelectTrigger id="report-client" data-testid="select-revenue-client"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
          </div>}
          {canBusinessReports && !validReportRange && <p className="mb-3 text-sm text-destructive" role="alert">Choose a valid date range with the start date on or before the end date.</p>}
          {revenueQuery.isError ? <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-4 text-sm"><p>Revenue report could not be loaded.</p><Button variant="outline" size="sm" onClick={() => revenueQuery.refetch()}>Retry</Button></div> : revenueQuery.isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-primary" data-testid="stat-scope-total">{currency}{(report?.totalRevenue || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Projected Monthly Billing</p>
              <p className="text-2xl font-bold text-green-600" data-testid="stat-scope-monthly">{currency}{(report?.monthlyBilling || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold" data-testid="stat-scope-pending">{currency}{(report?.pendingTotal || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pending invoices</p>
              <p className="text-2xl font-bold" data-testid="stat-paid-invoices">{report?.pendingCount ?? 0}</p>
            </div>
          </div>
          {canBusinessReports && <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-4">
              <div><p className="text-xs text-muted-foreground">Paid non-monthly revenue</p><p className="text-lg font-semibold">{currency}{(report?.blockRevenue || 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Paid monthly revenue</p><p className="text-lg font-semibold">{currency}{(report?.monthlyRevenue || 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Paid invoices missing a payment date</p><p className="text-lg font-semibold">{report?.unallocatedPaidCount ?? 0}</p></div>
            </div>
            <div className="overflow-x-auto border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">Paid revenue by client</h3>
              {!report?.byClient?.length ? <p className="py-4 text-sm text-muted-foreground">No paid invoices in this report period.</p> : <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-4">Client</th><th className="py-2 pr-4">Paid invoices</th><th className="py-2 text-right">Paid revenue</th></tr></thead>
                <tbody>{report.byClient.map((row) => <tr key={row.clientId} className="border-b last:border-0"><td className="py-2 pr-4">{row.clientName}</td><td className="py-2 pr-4">{row.invoiceCount}</td><td className="py-2 text-right">{currency}{row.paidTotal.toFixed(2)}</td></tr>)}</tbody>
              </table>}
            </div>
          </div>}
          </>}
        </CardContent>
      </Card> : <UpgradeNotice feature="revenueTracking" />}

      <Tabs defaultValue="packages">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto" data-testid="tabs-payments">
            <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-1 text-xs sm:min-h-8 sm:px-3 sm:text-sm" value="packages" data-testid="tab-packages">Packages</TabsTrigger>
            <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-1 text-xs sm:min-h-8 sm:px-3 sm:text-sm" value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
            <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-1 text-xs sm:min-h-8 sm:px-3 sm:text-sm" value="monthly" data-testid="tab-monthly">Monthly Payments</TabsTrigger>
          </TabsList>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => setNewPackageOpen(true)} data-testid="button-add-package">
              <Plus className="w-4 h-4 mr-1" />
              New Package
            </Button>
            <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" variant="secondary" onClick={() => setNewInvoiceOpen(true)} data-testid="button-add-invoice">
              <FileText className="w-4 h-4 mr-1" />
              Create Invoice
            </Button>
          </div>
        </div>

        <TabsContent value="packages" className="space-y-4 mt-4">
          {lowPackages.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Low Session Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowPackages.map((pkg) => {
                    const remaining = pkg.totalSessions - (pkg.usedSessions || 0);
                    return (
                      <div key={pkg.id} className="flex items-center justify-between gap-2 py-1" data-testid={`alert-low-${pkg.id}`}>
                        <div>
                          <p className="text-sm font-medium">{clientMap.get(pkg.clientId) || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{pkg.name}</p>
                        </div>
                        <Badge variant="destructive">{remaining} session{remaining !== 1 ? "s" : ""} left</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activePackages.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No active packages. Create one to start tracking sessions.</p>
              <Button variant="secondary" className="mt-4" onClick={() => setNewPackageOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Create Package
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg) => {
                const remaining = pkg.totalSessions - (pkg.usedSessions || 0);
                const pct = ((pkg.usedSessions || 0) / pkg.totalSessions) * 100;
                const isLow = remaining <= 3 && pkg.status === "active";
                const isMonthly = pkg.billingType === "monthly";

                return (
                  <Card key={pkg.id} data-testid={`card-package-${pkg.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="font-medium text-sm">{clientMap.get(pkg.clientId) || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{pkg.name}</p>
                        </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-billing-type-${pkg.id}`}>
                    {isMonthly ? "Monthly" : "Block"}
                  </Badge>
                  {isMonthly && pkg.nextBillingDate && (
                    <p className="text-[10px] text-muted-foreground">Next: {formatDateUK(pkg.nextBillingDate)}</p>
                  )}
                  {!isMonthly && (
                            <Badge
                              variant={pkg.status === "active" ? (isLow ? "destructive" : "default") : "secondary"}
                              className="text-xs"
                            >
                              {pkg.status === "active" ? `${remaining} left` : pkg.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isMonthly ? (
                        <div className="space-y-1">
                          {pkg.monthlyRate && (
                            <p className="text-sm font-medium" data-testid={`text-monthly-rate-${pkg.id}`}>
                              {pkg.monthlyRate}/month
                            </p>
                          )}
                          {pkg.nextBillingDate && (
                            <p className="text-xs text-muted-foreground" data-testid={`text-next-billing-${pkg.id}`}>
                              Next billing: {formatDateUK(pkg.nextBillingDate)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">{pkg.totalSessions} sessions included</p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{pkg.usedSessions || 0} used</span>
                            <span>{pkg.totalSessions} total</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      )}
                      {!isMonthly && pkg.price && (
                        <p className="text-xs text-muted-foreground">Price: {pkg.price}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditingPkg(pkg)}
                        data-testid={`button-edit-sessions-${pkg.id}`}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit Sessions
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4 mt-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No invoices yet. Create one to start billing.</p>
              <Button variant="secondary" className="mt-4" onClick={() => setNewInvoiceOpen(true)}>
                <FileText className="w-4 h-4 mr-1" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <Card
                  key={inv.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setViewingInvoice(inv)}
                  data-testid={`card-invoice-${inv.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-invoice-number-${inv.id}`}>{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{clientMap.get(inv.clientId) || "Unknown"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-right">
                          <p className="text-sm font-medium" data-testid={`text-invoice-amount-${inv.id}`}>{currency}{inv.amount}</p>
                          <p className="text-xs text-muted-foreground">Due: {formatDateUK(inv.dueDate)}</p>
                        </div>
                        {inv.paymentMethod && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-payment-method-${inv.id}`}>
                            {inv.paymentMethod}
                          </Badge>
                        )}
                        <InvoiceStatusBadge status={inv.status || "pending"} />
                      </div>
                    </div>
                    {inv.notes && (
                      <p className="text-xs text-muted-foreground mt-2" data-testid={`text-invoice-notes-${inv.id}`}>{inv.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          {!canMonthlyPackages ? <UpgradeNotice feature="paymentTracking" /> : <>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-medium">Monthly Payment Clients</p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {monthlyClients.length} on monthly billing
            </Badge>
          </div>
          {monthlyClients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium mb-1">No monthly billing clients</p>
                <p className="text-sm">Monthly billing packages let you track payments collected through your own arrangements.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {monthlyClients.map(({ pkg, client }) => {
                return (
                  <Card key={pkg.id} data-testid={`card-monthly-client-${client!.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-monthly-client-name-${client!.id}`}>{client!.name}</p>
                            <p className="text-sm text-muted-foreground">{pkg.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {pkg.monthlyRate && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-monthly-rate-${pkg.id}`}>
                                  {currency}{pkg.monthlyRate}/month
                                </Badge>
                              )}
                              {pkg.nextBillingDate && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-next-billing-${pkg.id}`}>
                                  <Calendar className="w-3 h-3" />
                                  Next billing: {formatDateUK(pkg.nextBillingDate)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">Manual tracking</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </>}
        </TabsContent>
      </Tabs>

      <NewPackageDialog open={newPackageOpen} onOpenChange={setNewPackageOpen} clients={clients} currency={currency} allowMonthly={canMonthlyPackages} />
      <NewInvoiceDialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen} clients={clients} currency={currency} allowPaymentTracking={canTrackPayments} />
      {editingPkg && (
        <EditSessionsDialog
          open={!!editingPkg}
          onOpenChange={(open) => { if (!open) setEditingPkg(null); }}
          pkg={editingPkg}
        />
      )}
      {viewingInvoice && (
        <InvoiceDetailDialog
          invoice={viewingInvoice}
          clientName={clientMap.get(viewingInvoice.clientId) || "Unknown"}
          settings={settings}
          onClose={() => setViewingInvoice(null)}
          allowInvoiceManagement={canInvoiceManagement}
          allowPaymentTracking={canTrackPayments}
        />
      )}
    </div>
  );
}
