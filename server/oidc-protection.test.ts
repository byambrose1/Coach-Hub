import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import * as client from "openid-client";
import { ProtectedOidcStrategy, authSessionKey, validateOidcCallback } from "./replit_integrations/auth/oidc-protection";

const key = authSessionKey("app.example");
const request = (session: any = {}, originalUrl = "/api/login"): any => ({
  session, originalUrl, protocol: "https", host: "app.example", hostname: "app.example",
  method: "GET", query: Object.fromEntries(new URL(originalUrl, "https://app.example").searchParams),
});
function gate(req: any, now = Date.now()) {
  const outcome: any = { next: false };
  const res: any = {
    status: (status: number) => { outcome.status = status; return res; },
    json: (body: any) => { outcome.body = body; },
    redirect: (url: string) => { outcome.redirect = url; },
  };
  validateOidcCallback(() => now)(req, res, () => { outcome.next = true; });
  return outcome;
}
function transact(strategy: ProtectedOidcStrategy, req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("OIDC fixture timed out")), 3000);
    const finish = (value: any) => { clearTimeout(timeout); resolve(value); };
    strategy.redirect = (url: string) => finish({ kind: "redirect", url });
    strategy.success = (user: any) => finish({ kind: "success", user });
    strategy.fail = () => finish({ kind: "failure" });
    strategy.error = (error: any) => finish({ kind: "error", code: error.code });
    strategy.authenticate(req, {});
  });
}
function fixture({ wrongNonce = false, invalidCode = false } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let nonce = "";
  let exchanges = 0;
  const config = new client.Configuration({
    issuer: "https://issuer.example", authorization_endpoint: "https://issuer.example/authorize",
    token_endpoint: "https://issuer.example/token", jwks_uri: "https://issuer.example/jwks",
    code_challenge_methods_supported: ["S256"],
  }, "fixture-client");
  config[client.customFetch] = async (url) => {
    if (String(url).endsWith("/jwks")) return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "fixture-key", alg: "RS256", use: "sig" }] });
    exchanges++;
    if (invalidCode) return Response.json({ error: "invalid_grant" }, { status: 400 });
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture-key" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: "https://issuer.example", aud: "fixture-client", sub: "fictional-coach",
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: wrongNonce ? "different-transaction" : nonce,
    })).toString("base64url");
    const unsigned = `${header}.${payload}`;
    const idToken = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
    return Response.json({ token_type: "Bearer", access_token: "fictional-access", refresh_token: "fictional-refresh", id_token: idToken, expires_in: 3600 });
  };
  const strategy = new ProtectedOidcStrategy({
    config, sessionKey: key, callbackURL: "https://app.example/api/callback",
    scope: "openid email profile offline_access",
  }, (tokens, verified) => verified(null, { id: tokens.claims()!.sub }));
  return { strategy, setNonce: (value: string) => { nonce = value; }, exchanges: () => exchanges };
}
test("authorization includes unique session-bound state, nonce and S256 PKCE", async () => {
  const { strategy } = fixture();
  const req = request();
  const first = new URL((await transact(strategy, req)).url);
  assert.ok(first.searchParams.get("state"));
  assert.ok(first.searchParams.get("nonce"));
  assert.equal(first.searchParams.get("code_challenge_method"), "S256");
  assert.equal(req.session[key].state, first.searchParams.get("state"));
  assert.equal(createHash("sha256").update(req.session[key].code_verifier).digest("base64url"), first.searchParams.get("code_challenge"));
  const second = new URL((await transact(strategy, req)).url);
  assert.notEqual(first.searchParams.get("state"), second.searchParams.get("state"));
  assert.notEqual(first.searchParams.get("nonce"), second.searchParams.get("nonce"));
  assert.equal(gate(request(req.session, `/api/callback?code=old&state=${first.searchParams.get("state")}`)).status, 400);
});
for (const scenario of ["missing-session", "wrong-state", "expired", "replayed", "missing-code", "unicode-state", "array-state"]) {
  test(`callback rejects ${scenario} before token exchange`, () => {
    const now = Date.now();
    const session: any = { oidcStartedAt: now, oidcTransactionUsed: false, [key]: { state: "expected", nonce: "nonce", code_verifier: "verifier" } };
    const req = request(session, "/api/callback?code=fixture&state=expected");
    if (scenario === "missing-session") req.session = {};
    if (scenario === "wrong-state") req.query.state = "different";
    if (scenario === "expired") session.oidcStartedAt -= 600_000;
    if (scenario === "replayed") session.oidcTransactionUsed = true;
    if (scenario === "missing-code") delete req.query.code;
    if (scenario === "unicode-state") req.query.state = "éxpected";
    if (scenario === "array-state") req.query.state = ["expected", "another"];
    assert.equal(gate(req, now).status, 400);
  });
}
test("denied consent safely returns to the app and consumes the transaction", () => {
  const session: any = { oidcStartedAt: Date.now(), [key]: { state: "expected", nonce: "nonce", code_verifier: "verifier" } };
  const result = gate(request(session, "/api/callback?error=access_denied&state=expected"));
  assert.equal(result.redirect, "/?signin=cancelled");
  assert.equal(session[key], undefined);
});
for (const scenario of ["successful-callback", "wrong-nonce", "invalid-code", "other-browser"]) {
  test(`OIDC library integration: ${scenario}`, async () => {
    const provider = fixture({ wrongNonce: scenario === "wrong-nonce", invalidCode: scenario === "invalid-code" });
    const req = request();
    const authorization = new URL((await transact(provider.strategy, req)).url);
    provider.setNonce(authorization.searchParams.get("nonce")!);
    const callback = request(scenario === "other-browser" ? {} : req.session, `/api/callback?code=fixture&state=${authorization.searchParams.get("state")}`);
    const result = await transact(provider.strategy, callback);
    if (scenario === "successful-callback") {
      assert.equal(result.kind, "success");
      assert.equal(result.user.id, "fictional-coach");
    } else assert.notEqual(result.kind, "success");
    if (scenario === "other-browser") assert.equal(provider.exchanges(), 0);
  });
}