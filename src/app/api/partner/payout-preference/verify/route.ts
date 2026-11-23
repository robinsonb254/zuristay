import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Provider verification is intentionally disabled until approved transfer
// integrations are configured. This endpoint never initiates a transfer.
export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: "Your payout details are saved and awaiting ZuriStay verification. No transfer has been initiated.",
  }, { status: 409, headers: { "Cache-Control": "no-store" } });
}
