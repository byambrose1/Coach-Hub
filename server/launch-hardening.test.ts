import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import { securityHeaders } from "./security-headers";
import { renderPublicDocument } from "./public-pages";
import { publicMetadata, publicSite } from "@shared/public-site";
import { registerRoutes } from "./routes";

const template = '<html><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
const post: any = {
  id: "post-fixture", published: true, slug: "sample-guide", title: "Coach guide",
  excerpt: "A useful sample guide", seoTitle: "Sample guide | Practably",
  seoDescription: "A unique article description", contentMarkdown: "# A useful guide\n\nKeep good records.",
  publishedAt: new Date("2026-10-02"), authorName: "Practably",
};
const publicStorage: any = {
  getPlatformConfig: async () => ({}),
  getPublishedBlogPosts: async () => [post],
  getPublishedBlogPost: async (slug: string) => slug === post.slug ? post : undefined,
};

for (const pathname of Object.keys(publicMetadata)) {
  test(`crawlable HTML has unique metadata and real content for ${pathname}`, async () => {
    const page = await renderPublicDocument(template, `${pathname}?tracking=ignored`, publicStorage);
    assert.equal(page.status, 200);
    assert.ok(page.html.includes(`<title>${publicMetadata[pathname].title}</title>`));
    assert.ok(page.html.includes(`href="${publicSite.siteUrl}${pathname}"`));
    assert.ok(page.html.includes("<main"));
    assert.equal((page.html.match(/<title>/g) || []).length, 1);
    assert.equal((page.html.match(/name="description"/g) || []).length, 1);
    assert.ok(page.html.includes('name="twitter:title"'));
    assert.ok(!page.html.includes("tracking=ignored"));
  });
}
test("published article is rendered, missing/draft articles return noindex 404", async () => {
  const page = await renderPublicDocument(template, "/blog/sample-guide", publicStorage);
  assert.equal(page.status, 200);
  assert.ok(page.html.includes("Keep good records."));
  assert.ok(page.html.includes('content="article"'));
  assert.ok(page.html.includes('id="blog-post-jsonld"'));
  for (const pathname of ["/blog/missing", "/made-up"]) {
    const missing = await renderPublicDocument(template, pathname, publicStorage);
    assert.equal(missing.status, 404);
    assert.ok(missing.html.includes("noindex,nofollow"));
  }
  const draft = await renderPublicDocument(template, "/blog/draft", {
    ...publicStorage, getPublishedBlogPost: async () => ({ ...post, published: false }),
  });
  assert.equal(draft.status, 404);
  assert.ok(!draft.html.includes("Keep good records."));
});
test("metadata and article structured data cannot escape into executable HTML", async () => {
  const malicious = { ...post, title: '</script><script>alert(1)</script>', seoTitle: '"><script>alert(1)</script>', contentMarkdown: '<script>alert(1)</script>' };
  const page = await renderPublicDocument(template, "/blog/sample-guide", {
    ...publicStorage, getPublishedBlogPost: async () => malicious,
  });
  assert.ok(!page.html.includes("<script>alert(1)</script>"));
  assert.ok(page.html.includes("\\u003c"));
});
test("crawlable pricing follows the same configurable prices and client limits as the public API", async () => {
  const page = await renderPublicDocument(template, "/pricing", {
    ...publicStorage, getPlatformConfig: async () => ({ tier2Price: "2.49", tier2MaxClients: 12 }),
  });
  assert.ok(page.html.includes("Starter: £2.49 per month, up to 12 clients."));
  assert.ok(!page.html.includes("£1.99"));
});
test("signed-in workspace shells do not publish private content or index themselves", async () => {
  const page = await renderPublicDocument(template, "/clients/fixture", publicStorage);
  assert.equal(page.status, 200);
  assert.ok(page.html.includes('content="noindex,nofollow"'));
  assert.ok(page.html.includes('<div id="root"></div>'));
});
test("client form entry renders a noindex shell without private information", async () => {
  const page = await renderPublicDocument(template, "/f", publicStorage);
  assert.equal(page.status, 200);
  assert.ok(page.html.includes('content="noindex,nofollow"'));
  assert.ok(page.html.includes('<div id="root"></div>'));
});

test("public legal documents render their headings without unconfirmed review claims", async () => {
  for (const [pathname, title] of [["/terms", "Terms of Use"], ["/privacy", "Privacy"]]) {
    const page = await renderPublicDocument(template, pathname, publicStorage);
    assert.equal(page.status, 200);
    assert.ok(page.html.includes(`<h1>${title}</h1>`));
    assert.doesNotMatch(page.html, /solicitor|owner review|pre-launch legal review|terms require legal review|were reviewed for/i);
  }
});

let server: ReturnType<typeof createServer>;
let origin: string;
let cancelFails = true;
let deleted = 0;
let subscriptionStatus = "active";
let subscriptionOwner = "fixture-coach";
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/headers/production", securityHeaders(true), (_req, res) => res.send("ok"));
  app.use("/headers/development", securityHeaders(false), (_req, res) => res.send("ok"));
  server = createServer(app);
  const storage: any = {
    getClient: async () => ({ id: "client-fixture", name: "Sample", email: "sample@example.com" }),
    getSettings: async () => ({ stripeSubscriptionId: "sub_fixture", stripeCustomerId: "cus_fixture" }),
    deleteAccountData: async () => { deleted++; },
  };
  await registerRoutes(server, app, {
    storage,
    isAuthenticated: (req, _res, next) => {
      (req as any).user = { claims: { sub: "fixture-coach" } };
      (req as any).session = { destroy: (callback: () => void) => callback() };
      req.logout = (callback: (error?: any) => void) => callback();
      next();
    },
    deleteAuthUser: async () => {},
    stripeClient: { subscriptions: {
      retrieve: async () => ({ metadata: { userId: subscriptionOwner }, customer: "cus_fixture", status: subscriptionStatus }),
      cancel: async () => { if (cancelFails) throw new Error("Simulated provider failure"); return { status: "canceled" }; },
    } } as any,
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
test("production headers remove Express disclosure and unsafe inline script permission", async () => {
  const response = await fetch(`${origin}/headers/production`);
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(response.headers.get("content-security-policy")!, /script-src 'self';/);
  assert.ok(!response.headers.get("content-security-policy")!.includes("script-src 'self' 'unsafe-inline'"));
  const development = await fetch(`${origin}/headers/development`);
  assert.equal(development.headers.get("x-frame-options"), null);
  assert.ok(development.headers.get("content-security-policy")!.includes("https://*.replit.dev"));
});
test("retired payment-provider endpoints cannot initiate client collections", async () => {
  const status = await fetch(`${origin}/api/payments/status`);
  assert.equal(status.status, 404);
  const response = await fetch(`${origin}/api/payments/create-mandate-link`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: "client-fixture" }),
  });
  assert.equal(response.status, 404);
  const webhook = await fetch(`${origin}/api/webhooks/gocardless`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal(webhook.status, 404);
});
test("failed billing cancellation preserves account data; successful deletion remains available", async () => {
  const failure = await fetch(`${origin}/api/account`, { method: "DELETE" });
  assert.equal(failure.status, 502);
  assert.equal(deleted, 0);
  cancelFails = false;
  const success = await fetch(`${origin}/api/account`, { method: "DELETE" });
  assert.equal(success.status, 200);
  assert.equal(deleted, 1);
});
test("an already-cancelled subscription does not block deletion and another coach's subscription cannot be cancelled", async () => {
  subscriptionStatus = "canceled";
  cancelFails = true;
  const success = await fetch(`${origin}/api/account`, { method: "DELETE" });
  assert.equal(success.status, 200);
  const previousDeletes = deleted;
  subscriptionOwner = "another-coach";
  const failure = await fetch(`${origin}/api/account`, { method: "DELETE" });
  assert.equal(failure.status, 403);
  assert.equal(deleted, previousDeletes);
});