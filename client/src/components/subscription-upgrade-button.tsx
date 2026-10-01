import React from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscriptionUpgradeButton({
  plan,
  selectedPlan,
  pending,
  disabled,
  onUpgrade,
}: {
  plan: string;
  selectedPlan: string | undefined;
  pending: boolean;
  disabled: boolean;
  onUpgrade: (plan: string) => void;
}) {
  const isOpening = pending && selectedPlan === plan;
  return (
    <Button
      size="sm"
      variant="default"
      className="gap-1.5 text-xs"
      onClick={() => onUpgrade(plan)}
      disabled={disabled}
      aria-busy={isOpening}
      data-testid={`button-upgrade-${plan}`}
    >
      {isOpening
        ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        : <ArrowUp className="h-3 w-3" aria-hidden="true" />}
      {isOpening ? "Opening..." : "Upgrade"}
    </Button>
  );
}