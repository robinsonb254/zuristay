import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCardPaymentProvider } from "@/lib/payments/card-gateway";

export const dynamic = "force-dynamic";

function reply(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerName } = await context.params;
    const provider = getCardPaymentProvider();
    if (!provider || provider.name !== providerName) {
      return reply("Card payment provider is not configured.", 503);
    }

    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    const event = await provider.verifyWebhook(rawBody, headers);

    if (
      !event.providerSessionId ||
      !event.providerReference ||
      event.providerReference.length > 255 ||
      !Number.isFinite(event.amount) ||
      event.amount <= 0 ||
      !/^[A-Z]{3}$/.test(event.currency)
    ) {
      return reply("Invalid verified payment event.", 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secretKey) return reply("Payment service configuration is incomplete.", 500);

    const db = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: session, error: sessionError } = await db
      .from("card_payment_sessions")
      .select("id, payment_id, status")
      .eq("provider", provider.name)
      .eq("provider_session_id", event.providerSessionId)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("Card webhook session lookup failed:", sessionError);
      return reply("Payment session could not be matched.", 404);
    }

    if (session.status === "completed") {
      return NextResponse.json({ success: true, received: true, duplicate: true }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const { data: payment, error: paymentError } = await db
      .from("payments")
      .select("id, booking_id, amount, currency, status")
      .eq("id", session.payment_id)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error("Card webhook payment lookup failed:", paymentError);
      return reply("Payment attempt could not be matched.", 404);
    }

    if (
      Number(payment.amount) !== event.amount ||
      String(payment.currency).toUpperCase() !== event.currency
    ) {
      console.error("Card webhook amount or currency mismatch:", {
        paymentId: payment.id,
        eventAmount: event.amount,
        eventCurrency: event.currency,
      });
      return reply("Payment amount or currency did not match the booking.", 400);
    }

    if (event.status === "pending") {
      return NextResponse.json({ success: true, received: true, pending: true }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (event.status === "failed") {
      const [{ error: paymentUpdateError }, { error: sessionUpdateError }] = await Promise.all([
        db.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending"),
        db.from("card_payment_sessions").update({ status: "failed" }).eq("id", session.id).neq("status", "completed"),
      ]);
      if (paymentUpdateError || sessionUpdateError) {
        console.error("Unable to record failed card payment:", { paymentUpdateError, sessionUpdateError });
        return reply("Payment result could not be recorded.", 500);
      }
      return NextResponse.json({ success: true, received: true }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ success: true, received: true, duplicate: true }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Only the provider adapter's signature-verified event can reach this point.
    const { data: confirmed, error: confirmError } = await db.rpc("confirm_booking_payment", {
      p_booking_id: payment.booking_id,
      p_payment_method: "card",
      p_provider_reference: event.providerReference,
      p_amount: event.amount,
      p_currency: event.currency,
    });

    if (confirmError || !confirmed?.success) {
      console.error("Verified card payment could not be applied:", confirmError);
      return reply("Verified payment is awaiting reconciliation.", 500);
    }

    // The RPC writes the authoritative successful payment row. Retain this
    // initiation row for audit but release the one-pending-card constraint.
    const [{ error: attemptUpdateError }, { error: sessionUpdateError }] = await Promise.all([
      db.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending"),
      db.from("card_payment_sessions").update({ status: "completed" }).eq("id", session.id),
    ]);

    if (attemptUpdateError || sessionUpdateError) {
      console.error("Card payment confirmed but checkout audit update failed:", {
        attemptUpdateError,
        sessionUpdateError,
      });
      return reply("Payment was verified but its checkout record needs reconciliation.", 500);
    }

    return NextResponse.json({ success: true, received: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Card payment webhook error:", error);
    return reply("Card payment notification could not be processed.", 500);
  }
}
