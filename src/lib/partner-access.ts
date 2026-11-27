import { createHash, randomBytes } from "crypto";

export function createPartnerAccessTokens() {
  return {
    firstToken: randomBytes(32).toString("base64url"),
    recoveryToken: randomBytes(32).toString("base64url"),
  };
}

export function hashPartnerAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
