import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, CircleAlert } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { passwordMeetsPolicy, PASSWORD_POLICY_HINT } from "@shared/password-policy";
import { apiRequest } from "@/lib/queryClient";

export default function NewPasswordPage() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!passwordMeetsPolicy(password)) {
      setError(`Choose a password with ${PASSWORD_POLICY_HINT}.`);
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/password", { password });
      navigate("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f2fb] px-4 py-10 text-[#211c2d]">
      <section className="w-full max-w-md rounded-[1.6rem] border border-violet-100/90 bg-white/80 p-6 shadow-[0_18px_55px_-36px_rgba(54,34,91,0.32)] sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" />
          <span className="text-[1.08rem] font-extrabold tracking-tight text-[#211c2d]">Practably</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#241d32]">Set a new password</h1>
        <p className="mt-2 text-sm leading-6 text-[#655e71]">You're signed in - choose a new password to finish resetting your account.</p>

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-semibold text-[#3d354b]">
              <span>New password</span>
              <span className="text-xs font-medium text-[#898194]">{PASSWORD_POLICY_HINT}</span>
            </span>
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8499]" aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a new password"
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

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(76,42,137,0.7)] transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Working…</> : <>Set password<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
          </button>
        </form>
      </section>
    </main>
  );
}
