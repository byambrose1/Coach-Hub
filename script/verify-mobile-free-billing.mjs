// Isolated UI validation: every API request is mocked; no real customer,
// booking, billing, or refund operation can be sent to the application.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import WebSocket from "ws";

const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
assert.ok(process.env.REPLIT_DEV_DOMAIN, "Development domain is required");
const profile = await mkdtemp(`${tmpdir()}/practably-ui-`);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--remote-debugging-port=9227", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
try {
  let tabs;
  for (let i = 0; i < 60; i++) {
    try { tabs = await (await fetch("http://127.0.0.1:9227/json/list")).json(); break; } catch { await sleep(100); }
  }
  assert.ok(tabs?.length, "Chromium did not start");
  const tab = tabs.find(tab => tab.type === "page" && tab.url === "about:blank");
  assert.ok(tab, "No browser page target was available");
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.once("open", resolve));
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const user = { id: "ui-coach", email: "test@example.invalid", firstName: "Test" };
  const settings = { id: "ui-settings", userId: user.id, subscriptionPlan: "free",
    subscriptionStatus: "trial", stripeCustomerId: "cus_stale", termsAccepted: true, hasAcceptedTerms: true };
  const apiCalls = [];
  const documentId = "11111111-1111-4111-8111-111111111111";
  const documentQuestion = { id: "evidence", label: "Supporting document", type: "file", required: true };
  const formTemplate = { id: "ui-template", title: "Private document check", description: "Synthetic upload test", questions: [documentQuestion], createdAt: "", updatedAt: "" };
  const documentMeta = { id: documentId, fileName: "evidence.pdf", mediaType: "application/pdf", byteSize: 35 };
  const completedForm = { id: "ui-form", clientId: "ui-client", formType: "custom", title: formTemplate.title,
    status: "completed", date: "2026-10-05", responses: JSON.stringify([{ question: documentQuestion.label, answer: documentMeta.fileName, documentId }]) };
  let publicSubmitted = false, coachRequest, coachCompleted = false;
  let interceptedError;
  ws.on("message", async bytes => {
    const message = JSON.parse(bytes.toString());
    if (message.id) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) call?.reject(new Error(message.error.message)); else call?.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      try {
        const { requestId, request } = message.params;
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) {
          apiCalls.push({ path: url.pathname, method: request.method, body: request.postData });
          let data = [];
          let responseCode = 200;
          if (url.pathname.startsWith("/api/auth/")) data = user;
          if (url.pathname === "/api/settings") data = settings;
          if (url.pathname === "/api/admin/stats") data = {};
          if (url.pathname === "/api/clients") data = [{ id: "ui-client", name: "Example Client", status: "active" }];
          if (url.pathname === "/api/subscription/status") data = { ready: true, livemode: true,
            checkoutPaused: false, billingCustomerNeedsReconnect: true };
          if (url.pathname === "/api/subscription/refund") data = { state: "ineligible",
            message: "You have no paid subscription payment to refund yet. The 24-hour guarantee starts after your first subscription payment." };
          if (url.pathname === "/api/subscription/tiers") data = [
            { name: "free", label: "Free", max: 5, price: "0" },
            { name: "starter", label: "Starter", max: 10, price: "1.99" },
            { name: "professional", label: "Professional", max: 20, price: "4.99" },
            { name: "business", label: "Business", max: 50, price: "7.99" },
          ];
          if (url.pathname === "/api/subscription/checkout") data = { url: `${origin}/mock-checkout-complete` };
          if (url.pathname === "/api/form-templates") data = [formTemplate];
          if (url.pathname === "/api/forms") data = coachCompleted ? [completedForm] : [];
          if (url.pathname === "/api/form-requests") {
            if (request.method === "POST") {
              coachRequest = { ...formTemplate, id: "ui-request", templateId: formTemplate.id, clientId: "ui-client",
                status: "pending", completedAt: null, clientFormId: null, expiresAt: "2026-11-05T12:00:00Z" };
              data = { request: coachRequest, token: "b".repeat(64) }; responseCode = 201;
            } else data = coachRequest ? [coachRequest] : [];
          }
          if (url.pathname === "/api/form-requests/ui-request/complete") {
            coachCompleted = true;
            coachRequest = { ...coachRequest, status: "completed", clientFormId: completedForm.id };
            data = { request: coachRequest, form: completedForm };
          }
          if (url.pathname === "/api/public-forms/load") {
            data = publicSubmitted ? { message: "Form unavailable" } : { ...formTemplate, expiresAt: "2026-11-05T12:00:00Z" };
            if (publicSubmitted) responseCode = 404;
          }
          if (url.pathname === "/api/public-forms/documents" || url.pathname === "/api/form-requests/ui-request/documents") {
            await sleep(500); data = documentMeta; responseCode = 201;
          }
          if (url.pathname === `/api/public-forms/documents/${documentId}` && request.method === "DELETE") {
            await sleep(300); responseCode = 204;
          }
          if (url.pathname === "/api/public-forms/submit") { publicSubmitted = true; data = { message: "Form submitted." }; }
          await send("Fetch.fulfillRequest", { requestId, responseCode,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: responseCode === 204 ? "" : Buffer.from(JSON.stringify(data)).toString("base64") });
        } else if (url.origin !== origin) {
          await send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
        } else await send("Fetch.continueRequest", { requestId });
      } catch (error) {
        // Navigation may cancel a paused request before it can be fulfilled.
        // That request is gone; do not forward it or retry against the server.
        if (error.message !== "Invalid InterceptionId.") interceptedError = error;
      }
    }
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 100; i++) {
      if (interceptedError) throw interceptedError;
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    console.error(await evaluate(`JSON.stringify({url:location.href,text:document.body.textContent.slice(0,700)})`));
    console.error("Intercepted API paths:", apiCalls.map(c => c.path));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'})`);
    await sleep(100);
    const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e)throw Error('Missing control'); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: origin });
  await wait(`!!document.querySelector('[data-testid="button-sidebar-toggle"]')`);
  assert.ok(await evaluate(`document.querySelector('[data-testid="button-sidebar-toggle"]').getBoundingClientRect().height>=44`));
  await click('[data-testid="button-sidebar-toggle"]');
  await wait(`!!document.querySelector('[role="dialog"]')`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(400);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.includes('Quick Book')).click()`);
  await wait(`!!document.querySelector('[data-testid="input-quickbook-date"]')`);
  for (const width of [390, 320]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(100);
    assert.ok(await evaluate(`(()=>{const d=document.querySelector('[data-testid="input-quickbook-date"]').getBoundingClientRect(); const t=document.querySelector('[data-testid="select-quickbook-type"]').getBoundingClientRect(); const dialog=document.querySelector('[role="dialog"]'); return t.top>=d.bottom && dialog.scrollWidth<=dialog.clientWidth+1;})()`), `Booking controls overlap at ${width}px`);
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/practably-mobile-booking.png", Buffer.from(shot.data, "base64"));
  await send("Page.navigate", { url: `${origin}/settings` });
  await wait(`!!document.querySelector('[data-testid="button-upgrade-starter"]')`);
  await wait(`document.body.textContent.includes('No payment to refund')`);
  assert.ok(await evaluate(`!document.body.textContent.includes('Refund eligibility is unavailable') && !document.body.textContent.includes('Manage billing')`));
  assert.ok(await evaluate(`!document.querySelector('[data-testid="button-upgrade-starter"]').disabled`));
  await evaluate(`document.querySelector('[data-testid="button-upgrade-starter"]').scrollIntoView({block:'center',behavior:'instant'})`);
  await sleep(100);
  const settingsShot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/practably-mobile-settings.png", Buffer.from(settingsShot.data, "base64"));
  await click('[data-testid="button-upgrade-starter"]');
  await wait(`location.pathname==='/mock-checkout-complete'`);
  assert.equal(JSON.parse(apiCalls.find(c => c.path === "/api/subscription/checkout").body).plan, "starter");
  for (const width of [320, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const [path, action] of [
      ["/clients", '[data-testid="button-add-client"]'],
      ["/payments", '[data-testid="button-add-invoice"]'],
      ["/schedule", '[data-testid="button-new-session"]'],
      ["/settings", null],
      ["/admin", null],
    ]) {
      await send("Page.navigate", { url: `${origin}${path}` });
      await wait(`!!document.querySelector('main h1')`);
      await sleep(200);
      assert.ok(await evaluate(`(()=>{const m=document.querySelector('main');return document.documentElement.scrollWidth<=innerWidth+1 && m.scrollWidth<=m.clientWidth+1;})()`), `${path} overflows at ${width}px`);
      if (action) {
        await wait(`!!document.querySelector(${JSON.stringify(action)})`);
        await click(action);
        await wait(`!!document.querySelector('[role="dialog"]')`);
        assert.ok(await evaluate(`(()=>{const d=document.querySelector('[role="dialog"]'); const r=d.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1 && r.height<=innerHeight && d.scrollWidth<=d.clientWidth+1;})()`), `${path} dialog overflows at ${width}px`);
        if (path === "/schedule") {
          assert.ok(await evaluate(`(()=>{const d=document.querySelector('[data-testid="input-session-date"]').getBoundingClientRect();const t=document.querySelector('[data-testid="select-session-type"]').getBoundingClientRect();return t.top>=d.bottom;})()`));
        }
      }
      const screenshot = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(`/tmp/practably-mobile-${path.slice(1)}-${width}.png`, Buffer.from(screenshot.data, "base64"));
    }
  }
  console.log("PASS: simulated mobile Menu/drawer, booking at 390/320px, Free refund state, enabled Upgrade and intercepted checkout redirect.");
  console.log("PASS: Clients, Payments, Schedule, Settings, Admin and add-client/invoice/session dialogs at 320/390px without page or dialog overflow.");
  const fixture = `${profile}/evidence.pdf`;
  await writeFile(fixture, "%PDF-1.7\nSynthetic UI fixture\n%%EOF\n");
  const attachFile = async () => {
    const { root } = await send("DOM.getDocument");
    const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "#document-evidence" });
    assert.ok(nodeId, "The upload input must exist");
    await send("DOM.setFileInputFiles", { nodeId, files: [fixture] });
  };
  await send("Page.navigate", { url: `${origin}/f#${"a".repeat(64)}` });
  await wait(`!!document.querySelector('#document-evidence')`);
  await click('button[type="submit"]');
  await wait(`document.body.innerText.includes('Please answer: Supporting document')`);
  assert.ok(!apiCalls.some(c => c.path === "/api/public-forms/submit"), "Required file must prevent empty submission");
  await attachFile();
  await wait(`document.querySelector('button[type="submit"]').disabled`);
  await wait(`!!document.querySelector('button[aria-label="Remove evidence.pdf"]') && !document.querySelector('button[type="submit"]').disabled`);
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`), "Upload controls must fit at 390px");
  await click('button[aria-label="Remove evidence.pdf"]');
  await wait(`document.querySelector('button[type="submit"]').disabled`);
  await wait(`!!document.querySelector('#document-evidence') && !document.querySelector('button[type="submit"]').disabled`);
  await attachFile();
  await wait(`!!document.querySelector('button[aria-label="Remove evidence.pdf"]') && !document.querySelector('button[type="submit"]').disabled`);
  const uploadShot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/practably-private-upload.png", Buffer.from(uploadShot.data, "base64"));
  await click('button[type="submit"]');
  await wait(`document.body.innerText.includes('Form submitted')`);
  const submission = JSON.parse(apiCalls.find(c => c.path === "/api/public-forms/submit").body);
  assert.equal(submission.answers.evidence, documentId);
  await send("Page.navigate", { url: `${origin}/f#${"a".repeat(64)}` });
  await wait(`document.body.innerText.includes('This form isn’t available')`);
  await send("Page.navigate", { url: `${origin}/clients?client=ui-client` });
  await wait(`!!document.querySelector('[data-testid="tab-client-forms"]')`);
  await click('[data-testid="tab-client-forms"]');
  await wait(`document.body.innerText.includes('Basic forms are included on Free')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Enter answers').click()`);
  await wait(`!!document.querySelector('#document-evidence')`);
  await attachFile();
  await wait(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Save responses'))?.disabled`);
  await wait(`!!document.querySelector('button[aria-label="Remove evidence.pdf"]') && !Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Save responses')).disabled`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Save responses').click()`);
  await wait(`document.body.innerText.includes('Responses saved')`);
  await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='View responses')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='View responses').click()`);
  await wait(`!!document.querySelector('a[href="/api/form-documents/${documentId}/download"]')`);
  const coachSubmission = JSON.parse(apiCalls.find(c => c.path === "/api/form-requests/ui-request/complete").body);
  assert.equal(coachSubmission.answers.evidence, documentId);
  const createIndex = apiCalls.findIndex(c => c.path === "/api/form-requests" && c.method === "POST");
  const uploadIndex = apiCalls.findIndex(c => c.path === "/api/form-requests/ui-request/documents");
  assert.ok(createIndex >= 0 && uploadIndex > createIndex, "Coach must get a real form request before uploading");
  console.log("PASS: Free custom forms, required file validation, client upload/remove/upload/submit, busy-submit guards, used-link rejection, coach entry with a real request and private completed-document download link.");
  console.log("No real API calls or payments were made. Booking screenshot: /tmp/practably-mobile-booking.png");
} finally {
  ws?.close();
  chrome.kill();
  await sleep(200);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}