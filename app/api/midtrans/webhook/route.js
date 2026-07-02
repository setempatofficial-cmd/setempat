import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body;

    console.log("📨 Webhook received:", {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
    });

    if (!order_id || !signature_key) {
      console.error("❌ Missing required fields in webhook body");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // 🔒 1. VERIFIKASI SIGNATURE
    const expectedSignature = crypto
      .createHash("sha512")
      .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
      .digest("hex");

    if (signature_key !== expectedSignature) {
      console.error("❌ Invalid signature for order:", order_id);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // 2. CARI TRANSAKSI
    const { data: transaction, error: findError } = await supabaseAdmin
      .from("voucher_transactions")
      .select("id, user_id, metadata, status")
      .eq("metadata->>order_id", order_id)
      .maybeSingle();

    if (findError) {
      console.error("❌ Error finding transaction:", findError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!transaction) {
      console.warn("⚠️ Transaction not found for order_id:", order_id);
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // 🔁 3. CEK IDEMPOTENCY
    if (transaction.status === "completed") {
      console.log("ℹ️ Already processed, skip:", order_id);
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    if (transaction.status === "failed") {
      console.log("ℹ️ Transaction already marked failed, skip:", order_id);
      return NextResponse.json({ success: true, message: "Already finalized" });
    }

    const amount = parseInt(gross_amount, 10);
    let newStatus = transaction.status;
    let shouldAddSaldo = false;
    let notifTitle = null;
    let notifMessage = null;
    let notifType = null;

    // 4. TENTUKAN STATUS
    switch (transaction_status) {
      case "capture":
        if (fraud_status === "challenge") {
          newStatus = "pending";
          console.log("⚠️ Transaction flagged for fraud review:", order_id);
          break;
        }
        if (fraud_status === "deny") {
          newStatus = "failed";
          break;
        }
        newStatus = "completed";
        shouldAddSaldo = true;
        break;

      case "settlement":
        newStatus = "completed";
        shouldAddSaldo = true;
        break;

      case "pending":
        newStatus = "pending";
        console.log("⏳ Payment pending for order:", order_id);
        break;

      case "deny":
      case "cancel":
      case "expire":
      case "failure":
        newStatus = "failed";
        notifTitle = "❌ Pembayaran Gagal";
        notifMessage = `Pembayaran Rp${amount.toLocaleString("id-ID")} gagal. Silakan coba lagi.`;
        notifType = "payment_failed";
        break;

      default:
        console.log("ℹ️ Unknown status:", transaction_status);
    }

    // 5. TAMBAH SALDO (kolom: "saldo")
    if (shouldAddSaldo) {
      const { error: rpcError } = await supabaseAdmin.rpc("increment_saldo", {
        p_user_id: transaction.user_id,
        p_amount: amount,
      });

      if (rpcError) {
        console.error("❌ Failed to increment saldo:", rpcError);
        return NextResponse.json({ error: "Failed to update saldo" }, { status: 500 });
      }

      console.log(`✅ Saldo +${amount} added for user ${transaction.user_id}`);

      notifTitle = "💰 Saldo Berhasil Ditambah!";
      notifMessage = `Saldo Anda bertambah Rp${amount.toLocaleString("id-ID")}.`;
      notifType = "saldo_topup";
    }

    // 6. UPDATE STATUS TRANSAKSI
    if (newStatus !== transaction.status) {
      const { error: updateError } = await supabaseAdmin
        .from("voucher_transactions")
        .update({
          status: newStatus,
          claimed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", transaction.id);

      if (updateError) {
        console.error("❌ Error updating status:", updateError);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      console.log(`✅ Status updated: ${transaction.status} → ${newStatus}`);
    }

    // 7. NOTIFIKASI (non-blocking)
    if (notifTitle) {
      const { error: notifError } = await supabaseAdmin.from("warung_info").insert({
        user_id: transaction.user_id,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        is_read: false,
        created_at: new Date().toISOString(),
        content: JSON.stringify({ amount, order_id, status: transaction_status }),
        action_type: notifType,
        from_user_name: "Sistem",
        from_username: "sistem",
      });

      if (notifError) {
        console.error("⚠️ Failed to send notification (non-blocking):", notifError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}