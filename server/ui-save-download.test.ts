import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheSavedRecord, queryClient, getQueryFn } from "../client/src/lib/queryClient";
import { createInvoicePdf, invoicePdfFilename } from "../client/src/lib/invoice-pdf";
import type { Invoice, Settings } from "@shared/schema";

test("saved client, package and note appear in cache before the next server read", async () => {
  for (const url of ["/api/clients", "/api/packages", "/api/notes"]) {
    queryClient.setQueryData([url], [{ id: "existing", name: "Kept record" }]);
    await cacheSavedRecord(url, { id: "new", name: "Saved record" });
    assert.deepEqual(queryClient.getQueryData([url]), [
      { id: "existing", name: "Kept record" }, { id: "new", name: "Saved record" },
    ]);
    await cacheSavedRecord(url, { id: "new", name: "Edited record" });
    assert.equal((queryClient.getQueryData<any[]>([url]) || []).length, 2);
    assert.equal(queryClient.getQueryData<any[]>([url])?.[1].name, "Edited record");
  }
  queryClient.clear();
});

test("an older in-flight read cannot replace a freshly saved record", async () => {
  let finish!: (records: any[]) => void;
  const read = queryClient.fetchQuery({ queryKey: ["/api/clients"], queryFn: () => new Promise(resolve => { finish = resolve; }) }).catch(() => {});
  await cacheSavedRecord("/api/clients", { id: "new" });
  finish([]);
  await read;
  assert.deepEqual(queryClient.getQueryData(["/api/clients"]), [{ id: "new" }]);
  queryClient.clear();
});

test("data reads bypass HTTP cache and honor request cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (async (_input, options) => {
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.signal, controller.signal);
    return Response.json([]);
  }) as typeof fetch;
  try {
    await getQueryFn({ on401: "throw" })({ queryKey: ["/api/clients"], signal: controller.signal } as any);
  } finally { globalThis.fetch = original; }
});

const invoice = {
  id: "invoice-fixture", clientId: "fixture-client", userId: "fixture-coach", packageId: null,
  invoiceNumber: "INV-1234", amount: "12.34", status: "pending", dueDate: "2026-10-10",
  sentDate: null, paidDate: null, notes: "Fixture coaching service", paymentMethod: null,
} satisfies Invoice;
test("invoice produces a real PDF containing the exact amount and payment information", () => {
  const settings = { currency: "£", businessName: "Fixture practice", acceptsBankTransfer: true, bankTransferDetails: "Fixture bank instructions" } as Settings;
  const bytes = Buffer.from(createInvoicePdf(invoice, "Fixture client", settings).output("arraybuffer"));
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const text = bytes.toString("latin1");
  for (const expected of ["12.34", "INV-1234", "Fixture practice", "Fixture client", "Fixture bank instructions", "10/10/2026"]) {
    assert.ok(text.includes(expected), expected);
  }
  assert.equal(invoicePdfFilename("../../unsafe/invoice"), "Invoice-______unsafe_invoice.pdf");
});
test("long invoice content paginates, treats HTML as text and cannot run scripts", () => {
  const doc = createInvoicePdf({ ...invoice, notes: "<script>alert('fixture')</script>\n" + "long description ".repeat(1000) }, "Fixture client");
  assert.ok(doc.getNumberOfPages() > 1);
  assert.doesNotMatch(doc.output(), /\/JavaScript|\/JS\b/);
  assert.throws(() => createInvoicePdf({ ...invoice, amount: "invalid" }, "Fixture client"));
});