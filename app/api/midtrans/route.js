// app/api/midtrans/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import midtransClient from "midtrans-client";
import { randomUUID } from "crypto";

// ✅ Service role key — bisa write tanpa kena RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const snap = new midtransClient.Snap({
  isProduction: true,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
});

export async function POST(request) {
  try {
    const { userId, amount, type = "topup_saldo" } = await request.json();

    if (!userId || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing userId or amount" },
        { status: 400 }
      );
    }

    // Ambil data user
    const { data: user } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    // Buat order ID unik
    const orderId = `TOPUP-${Date.now()}-${randomUUID().substring(0, 8)}`;
    console.log('🆕 Order ID:', orderId);

    // Parameter Midtrans
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: user?.full_name?.split(' ')[0] || "Warga",
        last_name: user?.full_name?.split(' ').slice(1).join(' ') || "Setempat",
        email: user?.email || "warga@setempat.id",
      },
      item_details: [
        {
          id: "topup_saldo",
          price: amount,
          quantity: 1,
          name: `Top-Up Saldo Rp${amount.toLocaleString()}`,
        },
      ],
      enabled_payments: [
        "bank_transfer",
        "gopay",
        "shopeepay",
        "qris",
        "credit_card",
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL}/rumah-warga?modal=saldo&status=success`,
        error: `${process.env.NEXT_PUBLIC_APP_URL}/rumah-warga?modal=saldo&status=error`,
      },
    };

    // Create transaksi di Midtrans
    const transaction = await snap.createTransaction(parameter);
    console.log('✅ Midtrans Response:', {
      order_id: orderId,
      has_token: !!transaction.token,
      has_redirect: !!transaction.redirect_url
    });

    // ✅ SIMPAN KE DATABASE — pakai admin client, gagal = stop
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("voucher_transactions")
      .insert({
        user_id: userId,
        voucher_id: null,
        points_spent: null,
        status: "pending",
        redeemed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        access_method: "saldo",
        metadata: {
          type: "topup_saldo",
          order_id: orderId,
          midtrans_token: transaction.token,
        },
        amount: amount,
        access_data: {
          payment_type: type,
          redirect_url: transaction.redirect_url,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ DB insert error:", insertError);
      // ✅ Stop di sini — jangan biarkan user bayar tanpa catatan di DB
      return NextResponse.json(
        { success: false, error: "Gagal menyimpan transaksi. Silakan coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: transaction.token,
      order_id: orderId,
      redirect_url: transaction.redirect_url,
      transaction_id: inserted?.id,
    });

  } catch (error) {
    console.error("❌ Midtrans Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat transaksi" },
      { status: 500 }
    );
  }
}