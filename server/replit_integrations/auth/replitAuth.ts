import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { logError } from "../../safe-logging";

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
    ttl: sessionTtl,
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

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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
    app.get("/api/login", unavailable);
    app.get("/api/callback", unavailable);
    app.get("/api/logout", unavailable);
    return;
  }

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
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
      return next();
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };
}

export const isAuthenticated = createIsAuthenticated();
