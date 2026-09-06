import { WhopClient } from "@whop/sdk";

let clientPromise: Promise<WhopClient> | null = null;

async function initWhopClient(): Promise<WhopClient> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Whop is not connected to this Replit environment.");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=whop`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to load the Whop connection (${response.status}).`);
  }

  const data = await response.json();
  const apiKey = data.items?.[0]?.settings?.api_key;

  if (!apiKey) {
    throw new Error("Whop is connected but did not provide an API credential.");
  }

  return new WhopClient({ token: apiKey });
}

export function getWhopClient(): Promise<WhopClient> {
  if (!clientPromise) {
    clientPromise = initWhopClient().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}