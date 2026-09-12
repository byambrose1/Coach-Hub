import { useState, useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldCheck, AlertTriangle, X } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Schedule from "@/pages/schedule";
import Clients from "@/pages/clients";
import Payments from "@/pages/payments";
import SettingsPage from "@/pages/settings";
import Landing from "@/pages/landing";
import Admin from "@/pages/admin";
import PlatformAdmin from "@/pages/platform-admin";
import PlatformAdminCoach from "@/pages/platform-admin-coach";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Settings } from "@shared/schema";
import { apiRequest } from "./lib/queryClient";
import { PrivacyPage, TermsPage, SupportPage } from "@/pages/public";
import { trackActivationEvent } from "@/lib/activation";

function TermsModal() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const isLegalPage = ["/terms", "/privacy", "/support"].includes(location);

  useEffect(() => {
    if (isAuthenticated && settings && !settings.hasAcceptedTerms && !isLegalPage) {
      setOpen(true);
    } else if (isLegalPage) {
      setOpen(false);
    }
  }, [isAuthenticated, settings, isLegalPage]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/settings", { ...settings, hasAcceptedTerms: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setOpen(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Terms and Conditions
          </DialogTitle>
          <DialogDescription>Please review and accept the Practably terms to continue.</DialogDescription>
        </DialogHeader>
        <div className="p-4 border rounded-md text-sm space-y-3">
          <p>
            Review the current{" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline">Practably Terms</a>
            {" "}and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">Privacy information</a>
            {" "}before continuing.
          </p>
          <p className="text-muted-foreground">The legal operator details and final terms are clearly marked for owner review before public launch.</p>
        </div>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
          <label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
            I have read and agree to the Practably Terms
          </label>
        </div>
        <DialogFooter>
          <Button 
            className="w-full" 
            disabled={!agreed || mutation.isPending} 
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Processing..." : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImpersonationBanner() {
  const [, navigate] = useLocation();
  const { data: authUser } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const stopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/platform-admin/stop-impersonate", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate("/platform-admin");
    },
  });

  if (!authUser?.isImpersonating || authUser?.impersonatedUserId === authUser?.id) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-50 flex-shrink-0">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>Viewing as: <strong>{authUser.impersonatedUserName}</strong></span>
      </div>
      <button
        onClick={() => stopMutation.mutate()}
        disabled={stopMutation.isPending}
        className="flex items-center gap-1 underline hover:no-underline"
        data-testid="button-stop-impersonate"
      >
        <X className="h-4 w-4" />
        Exit
      </button>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/clients" component={Clients} />
      <Route path="/payments" component={Payments} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/admin" component={Admin} />
      <Route path="/platform-admin" component={PlatformAdmin} />
      <Route path="/platform-admin/coaches/:coachId" component={PlatformAdminCoach} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/pricing" component={Landing} />
      <Route component={Landing} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <ImpersonationBanner />
          <header className="flex items-center gap-2 p-2 border-b h-12 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const trackedSignup = useRef(false);
  const isPublicPage = ["/privacy", "/terms", "/support", "/pricing"].includes(location);

  useEffect(() => {
    if (isAuthenticated && !trackedSignup.current) {
      trackedSignup.current = true;
      trackActivationEvent("signup_completed");
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isPublicPage) {
    return <PublicRouter />;
  }

  if (!isAuthenticated) {
    return <PublicRouter />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <TermsModal />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
