// app/api/cleanup-expired/route.js
export async function GET() {
  const expired = new Date();
  
  // Ambil semua transaksi expired
  const { data: expiredTransactions } = await supabase
    .from("voucher_transactions")
    .select("*")
    .eq("status", "pending")
    .lt("expired_at", expired.toISOString());
  
  for (const trans of expiredTransactions) {
    // Kembalikan poin ke user
    await supabase
      .from("profiles")
      .update({ points: trans.points_spent })
      .eq("id", trans.user_id);
    
    // Hapus transaksi
    await supabase.from("voucher_transactions").delete().eq("id", trans.id);
  }
  
  return Response.json({ cleaned: expiredTransactions?.length || 0 });
}