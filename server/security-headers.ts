import type { RequestHandler } from "express";

export function securityHeaders(production = process.env.NODE_ENV === "production"): RequestHandler {
  return (_req, res, next) => {
    res.removeHeader("X-Powered-By");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Development must remain embeddable in Replit's Preview. Modern browsers
    // use frame-ancestors; SAMEORIGIN provides a production legacy fallback.
    if (production) res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev",
      "form-action 'self' https:",
      `script-src 'self'${production ? "" : " 'unsafe-inline' 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss:",
    ].join("; "));
    next();
  };
}