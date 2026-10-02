// Every API request is fulfilled locally. No live coach data, health forms,
// emails, payments, refunds or deletions can be changed by this browser test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const WebSocket = require("ws");
const domain = process.env.REPLIT_DEV_DOMAIN;
assert.ok(domain, "Use development Preview, never production");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "practably-save-ui-"));
const downloads = path.join(profile, "downloads");
fs.mkdirSync(downloads);
const chrome = spawn("chromium", ["--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const user = { id: "fixture-coach", email: "fixture@example.test", firstName: "Fixture", isImpersonating: false };
const clients = [], packages = [], notes = [];
const invoice = { id: "fixture-invoice", userId: user.id, clientId: "fixture-client", invoiceNumber: "INV-1234", amount: "12.34", status: "pending", dueDate: "2099-10-10", notes: "Fixture service" };
const settings = { id: user.id, trainerName: "Fixture Coach", businessName: "Fixture practice", currency: "£", hasAcceptedTerms: true, onboardingDismissed: true, subscriptionPlan: "free", lowSessionThreshold: 2, enableEmailNotifications: false };
let socket, sequence = 0, delayReads = false;
const pending = new Map(), unexpected = [], writes = [];
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
async function waitFor(expression, label) {
  for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(60); }
  throw new Error(`Timed out: ${label}`);
}
const selector = id => `[data-testid="${id}"]`;
const exists = id => `!!document.querySelector(${JSON.stringify(selector(id))})`;
async function click(css) {
  await evaluate(`document.querySelector(${JSON.stringify(css)}).scrollIntoView({block:"center",behavior:"instant"})`);
  await pause(150);
  const bounds = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(css)}); if(!e||e.disabled)throw Error("Missing/disabled control");const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...bounds });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...bounds });
}
async function fill(id, value) {
  await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector(id))});const prototype=e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,"value").set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
}
async function fulfill(event) {
  const { request, requestId } = event;
  const url = new URL(request.url), method = request.method;
  let status = 200, data = [];
  const resources = { "/api/clients": clients, "/api/packages": packages, "/api/notes": notes };
  if (method === "GET" && ["/api/auth/status", "/api/auth/user"].includes(url.pathname)) data = user;
  else if (method === "GET" && url.pathname === "/api/settings") data = settings;
  else if (method === "GET" && url.pathname === "/api/payments/status") data = { directDebitAvailable: false, message: "Direct debit setup and collection are not available. Use your own payment arrangements." };
  else if (method === "GET" && url.pathname === "/api/invoices") data = [invoice];
  else if (resources[url.pathname]) {
    if (method === "GET") {
      data = [...resources[url.pathname]];
      if (delayReads) await pause(1600);
    } else if (method === "POST") {
      const body = JSON.parse(request.postData);
      const id = { "/api/clients": "fixture-client", "/api/packages": "fixture-package", "/api/notes": "fixture-note" }[url.pathname];
      data = { ...body, id, userId: user.id };
      resources[url.pathname].push(data);
      writes.push(url.pathname);
      delayReads = true;
    } else { status = 403; data = { message: "Blocked by isolated test" }; unexpected.push(method + " " + url.pathname); }
  } else if (method === "POST" && url.pathname === "/api/activation-events") status = 204;
  else if (method !== "GET") { status = 403; unexpected.push(method + " " + url.pathname); data = { message: "Blocked by isolated test" }; }
  await cdp("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(status === 204 ? "" : JSON.stringify(data)).toString("base64") });
}
async function navigate(route, width = 1280) {
  delayReads = false;
  await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp("Page.navigate", { url: `https://${domain}${route}` });
}
(async () => {
  let port;
  for (let i = 0; i < 100; i++) { try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; break; } catch { await pause(100); } }
  assert.ok(port);
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  socket.on("message", raw => {
    const message = JSON.parse(raw), call = pending.get(message.id);
    if (call) { pending.delete(message.id); clearTimeout(call.timer); message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result); }
    else if (message.method === "Fetch.requestPaused") fulfill(message.params).catch(error => {
      if (!/Invalid InterceptionId|Invalid interception|Invalid requestId/i.test(error.message)) unexpected.push(error.message);
    });
    else if (message.method === "Runtime.exceptionThrown") unexpected.push(message.params.exceptionDetails.text);
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  await navigate("/clients");
  await waitFor(exists("button-add-client"), "Client page");
  await click(selector("button-add-client")); await fill("input-client-name", "Fixture Client");
  await click(selector("button-submit-client"));
  await waitFor(exists("card-client-fixture-client"), "New client appears without refresh");
  await waitFor(`!document.querySelector('[role="dialog"]')`, "Create dialog closes");
  await click(selector("card-client-fixture-client"));
  await waitFor(exists("tab-client-notes"), "Client details");
  await click(selector("tab-client-notes"));
  await waitFor(exists("input-new-note"), "Note input");
  await fill("input-new-note", "Fixture non-health note");
  await click(selector("button-add-note"));
  await waitFor(exists("note-item-fixture-note"), "Saved note appears without refresh");
  await navigate("/payments");
  await waitFor(exists("button-add-package"), "Payments page");
  await click(selector("button-add-package")); await click(selector("select-package-client"));
  await waitFor(`!!document.querySelector('[role="option"]')`, "Client selection");
  await click('[role="option"]'); await fill("input-package-name", "Fixture Package"); await fill("input-package-price", "12.34");
  await click(selector("button-submit-package"));
  await waitFor(exists("card-package-fixture-package"), "Saved package appears without refresh");
  await waitFor(`!document.querySelector('[role="dialog"]')`, "Package dialog closes");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector("stat-pending-invoices"))}).textContent`), "£12.34");
  await click(selector("tab-invoices"));
  await waitFor(exists("card-invoice-fixture-invoice"), "Invoice list");
  await click(selector("card-invoice-fixture-invoice"));
  await waitFor(exists("button-download-invoice"), "Invoice detail");
  await click(selector("button-download-invoice"));
  for (let i = 0; i < 100 && !fs.existsSync(path.join(downloads, "Invoice-INV-1234.pdf")); i++) await pause(100);
  const bytes = fs.readFileSync(path.join(downloads, "Invoice-INV-1234.pdf"));
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.toString("latin1").includes("12.34"));
  await navigate("/payments", 390);
  await waitFor(exists("tab-monthly"), "Mobile payments page");
  await click(selector("tab-monthly"));
  await waitFor(exists("direct-debit-availability"), "Unavailable direct debit");
  assert.ok(await evaluate(`document.querySelector(${JSON.stringify(selector("direct-debit-availability"))}).textContent.includes("not available")`));
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Mobile page fits");
  assert.deepEqual(writes, ["/api/clients", "/api/notes", "/api/packages"]);
  assert.deepEqual(unexpected, []);
  const screenshot = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  fs.writeFileSync(path.join(profile, "mobile-payments.jpg"), Buffer.from(screenshot.data, "base64"));
  console.log(`Fixture screenshot: ${path.join(profile, "mobile-payments.jpg")}`);
  console.log("Browser checks passed: client/note/package saves without refresh, £12.34 summary, actual PDF file download, mobile direct-debit wording.");
  console.log("All API requests were intercepted; no live records, emails, payments or deletions occurred.");
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  socket?.close(); chrome.kill("SIGTERM");
  for (const call of pending.values()) clearTimeout(call.timer);
});