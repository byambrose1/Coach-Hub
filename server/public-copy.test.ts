import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { publicSite } from "@shared/public-site";

test("website copy does not reintroduce the removed payment provider or unclear plan wording", () => {
  for (const path of [
    "shared/public-site.ts", "client/src/landing.tsx", "client/src/config/site.ts",
    "client/src/components/product-tour.tsx", "client/src/pages/payments.tsx",
    "client/src/pages/clients.tsx", "client/src/pages/admin.tsx",
    "client/src/pages/platform-admin.tsx", "server/public-pages.ts",
  ]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /gocardless|direct[- ]debit|coach-sized/i, path);
  }
  assert.match(publicSite.paymentProviderFees, /Stripe/);
});

test("the audience FAQ includes an easy client roster, calendar and the requested workflows", () => {
  const source = readFileSync("client/src/landing.tsx", "utf8");
  assert.match(source, /client roster with ease, without complicated infrastructure/);
  assert.match(source, /calendar, sessions, forms, invoices and payment workflows/);
  assert.match(source, /No customer logos or performance claims/);
});