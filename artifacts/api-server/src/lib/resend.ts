import { Resend } from "resend";

let connectionSettings: { settings?: { api_key?: string; from_email?: string } } | undefined;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Resend connection not available");
  }

  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  )
    .then((res) => res.json() as Promise<{ items?: typeof connectionSettings[] }>)
    .then((data) => data.items?.[0]);

  const apiKey = connectionSettings?.settings?.api_key;
  const fromEmail = connectionSettings?.settings?.from_email;

  if (!apiKey || !fromEmail) {
    throw new Error("Resend not connected");
  }

  return { apiKey, fromEmail };
}

export async function getUncachableResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
}> {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}
