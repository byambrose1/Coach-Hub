import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";
import { setupAuth as setupLegacyAuth, isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { logError } from "../safe-logging";
import { supabaseClient, supabaseConfigured, getAuthProviders } from "./supabase-client";
import { ensureIdentityTable, resolveCoach, AccountLinkError } from "./identities";
import { sessionUser } from "./supabase-session";
import { publicSite } from "@shared/public-site";
import { socialAuthProviders } from "@shared/auth-providers";
import { socialSignInHandler } from "./social-sign-in";
import { passwordMeetsPolicy, PASSWORD_POLICY_HINT } from "@shared/password-policy";

// Supabase rejected the signup itself (most commonly its own password
// policy) - the message is safe to show as-is, unlike a sign-in failure.
class SignupRejected extends Error {}

export const AUTH_TTL = 10 * 60 * 1000;
export function equalToken(left: unknown, right: unknown) {
  if (typeof left !== "string" || typeof right !== "string" || left.length > 256 || right.length > 256) return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
export function validTransaction(transaction: any, state: unknown, now = Date.now()) {
  return !!transaction && equalToken(transaction.state, state) &&
    Number.isFinite(transaction.startedAt) && now >= transaction.startedAt && now - transaction.startedAt < AUTH_TTL;
}
const save = (req: Request) => new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const clearCookie = (res: Response) => res.clearCookie("connect.sid", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });

async function legacyAccount(req: Request, res: Response): Promise<string | undefined> {
  if (!(req as any).isAuthenticated?.() || !req.user || (req.user as any).auth_provider === "supabase") return;
  let valid = false;
  const rejected: any = { status: () => rejected, json: () => {} };
  await isAuthenticated(req, rejected, () => { valid = true; });
  return valid ? (req.user as any).claims.sub : undefined;
}

async function transaction(req: Request, res: Response, allowAccountCreation = false) {
  const state = randomBytes(32).toString("hex");
  (req.session as any).supabaseTransaction = {
    state, startedAt: Date.now(), legacyId: await legacyAccount(req, res), allowAccountCreation,
  };
  return state;
}

export function callbackUrl(req: Request, state: string) {
  // Fixed local path; never accept an arbitrary return URL from the browser.
  const allowed = new Set([
    new URL(publicSite.siteUrl).hostname,
    "practably.co.uk", "coach-hub-uzmon92.replit.app",
    ...(process.env.REPLIT_DOMAINS || "").split(",").map(host => host.trim()),
    process.env.REPLIT_DEV_DOMAIN,
  ]);
  if (!allowed.has(req.hostname)) throw new Error("Unrecognised sign-in callback host");
  return `https://${req.hostname}/api/auth/supabase/callback?state=${state}`;
}

async function complete(req: Request, providerSession: Session) {
  // Verify with the configured provider, rather than trusting decoded JWT claims.
  const { data, error } = await supabaseClient().auth.getUser(providerSession.access_token);
  if (error || !data.user || data.user.id !== providerSession.user.id) throw new Error("Sign-in verification failed");
  const pending = (req.session as any).supabaseTransaction;
  const coach = await resolveCoach(data.user, pending?.legacyId, {
    allowCreate: pending?.allowAccountCreation === true,
  });
  const user = sessionUser(coach.id, providerSession, coach.email || undefined);
  // Passport regenerates the session, preventing fixation and removing PKCE state.
  await new Promise<void>((resolve, reject) => req.logIn(user, error => error ? reject(error) : resolve()));
  await save(req);
}

export async function setupAuthentication(app: Express) {
  if (!supabaseConfigured()) {
    await setupLegacyAuth(app);
    return;
  }
  await ensureIdentityTable();
  // Retain original authentication only as an explicit, authenticated linking bridge.
  await setupLegacyAuth(app, "/api/auth/legacy", "/login?legacy=connected");
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "Too many sign-in attempts. Please try again later." } });
  for (const provider of socialAuthProviders) app.use(`/api/auth/${provider}`, limiter);
  app.use("/api/auth/email", limiter);
  app.use("/api/auth/password/reset", limiter);
  app.get("/api/login", (_req, res) => res.redirect("/login"));
  let providers: Awaited<ReturnType<typeof getAuthProviders>> | undefined;
  let providersCheckedAt = 0;
  async function availableProviders() {
    if (!providers || Date.now() - providersCheckedAt > 30_000) {
      providers = await getAuthProviders();
      providersCheckedAt = Date.now();
    }
    return providers;
  }
  app.get("/api/auth/providers", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      res.json(await availableProviders());
    } catch (error) {
      logError("Unable to check sign-in availability", error);
      res.status(503).json({ message: "Sign-in is temporarily unavailable. Please try again shortly." });
    }
  });
  app.get("/api/auth/csrf", async (req, res) => {
    (req.session as any).authCsrf ||= randomBytes(32).toString("hex");
    res.set("Cache-Control", "no-store");
    await save(req);
    res.json({ token: (req.session as any).authCsrf });
  });
  for (const provider of socialAuthProviders) {
    app.get(`/api/auth/${provider}`, socialSignInHandler(provider, {
      providers: availableProviders, begin: transaction, client: supabaseClient,
      callback: callbackUrl, save,
      onError: error => logError("Unable to start Supabase sign-in", error),
    }));
  }
  app.post("/api/auth/email", async (req, res) => {
    if (!equalToken(req.get("X-CSRF-Token"), (req.session as any).authCsrf)) {
      return res.status(403).json({ message: "Please reload the sign-in page and try again." });
    }
    const parsed = z.object({
      email: z.string().email().max(254),
      password: z.string().max(128).optional(),
      action: z.enum(["login", "signup", "magic"]),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email address and sign-in option." });
    const { email, password, action } = parsed.data;
    if (action !== "magic" && !password) {
      return res.status(400).json({ message: "Enter your password." });
    }
    if (action === "signup" && !passwordMeetsPolicy(password!)) {
      return res.status(400).json({ message: `Choose a password with ${PASSWORD_POLICY_HINT}.` });
    }
    try {
      const state = await transaction(req, res, action === "signup");
      const client = supabaseClient(req);
      if (action === "magic") {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(req, state) },
        });
        if (error) throw new Error("Unable to send sign-in link");
        await save(req);
        return res.json({ message: "If your email can receive a sign-in link, it will arrive shortly. Open it in this browser." });
      }
      const result = action === "signup"
        ? await client.auth.signUp({ email, password: password!, options: { emailRedirectTo: callbackUrl(req, state) } })
        : await client.auth.signInWithPassword({ email, password: password! });
      if (result.error) {
        if (action === "signup") throw new SignupRejected(result.error.message || "Unable to create your account.");
        throw new Error("Email sign-in failed");
      }
      if (!result.data.session) {
        await save(req);
        return res.json({ message: "Check your email to confirm your account. Open the confirmation link in this browser." });
      }
      await complete(req, result.data.session);
      res.json({ redirect: "/" });
    } catch (error) {
      delete (req.session as any).supabaseTransaction;
      delete (req.session as any).supabasePkce;
      await save(req);
      if (error instanceof AccountLinkError) {
        return res.status(409).json({ message: error.code === "link_required"
          ? "An existing Practably account needs linking. Sign in with your original Replit account first, then choose your new login."
          : error.code === "account_required"
            ? "No Practably account is linked to this sign-in yet. Choose Create account to register."
            : "This sign-in is already linked to another Practably account." });
      }
      if (error instanceof SignupRejected) {
        return res.status(422).json({ message: error.message });
      }
      logError("Unable to complete Supabase email sign-in", error);
      res.status(401).json({ message: "Unable to sign in. Check your details or try again shortly." });
    }
  });
  app.post("/api/auth/password/reset", async (req, res) => {
    if (!equalToken(req.get("X-CSRF-Token"), (req.session as any).authCsrf)) {
      return res.status(403).json({ message: "Please reload the page and try again." });
    }
    const parsed = z.object({ email: z.string().email().max(254) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email address." });
    try {
      const state = await transaction(req, res);
      await supabaseClient(req).auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callbackUrl(req, state) });
      await save(req);
    } catch (error) {
      logError("Unable to start a password reset", error);
    }
    // Same neutral response either way - never reveal whether the email has an account.
    res.json({ message: "If that email has a Practably account, a password reset link has been sent. Open it in this browser to continue." });
  });
  app.get("/api/auth/supabase/callback", async (req, res) => {
    const pending = (req.session as any).supabaseTransaction;
    if (!validTransaction(pending, req.query.state) || typeof req.query.code !== "string" || req.query.code.length > 2048) {
      return res.redirect("/login?error=expired");
    }
    // Persist single-use consumption before any remote exchange.
    pending.startedAt = 0;
    try {
      await save(req);
      const { data, error } = await supabaseClient(req).auth.exchangeCodeForSession(req.query.code);
      if (error || !data.session) throw new Error("Invalid callback");
      await complete(req, data.session);
      res.redirect(req.query.type === "recovery" ? "/account/new-password" : "/");
    } catch (error) {
      delete (req.session as any).supabaseTransaction;
      delete (req.session as any).supabasePkce;
      await save(req);
      if (!(error instanceof AccountLinkError)) logError("Unable to complete Supabase callback", error);
      res.redirect(`/login?error=${error instanceof AccountLinkError ? error.code : "signin_failed"}`);
    }
  });
  app.post("/api/auth/password", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    if (user?.auth_provider !== "supabase" || !user?.supabase_subject) {
      return res.status(400).json({ message: "Password changes aren't available for this sign-in method." });
    }
    const parsed = z.object({ password: z.string().max(128) }).safeParse(req.body);
    if (!parsed.success || !passwordMeetsPolicy(parsed.data.password)) {
      return res.status(400).json({ message: `Choose a password with ${PASSWORD_POLICY_HINT}.` });
    }
    try {
      const { supabaseAdmin } = await import("./supabase-client");
      const { error } = await supabaseAdmin().auth.admin.updateUserById(user.supabase_subject, { password: parsed.data.password });
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      logError("Unable to update password", error);
      res.status(502).json({ message: "Unable to update your password right now. Please try again shortly." });
    }
  });
  app.get("/api/logout", async (req, res) => {
    const user = req.user as any;
    if (user?.auth_provider === "supabase" && user.access_token) {
      try {
        // Revocation does not expose tokens or prevent local logout on provider failure.
        const { supabaseAdmin } = await import("./supabase-client");
        const { error } = await supabaseAdmin().auth.admin.signOut(user.access_token, "local");
        if (error) logError("Supabase logout revocation failed", error);
      } catch (error) { logError("Supabase logout revocation failed", error); }
    }
    req.logout(error => {
      if (error) return res.status(500).json({ message: "Unable to sign out. Please try again." });
      req.session.destroy(error => {
        if (error) return res.status(500).json({ message: "Unable to clear your session. Please try again." });
        clearCookie(res);
        res.redirect("/");
      });
    });
  });
}