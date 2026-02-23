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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Package, CreditCard, ExternalLink, AlertTriangle, FileText, DollarSign, Clock, CheckCircle } from "lucide-react";
import type { Client, Package as PackageType, Settings, Invoice } from "@shared/schema";

function NewPackageDialog({ open, onOpenChange, clients }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
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
                placeholder="e.g. $500"
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
                  placeholder="e.g. $200"
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

function NewInvoiceDialog({ open, onOpenChange, clients }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
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
              <Label>Amount</Label>
              <Input
                placeholder="e.g. $200"
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

export default function Payments() {
  const [newPackageOpen, setNewPackageOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);

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
  const monthlyRevenue = activePackages
    .filter((p) => p.billingType === "monthly" && p.monthlyRate)
    .reduce((sum, p) => sum + (parseFloat(p.monthlyRate!.replace(/[^0-9.]/g, "")) || 0), 0);
  const pendingInvoices = invoices.filter((inv) => inv.status === "pending" || inv.status === "overdue");

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
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="stat-monthly-revenue">${monthlyRevenue.toFixed(0)}</p>
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
              <p className="text-2xl font-bold" data-testid="stat-pending-invoices">{pendingInvoices.length}</p>
              <p className="text-xs text-muted-foreground">Pending Invoices</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {settings?.paymentLink && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Payment Link</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{settings.paymentLink}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <a href={settings.paymentLink} target="_blank" rel="noopener noreferrer" data-testid="link-payment">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="packages">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList data-testid="tabs-payments">
            <TabsTrigger value="packages" data-testid="tab-packages">Packages</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
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
                              Next billing: {pkg.nextBillingDate}
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
                <Card key={inv.id} data-testid={`card-invoice-${inv.id}`}>
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
                          <p className="text-sm font-medium" data-testid={`text-invoice-amount-${inv.id}`}>{inv.amount}</p>
                          <p className="text-xs text-muted-foreground">Due: {inv.dueDate}</p>
                        </div>
                        {inv.paymentMethod && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-payment-method-${inv.id}`}>
                            {inv.paymentMethod}
                          </Badge>
                        )}
                        <InvoiceStatusBadge status={inv.status || "pending"} />
                        {inv.status !== "paid" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => markPaidMutation.mutate(inv.id)}
                            disabled={markPaidMutation.isPending}
                            data-testid={`button-mark-paid-${inv.id}`}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Mark Paid
                          </Button>
                        )}
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
      </Tabs>

      <NewPackageDialog open={newPackageOpen} onOpenChange={setNewPackageOpen} clients={clients} />
      <NewInvoiceDialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen} clients={clients} />
    </div>
  );
}
