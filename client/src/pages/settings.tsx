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
import { Save, User, FileText, CreditCard, Bell, Shield, Trash2, Mail, Phone, MapPin, Receipt } from "lucide-react";
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
    trainerEmail: "",
    trainerPhone: "",
    businessAddress: "",
    cancellationPolicy: "",
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
            Privacy & Compliance
          </CardTitle>
          <CardDescription>HIPAA compliance and data protection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>HIPAA Compliance Mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Enable enhanced data protection for health information</p>
            </div>
            <Switch
              checked={formData.hipaaCompliant}
              onCheckedChange={(v) => setFormData({ ...formData, hipaaCompliant: v })}
              data-testid="switch-hipaa"
            />
          </div>

          {formData.hipaaCompliant && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 space-y-2">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200">HIPAA Compliance Enabled</p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc pl-4">
                <li>Client health data (PARQ forms) is stored securely</li>
                <li>Access to health records is logged</li>
                <li>Data encryption is applied to sensitive fields</li>
                <li>Automatic data retention policy is enforced</li>
              </ul>
            </div>
          )}

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

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Terms & Conditions Accepted</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Confirm you've reviewed the service terms</p>
            </div>
            <Switch
              checked={formData.termsAccepted}
              onCheckedChange={(v) => setFormData({ ...formData, termsAccepted: v })}
              data-testid="switch-terms"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Subscription</CardTitle>
              <CardDescription>Your current plan and subscription status</CardDescription>
            </div>
            <Badge variant={settings?.subscriptionStatus === "active" ? "default" : "secondary"} data-testid="badge-subscription-status">
              {settings?.subscriptionStatus || "trial"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-accent">
            <div>
              <p className="text-sm font-medium capitalize">{settings?.subscriptionPlan || "Free"} Plan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings?.subscriptionPlan === "free"
                  ? "Basic features included. Upgrade for email notifications and advanced compliance."
                  : "All features unlocked."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
