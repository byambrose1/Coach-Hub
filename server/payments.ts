import { createRequire } from "module";
import { logError } from "./safe-logging";

let requireFn: any;
try {
  if (typeof __filename !== "undefined") {
    requireFn = createRequire(__filename);
  } else if (typeof import.meta !== "undefined" && import.meta.url) {
    requireFn = createRequire(import.meta.url);
  }
} catch {
  requireFn = typeof require !== "undefined" ? require : null;
}

let client: any = null;

function getClient() {
  if (!client && process.env.GOCARDLESS_API_KEY && requireFn) {
    try {
      const gocardless = requireFn("gocardless-nodejs");
      const { constants } = requireFn("gocardless-nodejs");
      // Defaults to Sandbox so real bank mandates can never be created by
      // accident. Set GOCARDLESS_ENVIRONMENT=live once you're ready to take
      // real client payments and have swapped in a live API key.
      const environment =
        process.env.GOCARDLESS_ENVIRONMENT === "live"
          ? constants.Environments.Live
          : constants.Environments.Sandbox;
      client = gocardless(process.env.GOCARDLESS_API_KEY, environment);
    } catch (err) {
      logError("GoCardless not available", err);
    }
  }
  return client;
}

export async function createMandateLink(clientId: string, clientName: string, clientEmail: string): Promise<string> {
  const gc = getClient();

  if (!gc) {
    throw new Error("GoCardless is not configured. Please add the GOCARDLESS_API_KEY secret in Settings.");
  }

  const customer = await gc.customers.create({
    email: clientEmail,
    given_name: clientName.split(" ")[0],
    family_name: clientName.split(" ").slice(1).join(" ") || "Client",
  });

  const redirectFlow = await gc.redirectFlows.create({
    description: "Monthly Coaching Subscription",
    session_token: `session_${clientId}_${Date.now()}`,
    links: { customer: customer.id },
    success_redirect_url: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : "http://localhost:5000"}/payments?mandate=success`,
  });

  return redirectFlow.redirect_url;
}
