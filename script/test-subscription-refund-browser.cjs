// Isolated UI regression check. Every /api request is fulfilled locally:
// no login, charge, refund, cancellation, or database write can reach the app.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const WebSocket = require("ws");

const domain = process.env.REPLIT_DEV_DOMAIN;
assert.ok(domain, "Run against the Replit development Preview, never production.");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "practably-refund-ui-"));
const chrome = spawn("chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0",
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let fixture;
let sequence = 0;
let navigation = 0;
const requests = new Map();
const unexpected = [];
const blockedBillingRequests = [];
const postBodies = [];
const eligible = () => ({
  state: "eligible", amount: 199, currency: "gbp",
  paidAt: new Date(Date.now() - 3_600_000).toISOString(),
  expiresAt: new Date(Date.now() + 23 * 3_600_000).toISOString(),
  subscriptionCancelled: false,
});
const user = {
  id: "refund-ui-fixture", email: "coach@example.com", firstName: "Sample",
  lastName: "Coach", profileImageUrl: null, createdAt: null, updatedAt: null,
  isImpersonating: false, impersonatedUserId: null, impersonatedUserName: null,
};
const settings = () => ({
  id: user.id, trainerName: "Sample Coach", businessName: "Sample practice",
  trainerEmail: user.email, trainerPhone: "", businessAddress: "",
  cancellationPolicy: "", cancellationNoticeHours: 24, currency: "GBP",
  timezone: "Europe/London", subscriptionPlan: fixture.plan,
  subscriptionStatus: fixture.plan === "free" ? "canceled" : "active",
  stripeCustomerId: "cus_fixture", stripeSubscriptionId: "sub_fixture",
  hasAcceptedTerms: true, termsAccepted: true, termsAcceptedVersion: "2026-10-02", onboardingDismissed: true,
  lowSessionThreshold: 2, reminderHoursBefore: 24, dataRetentionDays: 365,
  enableEmailNotifications: true, enableSessionReminders: true,
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      requests.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 15_000);
    requests.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await evaluate(expression)) return;
    await pause(75);
  }
  throw new Error(`Timed out: ${label}`);
}
const selector = testId => `[data-testid="${testId}"]`;
const exists = testId => `!!document.querySelector(${JSON.stringify(selector(testId))})`;
async function click(testId) {
  const bounds = await evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector(testId))});
    if (!button || button.disabled) throw new Error("Button missing or disabled");
    button.scrollIntoView({block:"center"});
    const r = button.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...bounds });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...bounds });
}
async function fulfill(event) {
  const url = new URL(event.request.url);
  const method = event.request.method;
  let status = 200;
  let data;
  if (url.pathname === "/api/subscription/refund") {
    if (method === "GET") {
      status = fixture.getError ? 502 : 200;
      data = fixture.getError ? { message: "Simulated temporary eligibility failure" } : fixture.refund;
    } else if (method === "POST") {
      const body = JSON.parse(event.request.postData || "{}");
      postBodies.push(body);
      assert.deepEqual(body, { confirm: true });
      await pause(450);
      if (fixture.postFails) {
        fixture.postFails = false;
        fixture.refund = { ...fixture.refund, state: "processing", subscriptionCancelled: false };
        status = 502;
        data = { message: "Simulated cancellation failure after the refund request" };
      } else {
        fixture.plan = "free";
        fixture.refund = {
          ...fixture.refund, state: fixture.postPending ? "processing" : "completed",
          subscriptionCancelled: true,
        };
        data = fixture.refund;
      }
    } else {
      status = 403;
      data = { message: "Blocked by isolated UI test" };
    }
  } else if (method === "GET" && ["/api/auth/status", "/api/auth/user"].includes(url.pathname)) {
    data = user;
  } else if (method === "GET" && url.pathname === "/api/settings") {
    data = settings();
  } else if (method === "GET" && url.pathname === "/api/subscription/status") {
    data = { ready: true, livemode: false };
  } else if (method === "GET" && url.pathname === "/api/subscription/tiers") {
    data = [
      { name: "free", label: "Free", max: 5, price: "0" },
      { name: "starter", label: "Starter", max: 10, price: "1.99" },
      { name: "professional", label: "Professional", max: 20, price: "4.99" },
      { name: "business", label: "Business", max: 50, price: "7.99" },
    ];
  } else if (url.pathname.startsWith("/api/subscription/")) {
    blockedBillingRequests.push({ method, path: url.pathname });
    status = 403;
    data = { message: "Blocked by isolated UI test" };
  } else if (method === "POST" && url.pathname === "/api/activation-events") {
    status = 204;
  } else if (method === "GET") {
    data = [];
  } else {
    status = 403;
    data = { message: "Blocked by isolated UI test" };
  }
  await cdp("Fetch.fulfillRequest", {
    requestId: event.requestId, responseCode: status,
    responseHeaders: [{ name: "content-type", value: "application/json" }],
    body: Buffer.from(status === 204 ? "" : JSON.stringify(data)).toString("base64"),
  });
}
async function load(options = {}, width = 1440) {
  fixture = { refund: eligible(), plan: "starter", getError: false, postFails: false, postPending: false, ...options };
  await cdp("Emulation.setDeviceMetricsOverride", {
    width, height: 1000, deviceScaleFactor: 1, mobile: width < 600,
  });
  await cdp("Page.navigate", { url: `https://${domain}/settings?refund-fixture=${++navigation}` });
  await waitFor(exists("subscription-refund"), "Refund panel");
}
async function snapshot(name) {
  await evaluate(`document.querySelector(${JSON.stringify(selector("subscription-refund"))}).scrollIntoView({block:"center"})`);
  await pause(150);
  const result = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  const file = path.join(os.tmpdir(), `practably-refund-${name}.jpg`);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  console.log(`Screenshot: ${file}`);
}

(async () => {
  let activePort;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      activePort = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
      break;
    } catch { await pause(100); }
  }
  assert.ok(activePort, "Chromium must be available");
  const tab = await (await fetch(`http://127.0.0.1:${activePort}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  socket.on("message", raw => {
    const message = JSON.parse(raw);
    const pending = requests.get(message.id);
    if (pending) {
      requests.delete(message.id);
      clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      fulfill(message.params).catch(error => unexpected.push(error.message));
    } else if (message.method === "Runtime.exceptionThrown") {
      unexpected.push(message.params.exceptionDetails.text);
    }
  });
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });

  await load();
  await waitFor(exists("refund-state-eligible"), "Eligible first payment");
  assert.ok(await evaluate(`document.querySelector(${JSON.stringify(selector("refund-state-eligible"))}).textContent.includes("£1.99")`));
  await snapshot("desktop");
  await click("button-refund-start");
  await waitFor(exists("button-refund-confirm"), "Confirmation dialog");
  assert.ok(await evaluate(`document.querySelector('[role="alertdialog"]').textContent.includes("Your client data will be retained")`));
  await click("button-refund-cancel-dialog");
  assert.equal(postBodies.length, 0, "Keeping a subscription does not request a refund");
  await click("button-refund-start");
  await click("button-refund-confirm");
  await waitFor(`document.querySelector(${JSON.stringify(selector("button-refund-start"))})?.disabled === true`, "Request pending disables repeat action");
  await waitFor(exists("refund-state-completed"), "Completed refund");
  assert.equal(postBodies.length, 1);
  assert.ok(await evaluate(`document.querySelector(${JSON.stringify(selector("refund-state-completed"))}).textContent.includes("plan is Free")`));
  assert.equal(await evaluate(exists("button-refund-start")), false);

  await load({}, 390);
  await waitFor(exists("refund-state-eligible"), "Mobile eligibility");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Mobile page fits");
  await snapshot("mobile");
  await click("button-refund-start");
  await waitFor(exists("button-refund-confirm"), "Mobile confirmation");
  assert.ok(await evaluate(`document.querySelector('[role="alertdialog"]').getBoundingClientRect().width <= window.innerWidth`));
  await snapshot("mobile-confirmation");
  await click("button-refund-cancel-dialog");

  await load({ refund: { ...eligible(), expiresAt: new Date(Date.now() - 5000).toISOString() } });
  await waitFor(exists("refund-state-eligible"), "Stale cached eligibility");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector("button-refund-start"))}).disabled`), true);

  await load({ getError: true });
  await waitFor(exists("refund-unavailable"), "Eligibility error");
  fixture.getError = false;
  await click("button-refund-retry-status");
  await waitFor(exists("refund-state-eligible"), "Eligibility retry");

  const beforeRecovery = postBodies.length;
  await load({ postFails: true, postPending: true });
  await waitFor(exists("refund-state-eligible"), "Recovery eligibility");
  await click("button-refund-start");
  await click("button-refund-confirm");
  await waitFor(exists("button-refund-retry-cancellation"), "Recover accepted refund after cancellation failure");
  await click("button-refund-retry-cancellation");
  await waitFor(`document.querySelector(${JSON.stringify(selector("refund-state-processing"))})?.textContent.includes("Cancellation status: complete")`, "Pending refund with confirmed cancellation");
  fixture.refund = { ...fixture.refund, state: "completed" };
  await waitFor(exists("refund-state-completed"), "Pending refund polling completes");
  assert.equal(postBodies.length - beforeRecovery, 2, "Polling does not issue another refund request");

  await load({ refund: { ...eligible(), state: "failed", message: "Please contact support." } });
  await waitFor(exists("refund-state-failed"), "Failed refund guidance");
  assert.equal(await evaluate(exists("button-refund-start")), false);
  await load({ refund: { state: "ineligible", message: "The first-payment window has ended." } });
  await waitFor(exists("refund-state-ineligible"), "Expired payment guidance");
  assert.equal(await evaluate(exists("button-refund-start")), false);
  assert.deepEqual(unexpected, [], "No unexpected browser exceptions or interception failures");
  assert.deepEqual(blockedBillingRequests, [], "No checkout or other billing actions attempted");
  console.log("Refund browser checks passed: desktop/mobile, confirmation, pending/completed, expiry, errors, recovery and polling.");
  console.log(`All ${postBodies.length} refund POSTs were simulated locally. No API request reached the app.`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  socket?.close();
  chrome.kill("SIGTERM");
  for (const pending of requests.values()) clearTimeout(pending.timer);
});