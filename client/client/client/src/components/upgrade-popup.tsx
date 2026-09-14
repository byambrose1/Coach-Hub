import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ArrowRight, Users, Lock } from "lucide-react";
import { useState } from "react";

interface UpgradeInfo {
  currentCount: number;
  currentPlan: string;
  currentMax: number;
  nextTier: number;
  nextTierMax: number;
  nextTierPrice: string;
  nextTierPlan: string;
  paymentLink: string;
}

interface UpgradePopupProps {
  open: boolean;
  onClose: () => void;
  upgradeInfo: UpgradeInfo | null;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  business: "Business",
};

export function UpgradePopup({ open, onClose, upgradeInfo }: UpgradePopupProps) {
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  if (!upgradeInfo) return null;

  const nextPlanLabel = PLAN_LABELS[upgradeInfo.nextTierPlan] || upgradeInfo.nextTierPlan;
  const currentPlanLabel = PLAN_LABELS[upgradeInfo.currentPlan] || upgradeInfo.currentPlan;
  const isFree = upgradeInfo.currentPlan === "free";

  const handleUpgrade = async () => {
    setIsStartingCheckout(true);
    try {
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: upgradeInfo.nextTierPlan }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.message || "Unable to start checkout");
      }
      window.location.assign(data.url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to start checkout");
      setIsStartingCheckout(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">Upgrade Your Plan</DialogTitle>
          </div>
          <DialogDescription>
            You've reached the client limit for your current plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {upgradeInfo.currentCount} / {upgradeInfo.currentMax} clients used
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                Current plan: {currentPlanLabel}
              </p>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{nextPlanLabel}</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                    <Crown className="h-3 w-3 mr-1" />
                    Recommended
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Up to {upgradeInfo.nextTierMax} clients
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">
                  {upgradeInfo.nextTierPrice === "0" ? "Free" : `£${upgradeInfo.nextTierPrice}`}
                </span>
                {upgradeInfo.nextTierPrice !== "0" && (
                  <span className="text-sm text-muted-foreground">/month</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{upgradeInfo.nextTierMax} clients included</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Checkout is hosted securely by Stripe. Your plan updates after payment is verified.</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={isStartingCheckout}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="button-upgrade-plan"
          >
            {isStartingCheckout ? "Opening checkout..." : `Upgrade to ${nextPlanLabel}`}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
