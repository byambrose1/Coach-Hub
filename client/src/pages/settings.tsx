import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, User, FileText, CreditCard, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import type { Settings } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState({
    trainerName: "",
    businessName: "",
    cancellationPolicy: "",
    paymentLink: "",
    lowSessionThreshold: 2,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        trainerName: settings.trainerName || "",
        businessName: settings.businessName || "",
        cancellationPolicy: settings.cancellationPolicy || "",
        paymentLink: settings.paymentLink || "",
        lowSessionThreshold: settings.lowSessionThreshold || 2,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <Button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending} data-testid="button-save-settings">
          <Save className="w-4 h-4 mr-1" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Name</Label>
            <Input
              placeholder="Coach Name"
              value={formData.trainerName}
              onChange={(e) => setFormData({ ...formData, trainerName: e.target.value })}
              data-testid="input-trainer-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Business Name (optional)</Label>
            <Input
              placeholder="e.g. FitCoach Pro"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              data-testid="input-business-name"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Cancellation Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Policy Details</Label>
            <Textarea
              placeholder="e.g. 24-hour cancellation policy. Late cancellations will be charged the full session fee."
              value={formData.cancellationPolicy}
              onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
              className="min-h-[100px]"
              data-testid="input-cancellation-policy"
            />
            <p className="text-xs text-muted-foreground">This policy will be visible to clients when booking sessions.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Payment Link</Label>
            <Input
              placeholder="e.g. https://paypal.me/yourname or Stripe link"
              value={formData.paymentLink}
              onChange={(e) => setFormData({ ...formData, paymentLink: e.target.value })}
              data-testid="input-payment-link"
            />
            <p className="text-xs text-muted-foreground">Add your PayPal, Stripe, or other payment link. Clients can use this to pay for sessions.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Low Session Alert Threshold</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={formData.lowSessionThreshold}
              onChange={(e) => setFormData({ ...formData, lowSessionThreshold: parseInt(e.target.value) || 2 })}
              data-testid="input-low-session-threshold"
            />
            <p className="text-xs text-muted-foreground">You'll be alerted when a client's package has this many sessions or fewer remaining.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
