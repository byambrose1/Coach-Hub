import * as client from "openid-client";
import { type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { logError } from "../../safe-logging";
import { ProtectedOidcStrategy, authSessionKey, validateOidcCallback } from "./oidc-protection";
import { authenticateSupabaseSession } from "../../auth/supabase-session";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// OIDC discovery hits Replit's own identity service over the network at startup.
// A transient blip there should not take the whole app down - retry a few times
// with backoff before giving up. Once it succeeds, memoize() below caches the
// result for an hour so we are not re-discovering on every request.
async function discoverWithRetry(attempts = 3, baseDelayMs = 1000) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(baseDelayMs * attempt);
      }
    }
  }
  throw lastError;
}

const getOidcConfig = memoize(discoverWithRetry, { maxAge: 3600 * 1000 });

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl / 1000,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token ?? user.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export function createOidcVerifier(upsert = upsertUser): VerifyFunction {
  return async (tokens, verified) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      // Identity is the verified OIDC subject, never a matching email address.
      await upsert(tokens.claims());
      verified(null, user);
    } catch (error) {
      logError("Unable to create or update authenticated account", error);
      verified(new Error("Unable to complete sign-in. Please retry or contact support."));
    }
  };
}

export async function setupAuth(app: Express, routePrefix = "/api", successRedirect = "/") {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  let config: Awaited<ReturnType<typeof getOidcConfig>>;
  try {
    config = await getOidcConfig();
  } catch (error) {
    // Sign-in depends on Replit's identity service being reachable. If it is
    // down or unreachable after retries, keep the rest of the app (marketing
    // pages, already-authenticated sessions using a cached token) working
    // instead of crashing the whole process, and fail sign-in explicitly.
    console.error("Auth setup failed: could not reach the sign-in provider.");
    logError("OIDC discovery failed at startup", error);
    const unavailable: RequestHandler = (_req, res) => {
      res.status(503).json({
        message: "Sign-in is temporarily unavailable. Please try again shortly.",
      });
    };
    app.get(`${routePrefix}/login`, unavailable);
    app.get(`${routePrefix}/callback`, unavailable);
    app.get(`${routePrefix}/logout`, unavailable);
    return;
  }

  const verify = createOidcVerifier();

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new ProtectedOidcStrategy(
        {
          name: strategyName,
          sessionKey: authSessionKey(domain),
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}${routePrefix}/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };


  app.get(`${routePrefix}/login`, (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get(`${routePrefix}/callback`, validateOidcCallback(), (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: successRedirect,
      failureRedirect: routePrefix === "/api" ? "/?signin=failed" : "/login?error=signin_failed",
    })(req, res, next);
  });

  app.get(`${routePrefix}/logout`, async (req, res) => {
    const refreshToken = (req.user as any)?.refresh_token;
    if (refreshToken && config.serverMetadata().revocation_endpoint) {
      try {
        await client.tokenRevocation(config, refreshToken, { token_type_hint: "refresh_token" });
      } catch (error) {
        logError("Provider token revocation failed during logout", error);
      }
    }
    req.logout((error) => {
      if (error) return res.status(500).json({ message: "Unable to sign out. Please try again." });
      req.session.destroy((destroyError) => {
        if (destroyError) return res.status(500).json({ message: "Unable to clear your session. Please try again." });
        res.clearCookie("connect.sid", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
        res.redirect(client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href);
      });
    });
  });
}

type AuthMiddlewareDependencies = {
  now?: () => number;
  refresh?: (
    refreshToken: string
  ) => Promise<client.TokenEndpointResponse & client.TokenEndpointResponseHelpers>;
};

export function createIsAuthenticated(
  dependencies: AuthMiddlewareDependencies = {}
): RequestHandler {
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const refresh =
    dependencies.refresh ??
    (async (refreshToken: string) => {
      const config = await getOidcConfig();
      return client.refreshTokenGrant(config, refreshToken);
    });

  return async (req, res, next) => {
    const user = req.user as any;
    if (user?.auth_provider === "supabase") return authenticateSupabaseSession(req, res, next);

    if (!req.isAuthenticated() || !user?.expires_at) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (now() <= user.expires_at) {
      return next();
    }

    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const tokenResponse = await refresh(refreshToken);
      updateUserSession(user, tokenResponse);
      if (req.session) {
        const passportSession = (req.session as any).passport;
        if (passportSession) passportSession.user = user;
        await new Promise<void>((resolve, reject) => {
          req.session.save(error => error ? reject(error) : resolve());
        });
      }
      return next();
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };
}

export const isAuthenticated = createIsAuthenticated();
