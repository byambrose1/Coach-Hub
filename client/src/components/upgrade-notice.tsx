import { Link } from "wouter";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { featureLabels, featureMinimumPlan, type FeatureName } from "@shared/subscription-features";

export function UpgradeNotice({ feature, compact = false }: { feature: FeatureName; compact?: boolean }) {
  const label = featureLabels[feature];
  const minimumPlan = featureMinimumPlan[feature];
  const plan = `${minimumPlan[0].toUpperCase()}${minimumPlan.slice(1)}`;
  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/[0.04] ${compact ? "px-3 py-2" : "p-4"}`}>
      <div className="flex min-w-0 items-start gap-2">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{label}</span> is available on {plan}.
        </p>
      </div>
      <Link href="/settings" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
        Upgrade <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}