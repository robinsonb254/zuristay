import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error("Partner access signing is not configured.");
  return value;
}

export function createPartnerAccessToken(applicationId: string, email: string) {
  const payload = Buffer.from(JSON.stringify({
    applicationId,
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return payload + "." + signature;
}

export function verifyPartnerAccessToken(token: string, email: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof value.applicationId !== "string" || value.email !== email.trim().toLowerCase() ||
        typeof value.expiresAt !== "number" || value.expiresAt < Date.now()) return null;
    return { applicationId: value.applicationId, email: value.email };
  } catch { return null; }
}
