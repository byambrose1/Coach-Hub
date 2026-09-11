import { useState, useRef } from "react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Package, CreditCard, AlertTriangle, FileText, Clock, CheckCircle, Pencil, Download, Send, PoundSterling, TrendingUp, Users, Copy, Calendar, RefreshCw } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { Client, Package as PackageType, Settings, Invoice, Session } from "@shared/schema";
import { trackActivationEvent } from "@/lib/activation";
import { siteConfig } from "@/config/site";

function formatDateUK(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function NewPackageDialog({ open, onOpenChange, clients, currency }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  currency: string;
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
      const res = await apiRequest("POST", "/api/packages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      onOpenChange(false);
      toast({ title: "Package created successfully" });
      setFormData({ clientId: "", name: "", totalSessions: 10, usedSessions: 0, price: "", status: "active", billingType: "block", monthlyRate: "", nextBillingDate: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating package", description: err.message, variant: "destructive" });
    },
  });

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
            <Select value={formData.billingType} onValueChange={(v) => setFormData({ ...formData, billingType: v })}>
              <SelectTrigger data-testid="select-billing-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
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
          {formData.billingType === "block" ? (
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
            <div className="grid grid-cols-2 gap-3">
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

function NewInvoiceDialog({ open, onOpenChange, clients, currency }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  currency: string;
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
      const res = await apiRequest("POST", "/api/invoices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
                data-testid="input-invoice-due-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
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

function InvoiceDetailDialog({ invoice, clientName, settings, onClose }: {
  invoice: Invoice;
  clientName: string;
  settings: Settings | undefined;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
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
      const res = await apiRequest("PATCH", `/api/invoices/${invoice.id}`, data);
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
      const res = await apiRequest("POST", `/api/invoices/${invoice.id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice sent", description: "Invoice emailed to client successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error sending invoice", description: err.message, variant: "destructive" });
    },
  });

  const handleDownload = () => {
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .business-info { text-align: right; }
          .business-info h2 { margin: 0; color: #2563eb; }
          .business-info p { margin: 2px 0; font-size: 13px; color: #666; }
          .invoice-title { font-size: 32px; font-weight: bold; color: #2563eb; margin-bottom: 20px; }
          .invoice-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .meta-group h4 { margin: 0 0 5px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
          .meta-group p { margin: 2px 0; font-size: 14px; }
          .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .line-items th { background: #f8f9fa; padding: 10px 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e7eb; }
          .line-items td { padding: 12px 15px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          .total-row { background: #f0f4ff; }
          .total-row td { font-weight: bold; font-size: 16px; color: #2563eb; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999; text-align: center; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-sent { background: #dbeafe; color: #1e40af; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-overdue { background: #fee2e2; color: #991b1b; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="invoice-title">INVOICE</div>
            <p style="font-size:14px;color:#666;">Invoice No: <strong>${invoice.invoiceNumber}</strong></p>
          </div>
          <div class="business-info">
            <h2>${settings?.businessName || siteConfig.name}</h2>
            <p>${settings?.trainerName || "Coach"}</p>
            ${settings?.trainerEmail ? `<p>${settings.trainerEmail}</p>` : ""}
            ${settings?.trainerPhone ? `<p>${settings.trainerPhone}</p>` : ""}
            ${settings?.businessAddress ? `<p>${settings.businessAddress}</p>` : ""}
          </div>
        </div>
        <div class="invoice-meta">
          <div class="meta-group">
            <h4>Bill To</h4>
            <p><strong>${clientName}</strong></p>
          </div>
          <div class="meta-group">
            <h4>Invoice Details</h4>
            <p>Date: ${formatDateUK(new Date().toISOString().split("T")[0])}</p>
            <p>Due: ${formatDateUK(invoice.dueDate)}</p>
            <p>Status: <span class="status-badge status-${invoice.status || "pending"}">${invoice.status || "pending"}</span></p>
            ${invoice.paymentMethod ? `<p>Payment: ${invoice.paymentMethod}</p>` : ""}
          </div>
        </div>
        <table class="line-items">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoice.notes || "Training services"}</td>
              <td style="text-align:right;">${currency}${invoice.amount}</td>
            </tr>
            <tr class="total-row">
              <td>Total Due</td>
              <td style="text-align:right;">${currency}${invoice.amount}</td>
            </tr>
          </tbody>
        </table>
        ${settings?.paymentLink ? `<p style="font-size:13px;color:#666;">Pay online: <a href="${settings.paymentLink}" style="color:#2563eb;">${settings.paymentLink}</a></p>` : ""}
        <div class="footer">
          <p>Thank you for your business</p>
          <p>${settings?.businessName || siteConfig.name} · Generated on ${formatDateUK(new Date().toISOString().split("T")[0])}</p>
        </div>
        <div class="no-print" style="margin-top:30px;text-align:center;">
          <button onclick="window.print()" style="padding:10px 30px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save as PDF</button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
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
            {clientName} · <InvoiceStatusBadge status={invoice.status || "pending"} />
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
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
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={editData.paymentMethod} onValueChange={(v) => setEditData({ ...editData, paymentMethod: v })}>
                <SelectTrigger data-testid="select-edit-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <div className="grid grid-cols-2 gap-4">
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
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-invoice">
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download-invoice">
                <Download className="w-3 h-3 mr-1" />
                Download PDF
              </Button>
              {invoice.status !== "sent" && invoice.status !== "paid" && (
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
              {invoice.status !== "paid" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    apiRequest("PATCH", `/api/invoices/${invoice.id}`, {
                      status: "paid",
                      paidDate: new Date().toISOString().split("T")[0],
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                      toast({ title: "Invoice marked as paid" });
                    });
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
  const { toast } = useToast();
  const [newPackageOpen, setNewPackageOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageType | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [revenueScope, setRevenueScope] = useState<"week" | "month">("month");
  const [mandateLinks, setMandateLinks] = useState<Record<string, string>>({});
  const [generatingMandateFor, setGeneratingMandateFor] = useState<string | null>(null);

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "£";

  const generateMandateLink = async (client: Client) => {
    if (!client.email) {
      toast({ title: "Client has no email address", variant: "destructive" });
      return;
    }
    setGeneratingMandateFor(client.id);
    try {
      const res = await apiRequest("POST", "/api/payments/create-mandate-link", { clientId: client.id });
      const data = await res.json();
      if (data.link) {
        setMandateLinks(prev => ({ ...prev, [client.id]: data.link }));
        toast({ title: "Payment link generated" });
        trackActivationEvent("first_payment_initiated");
      } else {
        throw new Error(data.message || "No link returned");
      }
    } catch (err: any) {
      toast({ title: "Failed to generate link", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingMandateFor(null);
    }
  };

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, {
        status: "paid",
        paidDate: new Date().toISOString().split("T")[0],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const isLoading = clientsLoading || packagesLoading || invoicesLoading;
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const activePackages = packages.filter((p) => p.status === "active");
  const lowPackages = activePackages.filter((p) => p.billingType !== "monthly" && (p.totalSessions - (p.usedSessions || 0)) <= 2);
  
  const calculateRevenue = () => {
    const monthlyRevenue = activePackages
      .filter((p) => p.billingType === "monthly" && p.monthlyRate)
      .reduce((sum, p) => sum + (parseFloat(p.monthlyRate!.replace(/[^0-9.]/g, "")) || 0), 0);
    
    const pendingInvoices = invoices.filter((inv) => inv.status === "pending" || inv.status === "sent" || inv.status === "overdue");
    const pendingTotal = pendingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    
    return { monthlyRevenue, pendingInvoices, pendingTotal };
  };

  const { monthlyRevenue, pendingInvoices, pendingTotal } = calculateRevenue();

  // Revenue scope calculations
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  const scopeStart = revenueScope === "week" ? weekStartStr : monthStartStr;
  const scopeEnd = revenueScope === "week" ? weekEndStr : monthEndStr;

  const paidInvoicesInScope = invoices.filter(inv =>
    inv.status === "paid" && inv.paidDate && inv.paidDate >= scopeStart && inv.paidDate <= scopeEnd
  );

  const clientPkgMap = new Map(packages.map(p => [p.clientId, p]));

  const scopeMonthlyRevenue = paidInvoicesInScope
    .filter(inv => {
      const pkg = clientPkgMap.get(inv.clientId);
      return pkg?.billingType === "monthly";
    })
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const scopeBlockRevenue = paidInvoicesInScope
    .filter(inv => {
      const pkg = clientPkgMap.get(inv.clientId);
      return !pkg || pkg.billingType === "block";
    })
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const scopeTotalRevenue = paidInvoicesInScope.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const sessionsInScope = sessions.filter(s =>
    s.date >= scopeStart && s.date <= scopeEnd && s.status !== "cancelled"
  );

  const monthlyClients = packages
    .filter(p => p.billingType === "monthly" && p.status === "active")
    .map(p => ({ pkg: p, client: clients.find(c => c.id === p.clientId) }))
    .filter(item => item.client);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-payments-title">Payments & Packages</h1>
          <p className="text-sm text-muted-foreground">{activePackages.length} active packages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <PoundSterling className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="stat-monthly-revenue">{currency}{monthlyRevenue.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Monthly Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="stat-pending-invoices">{currency}{pendingTotal.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">{pendingInvoices.length} Pending Invoices</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Revenue Overview
            </CardTitle>
            <div className="flex border rounded-lg overflow-hidden">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-primary" data-testid="stat-scope-total">{currency}{scopeTotalRevenue.toFixed(0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Monthly Billing</p>
              <p className="text-2xl font-bold text-green-600" data-testid="stat-scope-monthly">{currency}{scopeMonthlyRevenue.toFixed(0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Block Bookings</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="stat-scope-block">{currency}{scopeBlockRevenue.toFixed(0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Sessions</p>
              <p className="text-2xl font-bold" data-testid="stat-scope-sessions">{sessionsInScope.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="packages">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList data-testid="tabs-payments">
            <TabsTrigger value="packages" data-testid="tab-packages">Packages</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly Payments</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button onClick={() => setNewPackageOpen(true)} data-testid="button-add-package">
              <Plus className="w-4 h-4 mr-1" />
              New Package
            </Button>
            <Button variant="secondary" onClick={() => setNewInvoiceOpen(true)} data-testid="button-add-invoice">
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
                const isLow = remaining <= 2 && pkg.status === "active";
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
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-medium">Monthly Payment Clients</p>
              <p className="text-sm text-muted-foreground">Manage GoCardless direct debit mandates for clients on monthly billing.</p>
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
                <p className="text-sm">Create a package with monthly billing to manage direct debit mandates here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {monthlyClients.map(({ pkg, client }) => {
                const link = mandateLinks[client!.id];
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
                        <div className="flex flex-col items-end gap-2">
                          {link ? (
                            <div className="flex items-center gap-2">
                              <div className="max-w-[180px] truncate text-xs text-muted-foreground border rounded px-2 py-1"
                                data-testid={`text-mandate-link-${client!.id}`}>
                                {link}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(link);
                                }}
                                data-testid={`button-copy-link-${client!.id}`}
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMandateLinks(prev => { const n = { ...prev }; delete n[client!.id]; return n; })}
                                data-testid={`button-refresh-link-${client!.id}`}
                              >
                                <RefreshCw className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => generateMandateLink(client!)}
                              disabled={generatingMandateFor === client!.id}
                              data-testid={`button-generate-mandate-${client!.id}`}
                            >
                              {generatingMandateFor === client!.id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  Set Up Direct Debit
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NewPackageDialog open={newPackageOpen} onOpenChange={setNewPackageOpen} clients={clients} currency={currency} />
      <NewInvoiceDialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen} clients={clients} currency={currency} />
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
        />
      )}
    </div>
  );
}
