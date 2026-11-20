import crypto from "node:crypto";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function getMpesaConfig() {
  const environment = process.env.MPESA_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    environment,
    baseUrl: environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke",
    shortcode: required("MPESA_SHORTCODE"),
    passkey: required("MPESA_PASSKEY"),
    consumerKey: required("MPESA_CONSUMER_KEY"),
    consumerSecret: required("MPESA_CONSUMER_SECRET"),
    callbackToken: required("MPESA_CALLBACK_TOKEN"),
  };
}

export function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (/^0[17][0-9]{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17][0-9]{8}$/.test(digits)) return digits;
  if (/^[17][0-9]{8}$/.test(digits)) return `254${digits}`;
  throw new Error("Enter a valid Kenyan M-Pesa number, e.g. 0712345678.");
}

export async function getMpesaAccessToken(config: ReturnType<typeof getMpesaConfig>) {
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${basic}` }, cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("Daraja OAuth failed:", data);
    throw new Error("M-Pesa authentication is temporarily unavailable.");
  }
  return data.access_token as string;
}

export function darajaPassword(shortcode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

export function darajaTimestamp() {
  const d = new Date();
  return d.getUTCFullYear().toString()
    + String(d.getUTCMonth() + 1).padStart(2, "0")
    + String(d.getUTCDate()).padStart(2, "0")
    + String(d.getUTCHours()).padStart(2, "0")
    + String(d.getUTCMinutes()).padStart(2, "0")
    + String(d.getUTCSeconds()).padStart(2, "0");
}

export async function queryMpesaStk(
  config: ReturnType<typeof getMpesaConfig>,
  accessToken: string,
  checkoutRequestId: string
) {
  const timestamp = darajaTimestamp();
  const response = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: darajaPassword(config.shortcode, config.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Daraja STK query failed:", data);
    throw new Error("Unable to verify the M-Pesa transaction yet.");
  }
  return data as Record<string, unknown>;
}

export function safeTokenMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
