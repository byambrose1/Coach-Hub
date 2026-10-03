import type { AuthProviders, SocialAuthProvider } from "@shared/auth-providers";
import { socialAuthLabels, socialAuthProviders } from "@shared/auth-providers";

function ProviderMark({ provider }: { provider: SocialAuthProvider }) {
  return provider === "google" ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.35 2.59A5.99 5.99 0 0 1 12 5.96Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.3.77 3.1.83 1.2-.24 2.35-.96 3.63-.87 1.53.12 2.68.73 3.44 1.83-3.15 1.89-2.4 6.04.49 7.2-.58 1.51-1.33 3.01-2.67 3.99l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

export function SocialSignIn({ providers, loading }: { providers: AuthProviders | null; loading: boolean }) {
  const unavailable = providers ? socialAuthProviders.filter(provider => !providers[provider]) : [];
  return (
    <div className="space-y-3">
      {socialAuthProviders.map(provider => {
        const enabled = providers?.[provider] === true;
        const label = `Continue with ${socialAuthLabels[provider]}`;
        const classes = `flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          provider === "apple" ? "border-black bg-black text-white" : "border-[#ded7e8] bg-white text-[#30283b]"
        } ${enabled ? "hover:opacity-85" : "cursor-not-allowed opacity-45"}`;
        const content = <><ProviderMark provider={provider} />{label}</>;
        return enabled ? (
          <a key={provider} href={`/api/auth/${provider}`} className={classes} data-testid={`button-auth-${provider}`}>
            {content}
          </a>
        ) : (
          <button key={provider} type="button" disabled className={classes}
            aria-label={`${label} — currently unavailable`} data-testid={`button-auth-${provider}`}>
            {content}
          </button>
        );
      })}
      {loading ? <p role="status" className="text-center text-xs text-[#837b90]">Checking sign-in options…</p>
        : unavailable.length > 0 ? <p className="text-center text-xs leading-5 text-[#837b90]">
          {unavailable.map(provider => socialAuthLabels[provider]).join(" and ")} sign-in is not available yet. Please use another option.
        </p> : null}
    </div>
  );
}