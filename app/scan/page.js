"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Html5Qrcode } from "html5-qrcode";
import {
  CheckCircle, XCircle, Loader2, User, Shield, Coins,
  Ticket, Coffee, Utensils, Gift, ShoppingBag, Award,
  ArrowLeft, Camera, ScanLine
} from "lucide-react";

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(true);
  const [scanningStarted, setScanningStarted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // Mulai scanner
  const startScanner = () => {
    setShowCamera(true);
    setScanning(true);
    setError(null);
    setScanResult(null);
    setUserData(null);
    setVouchers([]);
  };

  useEffect(() => {
    if (!showCamera) return;

    const scanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 280, height: 280 } };

    scanner.start(
      { facingMode: "environment" },
      config,
      async (decodedText) => {
        scanner.stop();
        setScanning(false);
        setScanningStarted(false);
        setShowCamera(false);
        setLoading(true);

        await processScanResult(decodedText);
        setLoading(false);
      },
      (err) => {
        console.log("Scan error:", err);
      }
    );

    return () => {
      if (scanner) {
        scanner.stop().catch(console.log);
      }
    };
  }, [showCamera]);

  const processScanResult = async (decodedText) => {
    setScanResult(decodedText);

    try {
      let userId = null;
      let username = null;
      let transactionId = null;  // 🔥 TAMBAHKAN

      // 🔥 CEK APAKAH INI URL SCAN (untuk klaim voucher)
      const urlParams = new URLSearchParams(decodedText.split('?')[1]);
      if (decodedText.includes('/scan?') && urlParams.has('transaction')) {
        transactionId = urlParams.get('transaction');

        // Proses klaim voucher langsung
        await processVoucherClaim(transactionId);
        return;
      }

      // Coba parse sebagai JSON dulu
      try {
        const qrData = JSON.parse(decodedText);
        if (qrData.user_id) {
          userId = qrData.user_id;
        } else if (qrData.userId) {
          userId = qrData.userId;
        }
        // 🔥 CEK JUGA JIKA JSON UNTUK VOUCHER
        if (qrData.transaction_id) {
          transactionId = qrData.transaction_id;
          await processVoucherClaim(transactionId);
          return;
        }
      } catch {
        // Bukan JSON, coba ambil dari URL biasa
        const urlMatch = decodedText.match(/\/(@?[\w-]+)$/);
        if (urlMatch) {
          username = urlMatch[1].replace('@', '');
        }
      }

      // Jika tidak dapat, cek UUID
      if (!userId && !username) {
        const uuidMatch = decodedText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          userId = uuidMatch[0];
        }
      }

      // Ambil data user
      let profile = null;

      if (userId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, points, is_verified, ktp_status, avatar_url")
          .eq("id", userId)
          .single();
        profile = data;
      } else if (username) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, points, is_verified, ktp_status, avatar_url")
          .eq("username", username)
          .single();
        profile = data;
      }

      if (!profile) {
        setError("QR tidak valid atau user tidak ditemukan");
        return;
      }

      setUserData(profile);


      // Ambil voucher user yang pending
      const { data: userVouchers } = await supabase
        .from("voucher_transactions")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .order("redeemed_at", { ascending: true });

      if (userVouchers && userVouchers.length > 0) {
        setVouchers(userVouchers.map(v => ({
          id: v.id,
          name: getVoucherName(v.voucher_code),
          code: v.voucher_code,
          points: v.points_spent,
          merchant: getVoucherMerchant(v.voucher_code),
          redeemed_at: v.redeemed_at
        })));
      }

    } catch (err) {
      console.error("Error processing scan:", err);
      setError("Gagal memproses QR");
    }
  };

  const getVoucherName = (code) => {
    const map = {
      "KOPI100": "☕ Voucher Kopi",
      "MAKAN250": "🍜 Voucher Makan",
      "WISATA500": "🎟️ Voucher Wisata"
    };
    return map[code] || "🎁 Voucher";
  };

  const getVoucherMerchant = (code) => {
    const map = {
      "KOPI100": "Kedai Setempat",
      "MAKAN250": "Warung Tetangga",
      "WISATA500": "Wisata Pasuruan"
    };
    return map[code] || "Merchant Setempat";
  };

  const getVoucherIcon = (code) => {
    const map = {
      "KOPI100": Coffee,
      "MAKAN250": Utensils,
      "WISATA500": Ticket
    };
    const Icon = map[code] || Gift;
    return <Icon className="w-5 h-5" />;
  };

  const processVoucherClaim = async (transactionId) => {
    setLoading(true);

    try {
      // Ambil data transaksi dengan JOIN ke profiles
      const { data: transaction, error: transError } = await supabase
        .from("voucher_transactions")
        .select(`
        id,
        voucher_code,
        points_spent,
        redeemed_at,
        status,
        profiles!inner (
          id,
          full_name,
          username,
          points,
          avatar_url,
          ktp_status
        )
      `)
        .eq("id", transactionId)
        .eq("status", "pending")
        .single();

      if (transError || !transaction) {
        setError("Voucher tidak valid atau sudah diklaim");
        setLoading(false);
        return;
      }

      // Set data user
      setUserData({
        id: transaction.profiles.id,
        full_name: transaction.profiles.full_name,
        username: transaction.profiles.username,
        points: transaction.profiles.points,
        avatar_url: transaction.profiles.avatar_url,
        ktp_status: transaction.profiles.ktp_status,
      });

      // Set voucher yang akan diklaim
      setVouchers([{
        id: transaction.id,
        name: getVoucherName(transaction.voucher_code),
        code: transaction.voucher_code,
        points: transaction.points_spent,
        merchant: getVoucherMerchant(transaction.voucher_code),
        redeemed_at: transaction.redeemed_at
      }]);

    } catch (err) {
      console.error("Error processing voucher claim:", err);
      setError("Gagal memproses klaim voucher");
    }

    setLoading(false);
  };

  const handleClaimVoucher = async (voucher) => {
    setClaimingId(voucher.id);

    // 1. Cek transaksi masih pending
    const { data: transaction, error: transError } = await supabase
      .from("voucher_transactions")
      .select("*")
      .eq("id", voucher.id)
      .single();

    // 🔥 CEK EXPIRED
    if (new Date(transaction.expired_at) < new Date()) {
      alert(`❌ Voucher sudah kadaluarsa (${new Date(transaction.expired_at).toLocaleDateString()})`);

      // KEMBALIKAN POIN KE USER
      await supabase
        .from("profiles")
        .update({ points: userData.points + transaction.points_spent })
        .eq("id", userData.id);

      // HAPUS transaksi
      await supabase.from("voucher_transactions").delete().eq("id", voucher.id);

      setVouchers(vouchers.filter(v => v.id !== voucher.id));
      return;
    }

    if (transError || !transaction || transaction.status !== "pending") {
      alert("Voucher sudah tidak berlaku");
      setClaimingId(null);
      return;
    }

    // 2. 🔥 KURANGI POIN USER (Cuma di sini!)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ points: userData.points - transaction.points_spent })
      .eq("id", userData.id);

    if (updateError) {
      alert("Gagal memproses klaim: " + updateError.message);
      setClaimingId(null);
      return;
    }

    // 3. Update status transaksi
    await supabase
      .from("voucher_transactions")
      .update({
        status: "redeemed",
        claimed_at: new Date().toISOString()
      })
      .eq("id", voucher.id);

    // 4. Update UI
    setUserData({ ...userData, points: userData.points - transaction.points_spent });
    setVouchers(vouchers.filter(v => v.id !== voucher.id));

    alert(`✅ ${voucher.name} berhasil diklaim!`);
    setClaimingId(null);
  };

  // Halaman scan QR
  if (showCamera) {
    return (
      <div className="min-h-screen bg-slate-900 p-5">
        <div className="max-w-[400px] mx-auto">
          <button
            onClick={() => {
              setShowCamera(false);
              setScanning(true);
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Kembali</span>
          </button>

          <h1 className="text-xl font-bold text-white mb-4">Scan QR Warga</h1>

          <div id="reader" className="w-full rounded-xl overflow-hidden bg-black" />

          <p className="text-center text-slate-400 text-sm mt-4">
            Arahkan kamera ke QR Code KTP Digital warga
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
        <div className="text-center max-w-[350px]">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Verifikasi Gagal</h1>
          <p className="text-slate-400">{error}</p>
          <button
            onClick={startScanner}
            className="mt-6 px-6 py-3 bg-emerald-600 rounded-xl text-white font-bold"
          >
            Scan Ulang
          </button>
        </div>
      </div>
    );
  }

  // Hasil scan
  if (userData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-5">
        <div className="max-w-[400px] mx-auto">
          <button
            onClick={startScanner}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Scan Ulang</span>
          </button>

          {/* Info User */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                {userData?.avatar_url ? (
                  <img src={userData.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-emerald-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{userData?.full_name}</h2>
                <p className="text-xs text-slate-400">@{userData?.username}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">
                    {userData?.ktp_status === "aktif" ? "Terverifikasi" : "Belum Verifikasi"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-700">
              <div className="text-center">
                <Coins className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Poin Tersedia</p>
                <p className="text-lg font-bold text-white">{userData?.points || 0}</p>
              </div>
              <div className="text-center">
                <Award className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-xs font-bold text-emerald-400">Warga Setempat</p>
              </div>
            </div>
          </div>

          {/* Voucher */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Voucher untuk Diklaim</h3>
            </div>

            {vouchers.length > 0 ? (
              <div className="space-y-3">
                {vouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          {getVoucherIcon(voucher.code)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{voucher.name}</h4>
                          <p className="text-[10px] text-slate-400">{voucher.merchant}</p>
                          <p className="text-[9px] text-amber-400 mt-1">
                            {voucher.points} Poin
                          </p>
                        </div>
                      </div>
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
                    </div>

                    <div className="mt-2 pt-2 border-t border-amber-500/20">
                      <p className="text-[8px] text-slate-500">
                        Ditukar: {new Date(voucher.redeemed_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Tidak ada voucher yang perlu diklaim</p>
                <p className="text-[10px] text-slate-500 mt-1">Warga belum menukarkan poin</p>
              </div>
            )}
          </div>

          <div className="text-center mt-4">
            <p className="text-[8px] text-slate-500">
              Verifikasi: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Halaman awal
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-5">
      <div className="text-center max-w-[350px]">
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <ScanLine className="w-12 h-12 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Scan QR Warga</h1>
        <p className="text-slate-400 text-sm mb-6">
          Scan QR Code KTP Digital warga untuk memverifikasi identitas dan klaim voucher
        </p>
        <button
          onClick={startScanner}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white font-bold flex items-center justify-center gap-2"
        >
          <Camera size={18} />
          Mulai Scan
        </button>
        <p className="text-[10px] text-slate-500 mt-4">
          Cukup scan QR dari HP warga. Tidak perlu login.
        </p>
      </div>
    </div>
  );
}