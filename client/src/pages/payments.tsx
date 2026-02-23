import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Package, CreditCard, ExternalLink, AlertTriangle } from "lucide-react";
import type { Client, Package as PackageType, Settings } from "@shared/schema";

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
      setFormData({ clientId: "", name: "", totalSessions: 10, usedSessions: 0, price: "", status: "active" });
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
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                placeholder="e.g. $500"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                data-testid="input-package-price"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!formData.clientId || !formData.name || mutation.isPending} data-testid="button-submit-package">
            {mutation.isPending ? "Creating..." : "Create Package"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Payments() {
  const [newPackageOpen, setNewPackageOpen] = useState(false);

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const isLoading = clientsLoading || packagesLoading;
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const activePackages = packages.filter((p) => p.status === "active");
  const lowPackages = activePackages.filter((p) => (p.totalSessions - (p.usedSessions || 0)) <= 2);

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
        <Button onClick={() => setNewPackageOpen(true)} data-testid="button-add-package">
          <Plus className="w-4 h-4 mr-1" />
          New Package
        </Button>
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

            return (
              <Card key={pkg.id} data-testid={`card-package-${pkg.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <p className="font-medium text-sm">{clientMap.get(pkg.clientId) || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{pkg.name}</p>
                    </div>
                    <Badge
                      variant={pkg.status === "active" ? (isLow ? "destructive" : "default") : "secondary"}
                      className="text-xs"
                    >
                      {pkg.status === "active" ? `${remaining} left` : pkg.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{pkg.usedSessions || 0} used</span>
                      <span>{pkg.totalSessions} total</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                  {pkg.price && (
                    <p className="text-xs text-muted-foreground">Price: {pkg.price}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewPackageDialog open={newPackageOpen} onOpenChange={setNewPackageOpen} clients={clients} />
    </div>
  );
}
