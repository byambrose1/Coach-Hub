import type { Request, RequestHandler, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { socialAuthProviders, type AuthProviders, type SocialAuthProvider } from "@shared/auth-providers";

type Dependencies = {
  providers: () => Promise<AuthProviders>;
  begin: (req: Request, res: Response) => Promise<string>;
  client: (req: Request) => Pick<SupabaseClient, "auth">;
  callback: (req: Request, state: string) => string;
  save: (req: Request) => Promise<void>;
  onError: (error: unknown) => void;
};

export function socialSignInHandler(provider: SocialAuthProvider, dependencies: Dependencies): RequestHandler {
  if (!socialAuthProviders.includes(provider)) throw new Error("Unsupported sign-in provider");
  return async (req, res) => {
    try {
      const available = await dependencies.providers();
      if (!available[provider]) {
        res.redirect("/login?error=provider_unavailable");
        return;
      }
      const state = await dependencies.begin(req, res);
      const { data, error } = await dependencies.client(req).auth.signInWithOAuth({
        provider,
        options: { redirectTo: dependencies.callback(req, state), skipBrowserRedirect: true },
      });
      if (error || !data.url) throw new Error("Provider unavailable");
      // Persist the request-specific verifier/state before leaving the app.
      await dependencies.save(req);
      res.redirect(data.url);
    } catch (error) {
      delete (req.session as any).supabaseTransaction;
      delete (req.session as any).supabasePkce;
      try { await dependencies.save(req); } catch { /* Never start OAuth after a session save failure. */ }
      dependencies.onError(error);
      res.redirect("/login?error=provider_unavailable");
    }
  };
}