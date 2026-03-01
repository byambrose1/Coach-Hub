import { constants } from "gocardless-nodejs";
const gocardless = require("gocardless-nodejs");

const client = gocardless(
  process.env.GOCARDLESS_API_KEY || "",
  constants.Environments.Sandbox // Always use sandbox for safety unless production is explicitly configured
);

export async function createMandateLink(clientId: string, clientName: string, clientEmail: string) {
  try {
    // 1. Create a customer if they don't exist (in a real app we'd check/store customerId)
    const customer = await client.customers.create({
      email: clientEmail,
      given_name: clientName.split(" ")[0],
      family_name: clientName.split(" ").slice(1).join(" ") || "Client",
    });

    // 2. Create a redirect flow (mandate link)
    const redirectFlow = await client.redirectFlows.create({
      description: "Monthly Coaching Subscription",
      session_token: `session_${clientId}_${Date.now()}`,
      links: {
        customer: customer.id
      },
      success_redirect_url: "https://fittrack.replit.app/payments?success=true" // Placeholder
    });

    return redirectFlow.redirect_url;
  } catch (error: any) {
    console.error("GoCardless error:", error);
    throw new Error(error.message || "Failed to create mandate link");
  }
}
