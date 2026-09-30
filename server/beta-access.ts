import type { Express, RequestHandler } from "express";

declare module "express-session" {
  interface SessionData {
    betaAccessGranted?: boolean;
  }
}

// Practably is invite-only during private beta: the public landing page has
// no self-serve "sign up" link, only a waitlist form. This gate keeps
// /api/login itself from being an unlisted-but-guessable back door - anyone
// invited gets a link like /join?code=... (or the code to type in on /join),
// which unlocks login for their browser session. Set BETA_ACCESS_CODE to turn
// this on; leaving it unset disables the gate entirely (useful for local dev).
function getAccessCode(): string | undefined {
  const code = process.env.BETA_ACCESS_CODE;
  return code && code.trim() ? code.trim() : undefined;
}

export const betaAccessGate: RequestHandler = (req, res, next) => {
  const accessCode = getAccessCode();
  if (!accessCode) return next();
  if (req.session?.betaAccessGranted) return next();

  const suppliedCode = typeof req.query.code === "string" ? req.query.code : "";
  if (suppliedCode && suppliedCode === accessCode) {
    req.session.betaAccessGranted = true;
    return next();
  }

  return res.redirect(`/join?next=${encodeURIComponent(req.originalUrl)}`);
};

export function registerBetaAccessRoutes(app: Express) {
  app.post("/api/beta-access", (req, res) => {
    const accessCode = getAccessCode();
    if (!accessCode) return res.status(200).json({ granted: true });
    const { code } = req.body || {};
    if (typeof code === "string" && code.trim() === accessCode) {
      req.session.betaAccessGranted = true;
      return res.status(200).json({ granted: true });
    }
    return res.status(401).json({ granted: false, message: "That code isn't right." });
  });
}
