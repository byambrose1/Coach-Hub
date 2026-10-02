import { timingSafeEqual } from "node:crypto";
import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import type { Request, RequestHandler } from "express";

export const authSessionKey = (hostname: string) => `oidc:${hostname}`;
const TRANSACTION_TTL = 10 * 60 * 1000;

// Explicit state and nonce supplement the library's existing S256 PKCE.
// The library stores them in the session and validates both at token exchange.
export class ProtectedOidcStrategy extends Strategy {
  authorizationRequestParams(req: Request, options: Parameters<Strategy["authorizationRequestParams"]>[1]) {
    const params = new URLSearchParams(super.authorizationRequestParams(req, options));
    params.set("state", client.randomState());
    params.set("nonce", client.randomNonce());
    (req.session as any).oidcStartedAt = Date.now();
    (req.session as any).oidcTransactionUsed = false;
    return params;
  }
}

export function validateOidcCallback(now = Date.now): RequestHandler {
  return (req, res, next) => {
    const session = req.session as any;
    const transaction = session?.[authSessionKey(req.hostname)];
    const expected = transaction?.state;
    const received = req.query.state;
    const age = now() - session?.oidcStartedAt;
    const provided = typeof received === "string" && received.length <= 256 ? Buffer.from(received) : undefined;
    const stored = typeof expected === "string" ? Buffer.from(expected) : undefined;
    const validState = provided && stored && provided.length === stored.length
      && timingSafeEqual(provided, stored);
    if (!validState || !transaction?.code_verifier || !transaction?.nonce
      || !Number.isFinite(age) || age < 0 || age >= TRANSACTION_TTL
      || session?.oidcTransactionUsed
      || (typeof req.query.code !== "string" && typeof req.query.error !== "string")) {
      return res.status(400).json({ message: "This sign-in request is invalid or expired. Please start sign-in again." });
    }
    session.oidcTransactionUsed = true;
    // Provider errors are terminal; never loop the visitor back into consent.
    if (req.query.error) {
      delete session[authSessionKey(req.hostname)];
      return res.redirect("/?signin=cancelled");
    }
    return next();
  };
}