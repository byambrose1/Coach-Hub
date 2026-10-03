// Every API request is intercepted. This test cannot change live client data,
// send emails or affect billing. It uses disposable, in-memory fixtures only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const WebSocket = require("ws");
const domain = process.env.REPLIT_DEV_DOMAIN;
assert.ok(domain, "Use development Preview, never production");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "practably-custom-forms-ui-"));
const chrome = spawn("chromium", ["--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const user = { id: "fixture-coach", email: "fixture@example.test", firstName: "Fixture" };
const client = { id: "fixture-client", userId: user.id, name: "Fixture Client", email: "private@example.test", status: "active" };
const settings = { id: user.id, subscriptionPlan: "free", hasAcceptedTerms: true, onboardingDismissed: true, trainerName: "Fixture Coach", currency: "£" };
let templates = [], requests = [], responses = [], tokens = new Map(), signedIn = true, failSubmission = false;
let socket, sequence = 0, templateCounter = 0, requestCounter = 0;
const pending = new Map(), unexpected = [];
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label) {
  for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await pause(100); }
  throw new Error("Timed out: " + label);
}
const q = selector => `document.querySelector(${JSON.stringify(selector)})`;
const testId = id => `[data-testid="${id}"]`;
async function click(selector) { await evaluate(`(()=>{const e=${q(selector)};e.focus();e.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));e.click();})()`); }
async function clickText(text) {
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(text)} && b.getBoundingClientRect().width>0 && !b.disabled)`, text);
  await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()===${JSON.stringify(text)} && b.getBoundingClientRect().width>0 && !b.disabled).at(-1).click()`);
}
async function fill(selector, value) {
  await evaluate(`(()=>{const e=${q(selector)};const prototype=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,"value").set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
}
function complete(request, answers) {
  request.status = "completed"; request.completedAt = new Date().toISOString();
  const form = {
    id: "custom-response-" + (responses.length + 1), userId: user.id, clientId: client.id,
    formType: "custom", title: request.title, status: "completed", date: "2026-10-03",
    responses: JSON.stringify(request.questions.map(question => ({
      question: question.label, answer: Array.isArray(answers[question.id]) ? answers[question.id].join(", ") : answers[question.id] || "",
    }))),
  };
  responses.push(form); request.clientFormId = form.id;
  return { request, form };
}
async function fulfill(event) {
  const { request, requestId } = event;
  const url = new URL(request.url), method = request.method;
  const body = request.postData ? JSON.parse(request.postData) : {};
  let status = 200, data = [];
  if (method === "GET" && ["/api/auth/status", "/api/auth/user"].includes(url.pathname)) data = signedIn ? user : null;
  else if (method === "GET" && url.pathname === "/api/settings") data = settings;
  else if (method === "GET" && url.pathname === "/api/clients") data = [client];
  else if (method === "GET" && url.pathname === "/api/forms") data = [...responses];
  else if (url.pathname === "/api/form-templates") {
    if (method === "GET") data = structuredClone(templates);
    else if (method === "POST") {
      data = { ...body, id: "template-" + (++templateCounter), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      templates.push(data); status = 201;
    }
  } else if (url.pathname.startsWith("/api/form-templates/")) {
    const id = url.pathname.split("/").pop(), existing = templates.find(template => template.id === id);
    if (method === "PATCH") { Object.assign(existing, body); data = structuredClone(existing); }
    else if (method === "DELETE") { templates = templates.filter(template => template.id !== id); requests.forEach(request => { if (request.templateId === id) request.templateId = null; }); status = 204; }
  } else if (url.pathname === "/api/form-requests") {
    if (method === "GET") data = structuredClone(requests);
    else if (method === "POST") {
      const template = templates.find(template => template.id === body.templateId);
      const record = { ...structuredClone(template), id: "request-" + (++requestCounter), templateId: template.id, clientId: client.id, status: "pending", expiresAt: "2099-10-03T00:00:00Z", completedAt: null, clientFormId: null };
      requests.push(record);
      const token = requestCounter.toString(16).padStart(64, "0");
      tokens.set(token, record);
      data = { request: record, token }; status = 201;
    }
  } else if (url.pathname.startsWith("/api/form-requests/")) {
    const id = url.pathname.split("/")[3], record = requests.find(request => request.id === id);
    if (url.pathname.endsWith("/complete")) data = complete(record, body.answers);
    else if (url.pathname.endsWith("/revoke")) { record.status = "revoked"; data = record; }
  } else if (url.pathname.startsWith("/api/public-forms/")) {
    const record = tokens.get(body.token);
    if (!record || record.status !== "pending") { status = 404; data = { message: "This form link is unavailable or has already been completed." }; }
    else if (url.pathname.endsWith("/load")) data = { title: record.title, description: record.description, questions: record.questions, expiresAt: record.expiresAt };
    else if (failSubmission) { failSubmission = false; status = 500; data = { message: "Simulated unavailable connection" }; }
    else { complete(record, body.answers); data = { message: "Form submitted." }; }
  } else if (method === "POST" && url.pathname === "/api/activation-events") status = 204;
  else if (method !== "GET") { status = 403; data = { message: "Blocked by isolated test" }; unexpected.push(method + " " + url.pathname); }
  await cdp("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(status === 204 ? "" : JSON.stringify(data)).toString("base64") });
}
async function navigate(route, width = 390) {
  await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp("Page.navigate", { url: `https://${domain}${route}` });
}
async function openForms() {
  await navigate("/clients");
  await waitFor(`!!${q(testId("card-client-fixture-client"))}`, "Fixture client");
  await click(testId("card-client-fixture-client"));
  await waitFor(`!!${q(testId("tab-client-forms"))}`, "Client profile");
  await click(testId("tab-client-forms"));
  await waitFor(`!!document.querySelector('[aria-label="Custom client forms"]')`, "Forms panel");
}
async function screenshot(name) {
  const image = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  const file = path.join(profile, name + ".jpg"); fs.writeFileSync(file, Buffer.from(image.data, "base64"));
  console.log("Fixture screenshot: " + file);
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
    else if (message.method === "Fetch.requestPaused") fulfill(message.params).catch(error => { if (!/Invalid InterceptionId|Invalid interception|Invalid requestId/i.test(error.message)) unexpected.push(error.message); });
    else if (message.method === "Runtime.exceptionThrown") unexpected.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `window.fixtureErrors=[];window.addEventListener("error",e=>window.fixtureErrors.push(e.message));window.addEventListener("unhandledrejection",e=>window.fixtureErrors.push(String(e.reason)));` });
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  await openForms();
  await clickText("New template");
  await fill("#custom-template-title", "Fixture intake");
  await fill("#custom-template-description", "Fictional information only");
  await clickText("Add question");
  await fill('input[aria-label="Question 1 wording"]', "Fixture goals");
  await clickText("Add question");
  await fill('input[aria-label="Question 2 wording"]', "Fixture ready");
  await evaluate(`(()=>{const e=document.querySelectorAll('[aria-label="Question type"]')[1];e.focus();e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()`);
  await waitFor(`!!document.querySelector('[role="option"]')`, "Question choices");
  await evaluate(`(()=>{const e=[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==="Yes / no");e.focus();e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()`);
  await evaluate(`document.querySelectorAll('[aria-label="Move question up"]')[1].click()`);
  await waitFor(`${q('input[aria-label="Question 1 wording"]')}.value==="Fixture ready"`, "Question reordering");
  await clickText("Save template");
  await waitFor(`!${q("#custom-template-title")}`, "Template saved");
  assert.equal(templates.length, 1);
  assert.equal(templates[0].questions[0].type, "yes_no");
  await clickText("Edit");
  await fill("#custom-template-title", "Updated fixture intake");
  await clickText("Save template");
  await waitFor(`!${q("#custom-template-title")}`, "Template edited");
  await clickText("Enter answers");
  await waitFor(`!!${q('input[id^="answer-"]')}`, "Coach answer fields");
  await clickText("No");
  await fill('input[id^="answer-"]', "Fictional coach-entered goal");
  await clickText("Save responses");
  await waitFor(`!!${q(testId("form-item-custom-response-1"))}`, "Coach responses saved");
  await clickText("View responses");
  await waitFor(`document.body.innerText.includes("Fictional coach-entered goal")`, "Custom response viewer");
  await clickText("Close");
  await clickText("Send link");
  await clickText("Create private client link");
  await waitFor(`!!${q('input[aria-label="Private form link"]')}`, "Private link");
  const link = await evaluate(`${q('input[aria-label="Private form link"]')}.value`);
  assert.equal(new URL(link).pathname, "/f");
  assert.equal(new URL(link).hash.length, 65);
  await clickText("Close without copying");
  await screenshot("coach-mobile-forms");
  signedIn = false;
  await navigate("/f" + new URL(link).hash);
  await waitFor(`!!${q('input[id^="answer-"]')}`, "Signed-out client form");
  assert.equal(await evaluate("window.location.hash"), "");
  assert.ok(!await evaluate(`document.body.innerText.includes(${JSON.stringify(client.name)})`));
  assert.ok(!await evaluate(`document.body.innerText.includes(${JSON.stringify(client.email)})`));
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"));
  await clickText("Yes");
  await fill('input[id^="answer-"]', "Fictional client-entered goal");
  await screenshot("client-mobile-form");
  failSubmission = true;
  await clickText("Submit form");
  await waitFor(`document.body.innerText.includes("couldn’t submit")`, "Failed submit message");
  assert.equal(await evaluate(`${q('input[id^="answer-"]')}.value`), "Fictional client-entered goal");
  await clickText("Submit form");
  await waitFor(`document.body.innerText.includes("Form submitted")`, "Client completion");
  assert.ok(!await evaluate(`document.body.innerText.includes("Fictional client-entered goal")`));
  assert.equal(responses.length, 2);
  await navigate("/f" + new URL(link).hash);
  await waitFor(`document.body.innerText.includes("This form isn’t available")`, "Used link blocked");
  signedIn = true;
  await openForms();
  await clickText("Send link"); await clickText("Create private client link");
  await waitFor(`!!${q('input[aria-label="Private form link"]')}`, "Second private link");
  await clickText("Close without copying");
  await click('[aria-label="Revoke link"]');
  await waitFor(`document.body.innerText.includes("revoked")`, "Link revoked");
  await click('[aria-label="Delete Updated fixture intake"]');
  await clickText("Delete template");
  await waitFor(`document.body.innerText.includes("Start with a form you use often.")`, "Template deleted");
  assert.equal(templates.length, 0);
  assert.equal(responses.length, 2, "Template deletion preserves completed responses");
  assert.deepEqual(unexpected, []);
  assert.deepEqual(await evaluate("window.fixtureErrors"), []);
  console.log("Custom forms browser checks passed: create/edit/reorder/delete templates, coach and signed-out client completion, response viewing, failed-submit recovery, private-link handling, mobile layout and revocation.");
  console.log("All API calls were intercepted; no live records, accounts, emails or payments were used.");
})().catch(async error => {
  console.error(error.stack);
  console.error("Isolated browser errors:", JSON.stringify(unexpected));
  if (socket?.readyState === WebSocket.OPEN) console.error("Isolated page errors:", await evaluate("JSON.stringify(window.fixtureErrors)").catch(() => ""));
  if (socket?.readyState === WebSocket.OPEN) await screenshot("failure").catch(() => {});
  process.exitCode = 1;
}).finally(() => { socket?.close(); chrome.kill("SIGTERM"); });