import { createHash, timingSafeEqual } from "node:crypto";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function paypalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export async function paypalAccessToken() {
  const clientId = required("PAYPAL_CLIENT_ID");
  const clientSecret = required("PAYPAL_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== "string") {
    console.error("PayPal OAuth failed:", result);
    throw new Error("PayPal authentication is temporarily unavailable.");
  }
  return result.access_token as string;
}

export async function getUsdPerKes() {
  const response = await fetch("https://open.er-api.com/v6/latest/KES", {
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  const result = await response.json();
  const rate = Number(result?.rates?.USD);
  const updated = Number(result?.time_last_update_unix);
  const age = Math.floor(Date.now() / 1000) - updated;
  if (!response.ok || result?.result !== "success" || !Number.isFinite(rate) ||
      rate <= 0 || !Number.isFinite(updated) || age < -3600 || age > 36 * 3600) {
    throw new Error("A current KES-to-USD exchange rate is unavailable. Please try again later.");
  }
  return { rate, source: "open.er-api.com", updatedAt: new Date(updated * 1000).toISOString() };
}

export function verifyGuestToken(token: unknown, storedHash: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token) ||
      typeof storedHash !== "string" || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const supplied = createHash("sha256").update(token, "utf8").digest();
  const expected = Buffer.from(storedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function money(value: number) {
  return value.toFixed(2);
}
