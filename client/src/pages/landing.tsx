import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, Users, CreditCard, FileText } from "lucide-react";

const features = [
  { icon: Users, label: "Client Management" },
  { icon: Calendar, label: "Session Scheduling" },
  { icon: CreditCard, label: "Payment Tracking" },
  { icon: FileText, label: "Progress Notes" },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 text-white" style={{ background: "linear-gradient(135deg, hsl(217 91% 50%), hsl(217 91% 65%), hsl(230 80% 55%))" }}>
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="w-10 h-10 rounded-md bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="font-bold text-lg">FT</span>
          </div>
          <span className="text-xl font-semibold">FitTrack</span>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700 delay-150">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-8 h-8 opacity-80" />
          </div>
          <h1 className="text-4xl font-bold leading-tight" data-testid="text-landing-title">
            Your Complete Coaching Dashboard
          </h1>
          <p className="text-lg text-white/80 max-w-md">
            Manage your clients, schedule sessions, track payments, and keep detailed notes — all in one place.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {features.map((feature) => (
              <div key={feature.label} className="flex items-center gap-2 text-sm text-white/70">
                <feature.icon className="w-4 h-4" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-white/60 animate-in fade-in duration-1000 delay-300">
          <span>Free to get started</span>
          <span>No credit card required</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="lg:hidden flex items-center gap-3 mb-8 animate-in fade-in duration-500">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">FT</span>
          </div>
          <span className="text-xl font-semibold">FitTrack</span>
        </div>

        <div className="w-full max-w-sm space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Welcome to FitTrack</h2>
            <p className="text-muted-foreground">
              The all-in-one platform for fitness coaches to manage their business.
            </p>
          </div>

          <Button asChild size="lg" className="w-full" data-testid="button-login">
            <a href="/api/login">Log in to get started</a>
          </Button>

          <p className="text-xs text-muted-foreground lg:hidden">
            Free to get started &middot; No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
