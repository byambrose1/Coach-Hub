import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, User, FileText, CreditCard, Bell, Shield, Trash2, Mail, Phone, MapPin, Receipt, Crown, ArrowUp, ArrowDown, ExternalLink, Check } from "lucide-react";
import { useState, useEffect } from "react";
import type { Settings } from "@shared/schema";

interface Tier {
  name: string;
  label: string;
  max: number;
  price: string;
  paymentLink: string;
}

const PLAN_ORDER = ["free", "starter", "professional", "business"];
const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Dublin", label: "Dublin (GMT/IST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "UTC", label: "UTC" },
];

function SubscriptionSection({ settings }: { settings: Settings | undefined }) {
  const { toast } = useToast();
  const currentPlan = settings?.subscriptionPlan || "free";
  const currentTierIndex = PLAN_ORDER.indexOf(currentPlan);

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<Tier[]>({
    queryKey: ["/api/subscription/tiers"],
    enabled: !!settings,
  });

  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await fetch("/api/settings/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to change plan");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Plan updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot downgrade", description: err.message, variant: "destructive" });
    },
  });

  if (tiersLoading) {
    return <Card><CardContent className="pt-6 h-32 animate-pulse bg-muted rounded" /></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base">Subscription Plan</CardTitle>
        </div>
        <CardDescription>
          You currently have {clients.length} client{clients.length !== 1 ? "s" : ""}. Upgrade for more capacity, or downgrade if you're within the limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tiers.map((tier, i) => {
          const isCurrent = tier.name === currentPlan;
          const isUpgrade = i > currentTierIndex;
          const isDowngrade = i < currentTierIndex;
          const canDowngrade = isDowngrade && clients.length <= tier.max;
          const blockedDowngrade = isDowngrade && clients.length > tier.max;

          return (
            <div
              key={tier.name}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background"
              }`}
              data-testid={`tier-card-${tier.name}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isCurrent ? (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${isCurrent ? "text-primary" : ""}`}>
                      {tier.label}
                    </span>
                    {isCurrent && <Badge className="text-xs h-4">Current</Badge>}
                    <span className="text-xs text-muted-foreground">
                      Up to {tier.max} clients
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tier.price === "0" ? "Free" : `£${tier.price}/month`}
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                {isCurrent ? (
                  <span className="text-xs text-muted-foreground">Active</span>
                ) : isUpgrade ? (
                  tier.paymentLink ? (
                    <a href={tier.paymentLink} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="default" className="gap-1.5 text-xs" data-testid={`button-upgrade-${tier.name}`}>
                        <ArrowUp className="h-3 w-3" />
                        Upgrade
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" variant="outline" disabled className="text-xs opacity-50">
                      No link set
                    </Button>
                  )
                ) : canDowngrade ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => planMutation.mutate(tier.name)}
                    disabled={planMutation.isPending}
                    data-testid={`button-downgrade-${tier.name}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                    Downgrade
                  </Button>
                ) : blockedDowngrade ? (
                  <span className="text-xs text-muted-foreground text-right max-w-[120px]">
                    Remove {clients.length - tier.max} client{clients.length - tier.max !== 1 ? "s" : ""} first
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground pt-1">
          Upgrades are processed via external payment. After payment, your plan will be updated automatically or by your administrator.
        </p>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState({
    trainerName: "",
    businessName: "",
    trainerEmail: "",
    trainerPhone: "",
    businessAddress: "",
    cancellationPolicy: "",
    cancellationNoticeHours: 24,
    paymentLink: "",
    acceptedPaymentMethods: "",
    invoicePrefix: "INV",
    lowSessionThreshold: 2,
    enableEmailNotifications: false,
    enableSessionReminders: false,
    reminderHoursBefore: 24,
    hipaaCompliant: false,
    dataRetentionDays: 365,
    termsAccepted: false,
    currency: "£",
    timezone: "Europe/London",
    hasAcceptedTerms: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        trainerName: settings.trainerName || "",
        businessName: settings.businessName || "",
        trainerEmail: settings.trainerEmail || "",
        trainerPhone: settings.trainerPhone || "",
        businessAddress: settings.businessAddress || "",
        cancellationPolicy: settings.cancellationPolicy || "",
        cancellationNoticeHours: settings.cancellationNoticeHours ?? 24,
        paymentLink: settings.paymentLink || "",
        acceptedPaymentMethods: settings.acceptedPaymentMethods || "",
        invoicePrefix: settings.invoicePrefix || "INV",
        lowSessionThreshold: settings.lowSessionThreshold || 2,
        enableEmailNotifications: settings.enableEmailNotifications || false,
        enableSessionReminders: settings.enableSessionReminders || false,
        reminderHoursBefore: settings.reminderHoursBefore || 24,
        hipaaCompliant: settings.hipaaCompliant || false,
        dataRetentionDays: settings.dataRetentionDays || 365,
        termsAccepted: settings.termsAccepted || false,
        currency: settings.currency || "£",
        timezone: settings.timezone || "Europe/London",
        hasAcceptedTerms: settings.hasAcceptedTerms || false,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label>Business Name</Label>
              <Input
                placeholder="e.g. FitCoach Pro"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                data-testid="input-business-name"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
              <Input
                type="email"
                placeholder="coach@example.com"
                value={formData.trainerEmail}
                onChange={(e) => setFormData({ ...formData, trainerEmail: e.target.value })}
                data-testid="input-trainer-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
              <Input
                placeholder="+1 234 567 890"
                value={formData.trainerPhone}
                onChange={(e) => setFormData({ ...formData, trainerPhone: e.target.value })}
                data-testid="input-trainer-phone"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Business Address</Label>
            <Input
              placeholder="123 Fitness St, City, State"
              value={formData.businessAddress}
              onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
              data-testid="input-business-address"
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notice period required (hours)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={168}
                value={formData.cancellationNoticeHours}
                onChange={(e) => setFormData({ ...formData, cancellationNoticeHours: parseInt(e.target.value) || 24 })}
                className="w-28"
                data-testid="input-cancellation-notice-hours"
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
            <p className="text-xs text-muted-foreground">When a session is cancelled within this window, you'll be prompted to choose whether to deduct the session from the client's package.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Policy wording</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({
                  ...formData,
                  cancellationPolicy: `A minimum of ${formData.cancellationNoticeHours} hours' notice is required to cancel or reschedule a session. Cancellations made within ${formData.cancellationNoticeHours} hours of the scheduled start time may result in the session being deducted from your package. We appreciate your understanding and cooperation.`
                })}
                data-testid="button-use-policy-template"
              >
                Use template
              </Button>
            </div>
            <Textarea
              placeholder="Your cancellation policy wording..."
              value={formData.cancellationPolicy}
              onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
              className="min-h-[100px]"
              data-testid="input-cancellation-policy"
            />
            <p className="text-xs text-muted-foreground">Click "Use template" to auto-fill based on your notice period, then customise as needed.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Payment Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Link</Label>
            <Input
              placeholder="e.g. https://paypal.me/yourname or Stripe link"
              value={formData.paymentLink}
              onChange={(e) => setFormData({ ...formData, paymentLink: e.target.value })}
              data-testid="input-payment-link"
            />
            <p className="text-xs text-muted-foreground">Add your PayPal, Stripe, or other payment link.</p>
          </div>
          <div className="space-y-2">
            <Label>Accepted Payment Methods</Label>
            <Input
              placeholder="e.g. Cash, Bank Transfer, PayPal, Card"
              value={formData.acceptedPaymentMethods}
              onChange={(e) => setFormData({ ...formData, acceptedPaymentMethods: e.target.value })}
              data-testid="input-payment-methods"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            App Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger className="max-w-[120px]" data-testid="select-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="£">£ GBP</SelectItem>
                <SelectItem value="$">$ USD</SelectItem>
                <SelectItem value="€">€ EUR</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Currency symbol used across the app.</p>
          </div>
          <div className="space-y-2">
            <Label>Business timezone</Label>
            <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
              <SelectTrigger className="max-w-xs" data-testid="select-timezone">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((timezone) => (
                  <SelectItem key={timezone.value} value={timezone.value}>{timezone.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Keep this aligned with the timezone where you run your coaching business.</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Receipt className="w-3 h-3" /> Invoice Number Prefix</Label>
            <Input
              placeholder="INV"
              value={formData.invoicePrefix}
              onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
              className="max-w-[120px]"
              data-testid="input-invoice-prefix"
            />
            <p className="text-xs text-muted-foreground">Prefix for auto-generated invoice numbers (e.g. INV-0001).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </CardTitle>
          <CardDescription>Configure alerts and reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Low Session Alert Threshold</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={formData.lowSessionThreshold}
              onChange={(e) => setFormData({ ...formData, lowSessionThreshold: parseInt(e.target.value) || 2 })}
              className="max-w-[120px]"
              data-testid="input-low-session-threshold"
            />
            <p className="text-xs text-muted-foreground">Alert when a client's package has this many sessions or fewer remaining.</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Receive email alerts for bookings, cancellations, and low sessions</p>
            </div>
            <Switch
              checked={formData.enableEmailNotifications}
              onCheckedChange={(v) => setFormData({ ...formData, enableEmailNotifications: v })}
              data-testid="switch-email-notifications"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Session Reminders</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Send reminder notifications before scheduled sessions</p>
            </div>
            <Switch
              checked={formData.enableSessionReminders}
              onCheckedChange={(v) => setFormData({ ...formData, enableSessionReminders: v })}
              data-testid="switch-session-reminders"
            />
          </div>

          {formData.enableSessionReminders && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label>Reminder Lead Time (hours)</Label>
              <Input
                type="number"
                min={1}
                max={72}
                value={formData.reminderHoursBefore}
                onChange={(e) => setFormData({ ...formData, reminderHoursBefore: parseInt(e.target.value) || 24 })}
                className="max-w-[120px]"
                data-testid="input-reminder-hours"
              />
              <p className="text-xs text-muted-foreground">How many hours before a session to send the reminder.</p>
            </div>
          )}

          {(formData.enableEmailNotifications || formData.enableSessionReminders) && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Email delivery requires connecting an email service (like SendGrid). Notifications will be queued until a provider is configured.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Privacy controls
          </CardTitle>
          <CardDescription>Review how you collect and manage client information in FitTrack.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border p-4">
            <div>
              <Label>Handling PARQ and health information</Label>
              <p className="text-xs text-muted-foreground mt-1">
                PARQ responses are stored in the relevant client record. Only collect information you need for your coaching practice, limit access, and review your retention policy.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <a href="/privacy" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Read privacy information <ExternalLink className="h-3 w-3" />
              </a>
              <a href="/terms" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Read service terms <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">This guidance is not a certification of legal or regulatory compliance.</p>
          </div>

          <div className="space-y-2">
            <Label>Data Retention (days)</Label>
            <Input
              type="number"
              min={30}
              max={3650}
              value={formData.dataRetentionDays}
              onChange={(e) => setFormData({ ...formData, dataRetentionDays: parseInt(e.target.value) || 365 })}
              className="max-w-[120px]"
              data-testid="input-data-retention"
            />
            <p className="text-xs text-muted-foreground">How long to retain client data after last activity. Default is 365 days.</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div>
              <Label>Terms & Conditions</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings?.hasAcceptedTerms
                  ? "Accepted during the required first sign-in review."
                  : "Not yet accepted. The required review appears on the dashboard."}
              </p>
            </div>
            <Badge variant={settings?.hasAcceptedTerms ? "default" : "secondary"} data-testid="status-terms">
              {settings?.hasAcceptedTerms ? <><Check className="mr-1 h-3 w-3" /> Accepted</> : "Pending"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <SubscriptionSection settings={settings} />

      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account and all associated data. This cannot be undone.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" data-testid="button-delete-account">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account, all client data, session history, packages, invoices, and notes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      toast({
                        title: "Account deletion requested",
                        description: "Please contact support to complete your account deletion.",
                      });
                    }}
                    data-testid="button-confirm-delete"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
