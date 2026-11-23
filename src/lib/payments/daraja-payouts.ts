import { getMpesaAccessToken, getMpesaConfig, normalizeKenyanPhone } from "@/lib/payments/mpesa";

type DarajaPayoutConfig = {
  shortcode: string;
  initiatorName: string;
  securityCredential: string;
  resultUrl: string;
  timeoutUrl: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function getPayoutConfig(): DarajaPayoutConfig {
  const resultUrl = required("MPESA_PAYOUT_RESULT_URL");
  const timeoutUrl = required("MPESA_PAYOUT_TIMEOUT_URL");
  for (const value of [resultUrl, timeoutUrl]) {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      throw new Error("M-Pesa payout callback URLs must use HTTPS.");
    }
  }
  return {
    shortcode: required("MPESA_PAYOUT_SHORTCODE"),
    initiatorName: required("MPESA_PAYOUT_INITIATOR_NAME"),
    securityCredential: required("MPESA_PAYOUT_SECURITY_CREDENTIAL"),
    resultUrl,
    timeoutUrl,
  };
}

async function postDarajaPayout(path: string, body: Record<string, unknown>) {
  const mpesa = getMpesaConfig();
  const payout = getPayoutConfig();
  const accessToken = await getMpesaAccessToken(mpesa);
  const response = await fetch(`${mpesa.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      InitiatorName: payout.initiatorName,
      SecurityCredential: payout.securityCredential,
      PartyA: payout.shortcode,
      QueueTimeOutURL: payout.timeoutUrl,
      ResultURL: payout.resultUrl,
      ...body,
    }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ResponseCode === "1" || result.errorCode) {
    console.error("Daraja payout initiation failed:", result);
    throw new Error("Safaricom could not accept the payout request. The payout remains unpaid.");
  }
  return result as Record<string, unknown>;
}

export async function initiateDarajaB2CPayout(input: {
  phone: string;
  amount: number;
  reference: string;
  remarks: string;
}) {
  if (process.env.MPESA_B2C_ENABLED !== "true") {
    throw new Error("M-Pesa B2C phone payouts are awaiting Safaricom approval and ZuriStay activation.");
  }
  const amount = Math.floor(input.amount);
  if (!Number.isSafeInteger(amount) || amount < 10 || amount !== input.amount) {
    throw new Error("M-Pesa phone payouts must be whole KES and at least KES 10.");
  }
  const phone = normalizeKenyanPhone(input.phone);
  const reference = input.reference.trim().slice(0, 100);
  if (!reference) throw new Error("A payout reference is required.");

  return postDarajaPayout("/mpesa/b2c/v1/paymentrequest", {
    CommandID: process.env.MPESA_B2C_COMMAND_ID?.trim() || "BusinessPayment",
    Amount: amount,
    PartyB: phone,
    Remarks: input.remarks.trim().slice(0, 100) || "ZuriStay partner settlement",
    Occasion: reference,
  });
}

export async function initiateDarajaB2BPayout(input: {
  merchantType: "till" | "paybill";
  merchantNumber: string;
  paybillAccount?: string | null;
  amount: number;
  reference: string;
  remarks: string;
}) {
  if (process.env.MPESA_B2B_ENABLED !== "true") {
    throw new Error("M-Pesa B2B business payouts are awaiting Safaricom approval and ZuriStay activation.");
  }
  const amount = Math.floor(input.amount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount !== input.amount) {
    throw new Error("M-Pesa business payouts must be a whole KES amount.");
  }
  const merchantNumber = input.merchantNumber.trim();
  if (!/^\d{5,8}$/.test(merchantNumber)) {
    throw new Error("The Till or Paybill number is invalid.");
  }
  const accountReference = (input.paybillAccount || input.reference).trim().slice(0, 20);
  if (input.merchantType === "paybill" && !accountReference) {
    throw new Error("A Paybill account reference is required.");
  }

  return postDarajaPayout("/mpesa/b2b/v1/paymentrequest", {
    CommandID: input.merchantType === "till" ? "BusinessBuyGoods" : "BusinessPayBill",
    SenderIdentifierType: "4",
    RecieverIdentifierType: input.merchantType === "till" ? "2" : "4",
    Amount: amount,
    PartyB: merchantNumber,
    AccountReference: accountReference,
    Remarks: input.remarks.trim().slice(0, 100) || "ZuriStay partner settlement",
  });
}
