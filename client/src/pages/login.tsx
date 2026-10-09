import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SocialSignIn } from "@/components/social-sign-in";
import type { AuthProviders } from "@shared/auth-providers";
import { passwordMeetsPolicy, PASSWORD_POLICY_HINT } from "@shared/password-policy";

type AuthMode = "login" | "signup" | "magic";
type AuthResponse = { redirect?: string; message?: string };

const queryMessages: Record<string, string> = {
  signin_failed: "We couldn’t complete that sign-in. Please try again.",
  expired: "That sign-in link has expired. Request a new one to continue.",
  link_required: "This account needs to be connected to your existing coach account first.",
  already_linked: "That sign-in method is already connected to another account. Try a different one.",
  provider_unavailable: "That sign-in option is temporarily unavailable. Please use email instead.",
};

const modeCopy: Record<AuthMode, { title: string; description: string; submit: string }> = {
  login: {
    title: "Good to have you back.",
    description: "Sign in to pick up where your coaching business left off.",
    submit: "Sign in",
  },
  signup: {
    title: "Make room to grow.",
    description: "Create your Practably account and bring your coaching work together.",
    submit: "Create account",
  },
  magic: {
    title: "A link, then you’re in.",
    description: "We’ll send a secure sign-in link to your email address.",
    submit: "Send sign-in link",
  },
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [checkingProviders, setCheckingProviders] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/providers", { credentials: "include", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        if (active) setProviders(data);
      })
      .catch(() => { if (active) setError("Sign-in is temporarily unavailable. Please reload and try again."); })
      .finally(() => { if (active) setCheckingProviders(false); });
    return () => { active = false; };
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const queryError = params.get("error");
  const notice = params.get("legacy") === "connected"
    ? "Your original coach account is connected. Choose your new sign-in method below to keep access to your existing records."
    : queryError ? queryMessages[queryError] : "";
  const copy = modeCopy[mode];

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!providers?.email) {
      setError("Email sign-in is not available right now. Please try again shortly.");
      return;
    }
    if (mode === "signup" && !passwordMeetsPolicy(password)) {
      setError(`Choose a password with ${PASSWORD_POLICY_HINT}.`);
      return;
    }

    setSubmitting(true);
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!csrfResponse.ok) throw new Error("We couldn’t prepare a secure sign-in. Please try again.");
      const csrfData = await csrfResponse.json() as { token?: string };
      if (!csrfData.token) throw new Error("We couldn’t prepare a secure sign-in. Please try again.");

      const response = await fetch("/api/auth/email", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({
          email: email.trim(),
          password: mode === "magic" ? "" : password,
          action: mode,
        }),
      });
      const result = await response.json().catch(() => ({})) as AuthResponse;
      if (!response.ok) {
        setError(result.message || "We couldn’t sign you in with those details. Check them and try again.");
        return;
      }
      if (result.redirect) {
        window.location.assign(result.redirect);
        return;
      }
      setMessage(result.message || "Check your email for the next step.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#f5f2fb] text-[#211c2d]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-36 h-[30rem] w-[30rem] rounded-full border border-violet-200/70" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-[22rem] w-[22rem] rounded-full border border-violet-200/60" />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <BrandMark className="h-9 w-9" />
          <span className="text-[1.08rem] font-extrabold tracking-tight text-[#211c2d]">Practably</span>
        </Link>
        <Link href="/" className="text-sm font-semibold text-[#625b70] transition-colors hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          Back to home
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1fr_0.86fr] lg:gap-20 lg:pb-16">
        <section className="mx-auto w-full max-w-xl lg:mx-0">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/70 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-800">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e87951]" />
            Your coaching business, together
          </div>
          <h1 className="max-w-lg text-[2.7rem] font-extrabold leading-[1.04] tracking-[-0.055em] text-[#241d32] sm:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#655e71] sm:text-lg">{copy.description}</p>

          <div className="mt-9 overflow-hidden rounded-[1.6rem] border border-violet-100/90 bg-white/80 p-5 shadow-[0_18px_55px_-36px_rgba(54,34,91,0.32)] sm:p-6">
            {notice && (
              <div role="status" className={`mb-5 flex gap-3 rounded-xl border p-3.5 text-sm leading-5 ${
                params.get("legacy") === "connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}>
                {params.get("legacy") === "connected"
                  ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>{notice}</span>
              </div>
            )}

            <div className="grid grid-cols-3 rounded-xl bg-[#f3f0f8] p-1" role="tablist" aria-label="Choose account action">
              {(["login", "signup", "magic"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => changeMode(item)}
                  className={`rounded-lg px-2 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:text-sm ${
                    mode === item ? "bg-white text-violet-900 shadow-sm" : "text-[#756d82] hover:text-violet-800"
                  }`}
                >
                  {item === "login" ? "Sign in" : item === "signup" ? "Create account" : "Email link"}
                </button>
              ))}
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#3d354b]">Email address</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8499]" aria-hidden="true" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.co.uk"
                    className="h-12 w-full rounded-xl border border-[#e5dfed] bg-[#fcfbfe] pl-10 pr-3.5 text-sm text-[#282132] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                </span>
              </label>

              {mode !== "magic" && (
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-sm font-semibold text-[#3d354b]">
                    <span>Password</span>
                    {mode === "signup" && <span className="text-xs font-medium text-[#898194]">{PASSWORD_POLICY_HINT}</span>}
                  </span>
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8499]" aria-hidden="true" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === "signup" ? "Create a password" : "Your password"}
                      className="h-12 w-full rounded-xl border border-[#e5dfed] bg-[#fcfbfe] pl-10 pr-11 text-sm text-[#282132] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8c8499] transition hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </span>
                </label>
              )}

              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-800">{error}</p>}
              {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-emerald-900">{message}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(76,42,137,0.7)] transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-wait disabled:opacity-70"
              >
                {submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Working…</> : <>{copy.submit}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a93a5]">
              <span className="h-px flex-1 bg-[#ece7f1]" />Or continue with<span className="h-px flex-1 bg-[#ece7f1]" />
            </div>
            <SocialSignIn providers={providers} loading={checkingProviders} />
            <p className="mt-4 text-center text-xs leading-5 text-[#837b90]">
              Please review our{" "}
              <Link href="/terms" className="font-semibold text-violet-800 underline decoration-violet-300 underline-offset-2 hover:text-violet-950">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="font-semibold text-violet-800 underline decoration-violet-300 underline-offset-2 hover:text-violet-950">Privacy Policy</Link>.
            </p>
          </div>
        </section>

        <aside className="relative hidden min-h-[32rem] items-center justify-center lg:flex" aria-label="Account access information">
          <div aria-hidden="true" className="absolute inset-7 rounded-[2.5rem] bg-[#e9e1f5]" />
          <div aria-hidden="true" className="absolute right-2 top-10 h-20 w-20 rounded-full border-[14px] border-[#efb393]" />
          <div className="relative w-full max-w-[27rem] rotate-[-2deg] rounded-[2rem] border border-white/80 bg-[#fffdfd] p-7 shadow-[0_35px_90px_-44px_rgba(49,32,76,0.5)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BrandMark className="h-8 w-8" />
                <span className="text-sm font-extrabold tracking-tight">Practably</span>
              </div>
              <span className="rounded-full bg-[#f3eff8] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-800">Coach workspace</span>
            </div>
            <p className="mt-9 text-xs font-bold uppercase tracking-[0.16em] text-[#938a9e]">Made for the work you do</p>
            <h2 className="mt-2 max-w-sm text-3xl font-extrabold leading-[1.08] tracking-[-0.045em] text-[#2b2238]">Your clients. Your rhythm. One clear view.</h2>
            <div className="mt-7 space-y-3">
              {[
                ["01", "Keep client details close"],
                ["02", "Stay on top of sessions"],
                ["03", "Run your business your way"],
              ].map(([number, label]) => (
                <div key={number} className="flex items-center gap-4 rounded-xl border border-[#eee9f2] bg-[#fdfcff] px-4 py-3.5">
                  <span className="font-mono text-xs font-semibold text-[#d37755]">{number}</span>
                  <span className="text-sm font-semibold text-[#51495f]">{label}</span>
                  <Check className="ml-auto h-4 w-4 text-violet-600" aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#f6f2fa] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" aria-hidden="true" />
              <p className="text-xs leading-5 text-[#6b6377]">Account access stays in your hands. Existing coach records are only connected through the original account sign-in.</p>
            </div>
          </div>
          <div aria-hidden="true" className="absolute bottom-8 left-0 h-10 w-10 rounded-full bg-[#d9caed]" />
        </aside>
      </div>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-violet-200/60 px-5 py-5 text-xs leading-5 text-[#7b7388] sm:px-8 sm:flex-row sm:items-center sm:justify-between">
        <p>Built for independent coaches across the UK.</p>
        <p className="max-w-2xl sm:text-right">
          Returning Replit user?{" "}
          <a href="/api/auth/legacy/login" className="font-semibold text-violet-800 underline decoration-violet-300 underline-offset-2 hover:text-violet-950">Connect your existing coach account</a>
          {" "}first, then sign in with email, Google or Apple to keep your records. This won’t create a duplicate account. Email addresses alone don’t automatically merge accounts.
        </p>
      </footer>
    </main>
  );
}