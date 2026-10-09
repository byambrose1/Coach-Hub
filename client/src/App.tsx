import { useState, useEffect, useRef } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { PublicSeo } from "@/components/public-seo";
import { Loader2, ShieldCheck, AlertTriangle, X, LockKeyhole } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Schedule from "@/pages/schedule";
import Clients from "@/pages/clients";
import Payments from "@/pages/payments";
import SettingsPage from "@/pages/settings";
import Landing from "@/landing";
import Admin from "@/pages/admin";
import PlatformAdmin from "@/pages/platform-admin";
import PlatformAdminCoach from "@/pages/platform-admin-coach";
import PlatformAdminWaitlist from "@/pages/platform-admin-waitlist";
import PlatformAdminBlog from "@/pages/platform-admin-blog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Settings } from "@shared/schema";
import { apiRequest } from "./lib/queryClient";
import { PrivacyPage, TermsPage, SupportPage } from "@/pages/public";
import { BlogListPage, BlogPostPage } from "@/pages/blog";
import { trackActivationEvent } from "@/lib/activation";
import { publicSite } from "@shared/public-site";
import { captureAttributionFromUrl } from "@/lib/attribution";
import LoginPage from "@/pages/login";
import PublicFormPage from "@/pages/public-form";
import NewPasswordPage from "@/pages/new-password";

captureAttributionFromUrl();

function TermsModal() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // /settings stays reachable even with outstanding terms, so a coach who
  // doesn't want to accept a changed version can still cancel, request a
  // refund, delete their account or export their data.
  const isExemptPage = ["/terms", "/privacy", "/support", "/login", "/f", "/settings", "/account/new-password"].includes(location);
  const needsAcceptance = !!settings && (!settings.hasAcceptedTerms || settings.termsAcceptedVersion !== publicSite.termsVersion);

  useEffect(() => {
    if (isAuthenticated && needsAcceptance && !isExemptPage) {
      setOpen(true);
    } else if (isExemptPage) {
      setOpen(false);
    }
  }, [isAuthenticated, needsAcceptance, isExemptPage]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings/accept-terms");
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
            Please review the current{" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline">Practably Terms</a>
            {" "}and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">Privacy information</a>
            {" "}before continuing.
          </p>
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
      <Route path="/account/new-password" component={NewPasswordPage} />
      <Route path="/practice-admin" component={Admin} />
      <Route path="/admin" component={PlatformAdmin} />
      <Route path="/platform-admin" component={PlatformAdmin} />
      <Route path="/platform-admin/waitlist" component={PlatformAdminWaitlist} />
      <Route path="/platform-admin/blog" component={PlatformAdminBlog} />
      <Route path="/platform-admin/coaches/:coachId" component={PlatformAdminCoach} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/f" component={PublicFormPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/pricing" component={Landing} />
      <Route component={Landing} />
    </Switch>
  );
}

function ProtectedSignIn() {
  const [location] = useLocation();
  const isPlatformAdmin = location === "/admin" || location.startsWith("/platform-admin");
  const isPracticeAdmin = location === "/practice-admin";
  const area = isPlatformAdmin ? "owner and account-manager workspace" : isPracticeAdmin ? "practice tools" : "coach workspace";
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Practably · protected area</p>
        <h1 className="mt-2 text-2xl font-bold">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This {area} needs an authenticated account. Sign in using the same hostname where your account is registered (for example, keep the www or non-www address consistent).
        </p>
        {(isPlatformAdmin || isPracticeAdmin) && (
          <p className="mt-3 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            {isPlatformAdmin
              ? "Platform Admin is for the verified owner and authorised account managers. Owner-only controls remain restricted."
              : "Practice tools shows your own practice overview. Platform Admin is a separate owner/account-manager area."}
          </p>
        )}
        <Link href="/login" className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Go to sign in
        </Link>
        <Link href="/" className="mt-4 inline-flex min-h-10 w-full items-center justify-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to Practably
        </Link>
      </section>
    </main>
  );
}

function isProtectedPath(path: string) {
  return path === "/schedule" || path === "/clients" || path === "/payments" || path === "/settings"
    || path === "/account/new-password"
    || path === "/practice-admin" || path === "/admin" || path.startsWith("/platform-admin");
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
          <header className="flex h-14 flex-shrink-0 items-center gap-2 border-b px-3 py-1.5 md:h-12">
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
  const isPublicPage =
    ["/login", "/privacy", "/terms", "/support", "/pricing", "/f"].includes(location) ||
    location.startsWith("/blog");

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
    if (isProtectedPath(location)) return <ProtectedSignIn />;
    return <PublicRouter />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PublicSeo />
        <AppContent />
        <TermsModal />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
