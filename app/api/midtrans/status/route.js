// app/api/midtrans/check-status/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  const userId = searchParams.get("user_id");

  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("voucher_transactions")
      .select("status, amount, claimed_at")
      .eq("metadata->>order_id", orderId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json({
      status: data.status,
      amount: data.amount,
      claimed_at: data.claimed_at,
    });

  } catch (error) {
    console.error("❌ Status check error:", error);
    return NextResponse.json({ status: "pending" });
  }
}