import type { RequestHandler } from "express";
import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "./supabase-client";
import { mappedCoach } from "./identities";
import { authStorage } from "../replit_integrations/auth/storage";

export function sessionUser(coachId: string, session: Session, accountEmail = session.user.email) {
  return {
    auth_provider: "supabase", supabase_subject: session.user.id,
    claims: { sub: coachId, email: accountEmail },
    access_token: session.access_token, refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}

type Dependencies = {
  client?: typeof supabaseClient;
  mapping?: typeof mappedCoach;
  getAccount?: typeof authStorage.getUser;
  now?: () => number;
};

export function createSupabaseAuthentication(dependencies: Dependencies = {}): RequestHandler {
  return async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated?.() || !user?.supabase_subject || !user?.refresh_token || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const client = (dependencies.client || supabaseClient)();
    if (user.expires_at <= (dependencies.now || (() => Math.floor(Date.now() / 1000)))() + 30) {
      const { data, error } = await client.auth.refreshSession({ refresh_token: user.refresh_token });
      if (error || !data.session || data.session.user.id !== user.supabase_subject) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      Object.assign(user, sessionUser(user.claims.sub, data.session, user.claims.email));
      (req.session as any).passport.user = user;
      await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    }
    const { data, error } = await client.auth.getUser(user.access_token);
    if (error || data.user?.id !== user.supabase_subject ||
      await (dependencies.mapping || mappedCoach)(user.supabase_subject) !== user.claims.sub ||
      !await (dependencies.getAccount || authStorage.getUser.bind(authStorage))(user.claims.sub)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
  };
}

export const authenticateSupabaseSession = createSupabaseAuthentication();