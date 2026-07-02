// app/api/midtrans/callback/route.js
import { supabase } from "@/lib/supabaseClient";

export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id, transaction_status, gross_amount, user_id } = body;

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // Update saldo user
      const { data: profile } = await supabase
        .from("profiles")
        .select("saldo_kontribusi")
        .eq("id", user_id)
        .single();

      const newSaldo = (profile?.saldo_kontribusi || 0) + parseInt(gross_amount);

      await supabase
        .from("profiles")
        .update({ saldo_kontribusi: newSaldo })
        .eq("id", user_id);

      // ✅ INSERT NOTIFIKASI KE WARUNG_INFO
      await supabase
        .from("warung_info")
        .insert({
          user_id: user_id,
          title: "💰 Saldo Berhasil Ditambah!",
          message: `Saldo Anda bertambah Rp${parseInt(gross_amount).toLocaleString()}. Silakan cek dompet Anda.`,
          type: "saldo_topup",
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content: JSON.stringify({
            amount: parseInt(gross_amount),
            method: "midtrans",
            order_id: order_id
          }),
          action_type: "saldo_topup",
          from_user_name: "Sistem",
          from_username: "sistem",
        });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}