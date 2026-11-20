# Flutterwave card checkout

ZuriStay uses Flutterwave Standard hosted checkout. Card details are entered only on Flutterwave's hosted page; ZuriStay does not collect or store PAN or CVV data.

## Server environment variables

Configure these only in the server-side environment (for example, Vercel Project Settings → Environment Variables). Never prefix them with `NEXT_PUBLIC_`, commit them, or expose them to browser code.

| Variable | Sandbox value | Purpose |
| --- | --- | --- |
| `FLW_ENVIRONMENT` | `sandbox` | Explicitly selects sandbox mode; defaults to sandbox |
| `FLW_SECRET_KEY` | Flutterwave test secret key beginning `FLWSECK_TEST-` | Authenticates server-to-server API requests |
| `FLW_SECRET_HASH` | Webhook secret hash configured in the Flutterwave dashboard | Compared against Flutterwave's `verif-hash` webhook header |

The adapter refuses to start unless both secrets are present and the secret-key prefix matches the selected mode. Live mode requires `FLW_ENVIRONMENT=live` and a live secret key beginning `FLWSECK-` (not `FLWSECK_TEST-`). Do not enable live mode until the merchant account has been approved and live credentials have been issued.

## Flutterwave dashboard

1. Use the Flutterwave test environment while developing.
2. In Settings → Webhooks, register:
   `https://YOUR-ZURISTAY-DOMAIN/api/payments/card/webhook/flutterwave`
3. Set a strong webhook secret hash and put the exact same value in `FLW_SECRET_HASH`.
4. Enable payment event notifications and webhook retries.
5. In Flutterwave account payment preferences, disable the dashboard-wide preferred payment-method override so the per-transaction `payment_options: "card"` setting is respected. Confirm card payments are enabled for the merchant's approved country and currency.
6. Flutterwave v3 Standard sends the configured secret hash in the `verif-hash` header. ZuriStay compares it in constant time.

## Payment flow

1. The guest's existing secure booking access token authorizes checkout initiation.
2. ZuriStay creates a pending card-attempt row and sends a server-side request to Flutterwave Standard with the unique payment-attempt ID as `tx_ref`.
3. The guest is redirected to the HTTPS hosted checkout link returned by Flutterwave.
4. The webhook's `data.tx_ref` is read only after the `verif-hash` check passes. ZuriStay then asks Flutterwave to verify the transaction using that merchant reference.
5. When the guest returns from hosted checkout, the return page also calls a token-protected server endpoint. That endpoint looks up the stored checkout reference and independently verifies it with Flutterwave; it does not trust redirect query parameters.
6. Both webhook and customer-return verification use the same provider verification method and the existing idempotent booking-payment confirmation function. ZuriStay checks the verified reference, amount, currency and status before confirming the booking.
7. The browser return page displays the database-confirmed booking status. A redirect query parameter never marks a booking as paid, and a delayed webhook does not prevent the server from reconciling a verified customer return.

## Activation and release checklist

- [ ] Merchant onboarding and KYC approved by Flutterwave.
- [ ] Sandbox secret key and webhook secret hash stored as server-only environment variables.
- [ ] Sandbox webhook URL registered and tested against an actual Flutterwave sandbox event.
- [ ] Test successful, failed, cancelled, duplicate, delayed, and mismatched-amount events.
- [ ] Confirm the booking remains unpaid when signature verification or transaction verification fails.
- [ ] Confirm the guest return page reports the verified server-side status.
- [ ] Before live launch, set live credentials and `FLW_ENVIRONMENT=live` only after approval.
- [ ] Run a controlled low-value live transaction and reconcile settlement before announcing card payments.

Until credentials are configured, card checkout remains unavailable and M-Pesa continues to work. No payment is simulated.
