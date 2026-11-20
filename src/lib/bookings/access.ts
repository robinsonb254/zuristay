import { createHash, timingSafeEqual } from "node:crypto";

export function hashBookingAccessToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyBookingAccessToken(token: unknown, storedHash: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token) ||
      typeof storedHash !== "string" || !/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }
  const supplied = Buffer.from(hashBookingAccessToken(token), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
