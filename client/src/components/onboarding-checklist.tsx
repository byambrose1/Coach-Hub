import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Circle, Settings2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackActivationEvent } from "@/lib/activation";
import type { Settings } from "@shared/schema";
import { siteConfig } from "@/config/site";

interface AdminStats {
  totalClients: number;
  totalSessions: number;
  totalInvoices: number;
  activePackages: number;
  totalForms: number;
}

// Each step reflects data that already exists, rather than a separate
// manual checkbox - a coach who's actually done the thing (added a client,
// booked a session) should never see it reported as not done.
function buildSteps(settings: Settings, stats: AdminStats) {
  return [
    { id: "business", label: "Set your business details", href: "/settings", done: !!settings.businessName },
    { id: "client", label: "Add your first client", href: "/clients", done: stats.totalClients > 0 },
    { id: "service", label: "Create a service or package", href: "/payments", done: stats.activePackages > 0 },
    { id: "parq", label: "Send a PARQ form", href: "/clients", done: stats.totalForms > 0 },
    { id: "first-booking", label: "Create your first invoice or booking", href: "/schedule", done: stats.totalSessions > 0 || stats.totalInvoices > 0 },
  ];
}

export function OnboardingChecklist() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const { data: stats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/settings", { ...settings, onboardingDismissed: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/settings"] }),
  });

  if (!settings || !stats) return null;

  const steps = buildSteps(settings, stats);
  const completed = steps.filter((step) => step.done).length;
  const dismissed = settings.onboardingDismissed || completed === steps.length;

  if (dismissed) return null;

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-orange-50 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> First steps
          </div>
          <CardTitle className="text-lg">Make {siteConfig.name} work for your coaching business</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">These tick off automatically as you go. You can skip this checklist anytime.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={collapsed ? "Expand setup checklist" : "Collapse setup checklist"} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Progress value={(completed / steps.length) * 100} aria-label={`${completed} of ${steps.length} setup steps complete`} className="h-2 bg-violet-100" />
            <span className="shrink-0 text-xs font-semibold text-violet-700">{completed}/{steps.length}</span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/75 p-3">
                <span className="shrink-0 text-violet-600" aria-hidden="true">
                  {step.done ? <Check className="h-5 w-5 rounded-full bg-emerald-100 p-0.5 text-emerald-700" /> : <Circle className="h-5 w-5" />}
                </span>
                <a href={step.href} className={`min-w-0 flex-1 text-sm font-medium hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${step.done ? "text-muted-foreground line-through" : "text-slate-800"}`}>
                  {step.label}
                </a>
                {!step.done && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-3">
            <a href="/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:underline"><Settings2 className="h-4 w-4" aria-hidden="true" /> Open settings</a>
            <Button variant="ghost" size="sm" onClick={() => { trackActivationEvent("signup_completed"); dismissMutation.mutate(); }}>Skip for now</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
