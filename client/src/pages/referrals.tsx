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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Gift, Users, Copy, Check, UserPlus } from "lucide-react";
import type { Client, Referral } from "@shared/schema";

function NewReferralDialog({ open, onOpenChange, clients }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    referrerClientId: "",
    referredName: "",
    referredEmail: "",
    referredPhone: "",
    rewardType: "free_session",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/referrals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      onOpenChange(false);
      toast({ title: "Referral tracked successfully" });
      setFormData({ referrerClientId: "", referredName: "", referredEmail: "", referredPhone: "", rewardType: "free_session", notes: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating referral", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Track New Referral</DialogTitle>
          <DialogDescription>Record a client referral and set up rewards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Referring Client</Label>
            <Select value={formData.referrerClientId} onValueChange={(v) => setFormData({ ...formData, referrerClientId: v })}>
              <SelectTrigger data-testid="select-referrer">
                <SelectValue placeholder="Who referred them?" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Referred Person's Name</Label>
            <Input
              placeholder="New client name"
              value={formData.referredName}
              onChange={(e) => setFormData({ ...formData, referredName: e.target.value })}
              required
              data-testid="input-referred-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={formData.referredEmail}
                onChange={(e) => setFormData({ ...formData, referredEmail: e.target.value })}
                data-testid="input-referred-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+1 234 567 890"
                value={formData.referredPhone}
                onChange={(e) => setFormData({ ...formData, referredPhone: e.target.value })}
                data-testid="input-referred-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reward Type</Label>
            <Select value={formData.rewardType} onValueChange={(v) => setFormData({ ...formData, rewardType: v })}>
              <SelectTrigger data-testid="select-reward-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free_session">Free Session</SelectItem>
                <SelectItem value="discount">Discount on Next Package</SelectItem>
                <SelectItem value="bonus_session">Bonus Session Added</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              data-testid="input-referral-notes"
            />
          </div>

          <Button type="submit" className="w-full" disabled={!formData.referrerClientId || !formData.referredName || mutation.isPending} data-testid="button-submit-referral">
            {mutation.isPending ? "Saving..." : "Track Referral"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReferralStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    pending: "secondary",
    converted: "default",
    rewarded: "default",
    expired: "destructive",
  };
  return <Badge variant={variants[status] || "secondary"} className="text-xs">{status}</Badge>;
}

function RewardBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    free_session: "Free Session",
    discount: "Discount",
    bonus_session: "Bonus Session",
    other: "Other",
  };
  return <Badge variant="secondary" className="text-xs">{labels[type] || type}</Badge>;
}

export default function Referrals() {
  const [newReferralOpen, setNewReferralOpen] = useState(false);
  const { toast } = useToast();

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const updateReferral = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; rewardApplied?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/referrals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Referral updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating referral", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = referralsLoading || clientsLoading;
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const totalReferrals = referrals.length;
  const convertedCount = referrals.filter((r) => r.status === "converted" || r.status === "rewarded").length;
  const pendingCount = referrals.filter((r) => r.status === "pending").length;
  const rewardsGiven = referrals.filter((r) => r.rewardApplied).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-referrals-title">Referral Programme</h1>
          <p className="text-sm text-muted-foreground">Track client referrals and rewards</p>
        </div>
        <Button onClick={() => setNewReferralOpen(true)} data-testid="button-add-referral">
          <Plus className="w-4 h-4 mr-1" />
          Track Referral
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold" data-testid="stat-total-referrals">{totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Total Referrals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <UserPlus className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold" data-testid="stat-converted">{convertedCount}</p>
            <p className="text-xs text-muted-foreground">Converted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <span className="text-2xl font-bold block" data-testid="stat-pending">{pendingCount}</span>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold" data-testid="stat-rewards">{rewardsGiven}</p>
            <p className="text-xs text-muted-foreground">Rewards Given</p>
          </CardContent>
        </Card>
      </div>

      {referrals.length === 0 ? (
        <div className="text-center py-12">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No referrals yet. Track your first referral to start rewarding clients.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setNewReferralOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Track Referral
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((referral) => (
              <Card key={referral.id} data-testid={`card-referral-${referral.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-medium">{referral.referredName}</p>
                        <ReferralStatusBadge status={referral.status || "pending"} />
                        <RewardBadge type={referral.rewardType || "free_session"} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Referred by <span className="font-medium">{clientMap.get(referral.referrerClientId) || "Unknown"}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{referral.date}</span>
                        {referral.referredEmail && <span>{referral.referredEmail}</span>}
                        {referral.referredPhone && <span>{referral.referredPhone}</span>}
                      </div>
                      {referral.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{referral.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {referral.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateReferral.mutate({ id: referral.id, status: "converted" })}
                          data-testid={`button-convert-${referral.id}`}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Convert
                        </Button>
                      )}
                      {(referral.status === "converted") && !referral.rewardApplied && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateReferral.mutate({ id: referral.id, rewardApplied: true, status: "rewarded" })}
                          data-testid={`button-reward-${referral.id}`}
                        >
                          <Gift className="w-3 h-3 mr-1" />
                          Apply Reward
                        </Button>
                      )}
                      {referral.rewardApplied && (
                        <Badge variant="secondary" className="text-xs">
                          <Gift className="w-3 h-3 mr-0.5" />
                          Rewarded
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <NewReferralDialog open={newReferralOpen} onOpenChange={setNewReferralOpen} clients={clients} />
    </div>
  );
}
