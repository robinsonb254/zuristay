import { NextResponse } from "next/server";

export const revalidate = 604800;

export async function GET() {
  try {
    const response = await fetch("https://api.intasend.com/api/v1/send-money/bank-codes/ke/", {
      next: { revalidate: 604800 },
    });
    if (!response.ok) throw new Error("Bank directory is temporarily unavailable.");
    const banks = await response.json();
    if (!Array.isArray(banks)) throw new Error("Invalid bank directory response.");
    return NextResponse.json({ success: true, banks }, {
      headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Kenyan bank directory lookup failed:", error);
    return NextResponse.json({ success: false, error: "Unable to load the bank list. Please try again later." }, { status: 503 });
  }
}
