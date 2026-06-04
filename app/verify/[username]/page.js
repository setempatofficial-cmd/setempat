"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, User, Ticket, Gift, Coffee, Utensils, CheckCircle, XCircle, Shield, Lock } from "lucide-react";
import KTPCardPublic from "@/app/components/layout/KTPCardPublic";

// 🎨 Map icon berdasarkan nama icon dari database
const getIconComponent = (iconName) => {
  const icons = {
    Coffee: Coffee,
    Utensils: Utensils,
    Ticket: Ticket,
    Gift: Gift,
  };
  const Icon = icons[iconName] || Gift;
  return <Icon className="w-5 h-5" />;
};

export default function UsernameProfilePage() {
  const { username } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token'); // 🔥 TOKEN dari QR Code
  
  // State untuk verifikasi
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const [verifying, setVerifying] = useState(true);
  
  // State original (tetap sama)
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [allVouchers, setAllVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);

  // 🔐 STEP 1: VERIFIKASI TOKEN (PERTAMA KALI)
  useEffect(() => {
    const verifyAccess = async () => {
      if (!token) {
        setVerificationError("❌ Akses ditolak. QR Code tidak valid.");
        setVerifying(false);
        return;
      }

      // Cek token di database
      const { data: tokenData, error: tokenError } = await supabase
        .from("access_tokens")
        .select("*")
        .eq("token", token)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        setVerificationError("❌ QR Code sudah kadaluarsa atau sudah digunakan.");
        setVerifying(false);
        return;
      }

      // Tandai token sudah digunakan
      await supabase
        .from("access_tokens")
        .update({ 
          is_used: true, 
          used_at: new Date().toISOString(),
          used_for_username: username 
        })
        .eq("id", tokenData.id);

      setIsVerified(true);
      setVerifying(false);
    };

    verifyAccess();
  }, [token, username]);

  // 📦 STEP 2: FETCH DATA (HANYA JIKA VERIFIKASI BERHASIL)
  useEffect(() => {
    const fetchData = async () => {
      if (!isVerified) return;
      
      setLoading(true);

      // 1. Ambil semua voucher yang aktif
      const { data: vouchersData } = await supabase
        .from("vouchers")
        .select("*")
        .eq("is_active", true)
        .order("points_required", { ascending: true });

      if (vouchersData) setAllVouchers(vouchersData);

      // 2. Ambil profile berdasarkan username
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profileError || !profileData) {
        setError("Warga tidak ditemukan");
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setUser({
        id: profileData.id,
        user_metadata: {
          full_name: profileData.full_name,
          username: profileData.username,
          avatar_url: profileData.avatar_url
        }
      });

      // 3. Ambil transaksi voucher pending user
      const { data: transactionData } = await supabase
        .from("voucher_transactions")
        .select(`
          id,
          points_spent,
          expired_at,
          redeemed_at,
          vouchers!inner (
            id,
            name,
            merchant,
            icon,
            code,
            quota,
            used_count
          )
        `)
        .eq("user_id", profileData.id)
        .eq("status", "pending")
        .order("redeemed_at", { ascending: true });

      if (transactionData && transactionData.length > 0) {
        setVouchers(transactionData.map(trans => ({
          id: trans.id,
          voucher_id: trans.vouchers.id,
          name: trans.vouchers.name,
          merchant: trans.vouchers.merchant,
          icon: trans.vouchers.icon,
          points: trans.points_spent,
          expired_at: trans.expired_at,
          redeemed_at: trans.redeemed_at
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, [isVerified, username]);

  // 🎫 FUNGSI KLAIM VOUCHER (SAMA PERSIS DENGAN KODE ASLI)
  const handleClaimVoucher = async (voucher) => {
    setClaimingId(voucher.id);
    setSuccessMessage(null);

    // Cek expired
    if (new Date(voucher.expired_at) < new Date()) {
      setError(`❌ Voucher sudah kadaluarsa (${new Date(voucher.expired_at).toLocaleDateString('id-ID')})`);
      await supabase.from("voucher_transactions").delete().eq("id", voucher.id);
      setVouchers(vouchers.filter(v => v.id !== voucher.id));
      setClaimingId(null);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Cek kuota voucher
    const voucherDetail = allVouchers.find(v => v.id === voucher.voucher_id);
    if (voucherDetail?.quota && voucherDetail.used_count >= voucherDetail.quota) {
      setError(`❌ Voucher ${voucherDetail.name} sudah habis kuotanya`);
      setClaimingId(null);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Kurangi poin user
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ points: profile.points - voucher.points })
      .eq("id", profile.id);

    if (updateError) {
      setError("Gagal memproses klaim");
      setClaimingId(null);
      return;
    }

    // Update status transaksi
    await supabase
      .from("voucher_transactions")
      .update({
        status: "redeemed",
        claimed_at: new Date().toISOString()
      })
      .eq("id", voucher.id);

    // Update used_count di tabel vouchers
    if (voucherDetail?.quota) {
      await supabase
        .from("vouchers")
        .update({ used_count: (voucherDetail.used_count || 0) + 1 })
        .eq("id", voucher.voucher_id);
    }

    // 🔥 NOTIFIKASI KE WARUNG_INFO (TETAP ADA!)
    await supabase
      .from("warung_info")
      .insert({
        user_id: profile.id,
        title: "🎫 Voucher Diklaim",
        message: `Voucher ${voucher.name} telah diklaim di ${voucher.merchant}. Poin Anda berkurang ${voucher.points}.`,
        type: "voucher",
        is_read: false,
        created_at: new Date().toISOString()
      });

    // Update state
    setProfile({ ...profile, points: profile.points - voucher.points });
    setVouchers(vouchers.filter(v => v.id !== voucher.id));
    setSuccessMessage(`✅ ${voucher.name} berhasil diklaim!`);
    setClaimingId(null);

    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 🔐 TAMPILAN VERIFIKASI GAGAL
  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
        <div className="text-center max-w-sm">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Akses Ditolak</h1>
          <p className="text-slate-400 mb-4">{verificationError}</p>
          <p className="text-[10px] text-slate-500">
            Silakan minta pemilik KTP untuk menampilkan QR Code kembali.
          </p>
        </div>
      </div>
    );
  }

  // LOADING DATA
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // ERROR PROFILE
  if (error && !profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
        <div className="text-center">
          <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Warga Tidak Ditemukan</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // ✅ TAMPILAN UTAMA (SAMA PERSIS DENGAN KODE ASLI)
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-5">
      <div className="max-w-[420px] mx-auto space-y-5">

        {/* KTP Card */}
        <KTPCardPublic
          user={user}
          profile={profile}
          theme={{ isMalam: true }}
        />

        {/* Success Message */}
        {successMessage && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-emerald-400">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && !successMessage && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* VOUCHER SECTION */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Ticket className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Voucher untuk Diklaim</h3>
            {vouchers.length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                {vouchers.length} Pending
              </span>
            )}
          </div>

          {vouchers.length > 0 ? (
            <div className="space-y-3">
              {vouchers.map((voucher) => {
                const isExpired = new Date(voucher.expired_at) < new Date();
                return (
                  <div
                    key={voucher.id}
                    className={`rounded-xl p-4 transition-all ${isExpired
                      ? "bg-red-500/10 border border-red-500/30 opacity-60"
                      : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          {getIconComponent(voucher.icon)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            {voucher.name}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            {voucher.merchant}
                          </p>
                          <p className="text-[9px] text-amber-400 mt-1">
                            {voucher.points} Poin
                          </p>
                        </div>
                      </div>

                      {!isExpired && (
                        <button
                          onClick={() => handleClaimVoucher(voucher)}
                          disabled={claimingId === voucher.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {claimingId === voucher.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Klaim"
                          )}
                        </button>
                      )}

                      {isExpired && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] rounded-lg">
                          Kadaluarsa
                        </span>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-amber-500/20">
                      <p className="text-[8px] text-slate-500">
                        ⏰ Berlaku hingga: {new Date(voucher.expired_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Tidak ada voucher yang perlu diklaim</p>
              <p className="text-[10px] text-slate-500 mt-1">Warga belum menukarkan poin</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-[8px] text-slate-500">
            Verifikasi: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}