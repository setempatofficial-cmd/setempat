"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wallet, Banknote, CheckCircle, Clock, AlertCircle,
  ArrowUpRight, ArrowDownRight, Gift, Coffee, Tv, Utensils,
  Sparkles, TrendingUp, Award
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function SaldoModal({
  isOpen,
  onClose,
  userId,
  userSaldo,
  userPoints = 0,
  moneyOpportunities = [],
  onOpportunityClick,
  onSaldoUpdated,
  onPointsUpdated,
}) {
  const [transactions, setTransactions] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("income");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [error, setError] = useState(null);
  const [showTopUpOptions, setShowTopUpOptions] = useState(false);

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const MIN_WITHDRAW = 50000;
  const isEligible = userSaldo >= MIN_WITHDRAW;

  // ============================================================
  // 🔥 TOP-UP PACKAGES (SESUAI MODEL BISNIS)
  // ============================================================
  const TOP_UP_PACKAGES = [
    { label: 'Rp 10.000', price: 10000, bonus: 0, points: 0 },
    { label: 'Rp 25.000', price: 25000, bonus: 0, points: 0 },
    { label: 'Rp 50.000', price: 50000, bonus: 5000, points: 10 },
    { label: 'Rp 100.000', price: 100000, bonus: 15000, points: 25 },
    { label: 'Rp 250.000', price: 250000, bonus: 50000, points: 50 },
    { label: 'Rp 500.000', price: 500000, bonus: 125000, points: 100 },
  ];

  // ============================================================
  // 🔥 KONVERSI POIN KE SALDO (BARU)
  // ============================================================
  const POIN_TO_SALDO_RATE = 500; // 1 Poin = Rp 500

  const convertPoinToSaldo = (poin) => {
    return poin * POIN_TO_SALDO_RATE;
  };

  // ============================================================
  // 🔥 HANDLE TUKAR POIN JADI SALDO (BARU)
  // ============================================================
  const handlePoinToSaldo = async () => {
    if (!userId) return;

    const poinToConvert = prompt(
      `Masukkan jumlah poin yang ingin ditukar menjadi saldo:\n\n1 Poin = Rp ${POIN_TO_SALDO_RATE.toLocaleString()}\nPoin Anda: ${userPoints}\nMinimal tukar: 10 poin`
    );

    if (!poinToConvert) return;

    const poin = parseInt(poinToConvert);
    if (isNaN(poin) || poin < 10) {
      alert('Minimal tukar 10 poin!');
      return;
    }

    if (poin > userPoints) {
      alert(`Poin tidak mencukupi! Anda punya ${userPoints} poin.`);
      return;
    }

    const saldoAmount = poin * POIN_TO_SALDO_RATE;

    const confirmed = confirm(
      `Tukar ${poin} poin menjadi saldo Rp ${saldoAmount.toLocaleString()}?`
    );
    if (!confirmed) return;

    try {
      // 1. Kurangi poin user
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          points: userPoints - poin,
          saldo: (userSaldo || 0) + saldoAmount
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      // 2. Catat transaksi
      await supabase
        .from("voucher_transactions")
        .insert({
          user_id: userId,
          points_spent: poin,
          amount: saldoAmount,
          status: "completed",
          redeemed_at: new Date().toISOString(),
          metadata: {
            type: "poin_to_saldo",
            poin_converted: poin,
            saldo_received: saldoAmount,
            rate: POIN_TO_SALDO_RATE
          }
        });

      // 3. Update state
      if (onPointsUpdated) onPointsUpdated(userPoints - poin);
      if (onSaldoUpdated) onSaldoUpdated();

      alert(`✅ Berhasil! ${poin} poin telah ditukar menjadi saldo Rp ${saldoAmount.toLocaleString()}`);

    } catch (err) {
      console.error("Error converting poin to saldo:", err);
      alert("❌ Gagal menukar poin. Silakan coba lagi.");
    }
  };

  // ============================================================
  // 🔥 FETCH DATA
  // ============================================================
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [bountyRes, programRes, withdrawRes] = await Promise.all([
          supabase
            .from("bounty_submissions")
            .select(`id, title, reward_value, created_at, opportunities:opportunity_id (title, icon)`)
            .eq("user_id", userId)
            .eq("reward_type", "money")
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("user_opportunities")
            .select(`id, created_at, opportunities:opportunity_id (title, icon, reward_value, reward_type)`)
            .eq("user_id", userId)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("withdraw_requests")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20)
        ]);

        // 🔥 TAMBAHKAN: Transaksi tukar poin ke saldo
        const { data: poinTransactions } = await supabase
          .from("voucher_transactions")
          .select("*")
          .eq("user_id", userId)
          .eq("metadata->>type", "poin_to_saldo")
          .order("redeemed_at", { ascending: false })
          .limit(10);

        const allTransactions = [
          ...(bountyRes.data || []).map(t => ({
            id: t.id,
            title: t.opportunities?.title || t.title,
            icon: t.opportunities?.icon || "🎯",
            amount: t.reward_value,
            date: t.created_at,
            type: "bounty"
          })),
          ...(programRes.data || [])
            .filter(p => p.opportunities?.reward_type === "money")
            .map(p => ({
              id: p.id,
              title: p.opportunities?.title,
              icon: p.opportunities?.icon || "🎁",
              amount: p.opportunities?.reward_value,
              date: p.created_at,
              type: "opportunity"
            })),
          ...(poinTransactions || []).map(t => ({
            id: t.id,
            title: "💱 Tukar Poin ke Saldo",
            icon: "💱",
            amount: t.amount,
            date: t.redeemed_at,
            type: "poin_conversion"
          }))
        ];

        setTransactions(allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setWithdrawRequests(withdrawRes.data || []);
      } catch (err) {
        console.error("Error fetching wallet data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, userId]);

  // ============================================================
  // 🔥 HELPER: WAIT FOR SNAP
  // ============================================================
  const waitForSnap = () => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.snap) {
        resolve(true);
        return;
      }

      let attempts = 0;
      const maxAttempts = 20;

      const checkSnap = setInterval(() => {
        attempts++;
        if (typeof window !== 'undefined' && window.snap) {
          clearInterval(checkSnap);
          resolve(true);
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(checkSnap);
          reject(new Error('Snap payment not loaded'));
        }
      }, 500);
    });
  };

  // ============================================================
  // 🔥 POLLING: CEK STATUS TRANSAKSI SAMPAI WEBHOOK SELESAI
  // ============================================================
  const pollTransactionStatus = async (orderId, maxAttempts = 8, intervalMs = 2000) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`/api/midtrans/status?order_id=${orderId}`);
        const data = await res.json();

        if (data.status === "completed") {
          return { success: true, status: "completed" };
        }
        if (data.status === "failed") {
          return { success: false, status: "failed" };
        }
        // status masih "pending" → tunggu lagi
      } catch (err) {
        console.error("Polling error:", err);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return { success: false, status: "timeout" };
  };

  // ============================================================
  // 🔥 HANDLE TOP-UP SALDO
  // ============================================================
  const handleTopUpSaldo = async (pkg) => {
    if (!userId) return;

    const userConfirmed = confirm(`Top-up saldo sebesar ${pkg.label}?`);
    if (!userConfirmed) return;

    setIsProcessingPayment(true);
    setError(null);

    let response;
    let data;

    try {
      response = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          amount: pkg.price,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Gagal membuat transaksi");
      }

      // 🔥 LOG UNTUK DEBUG
      console.log('✅ API Response:', {
        token: data.token,
        order_id: data.order_id,
        redirect_url: data.redirect_url,
      });

      if (!data.token) {
        throw new Error("Token tidak ditemukan dari server");
      }

      // 🔥 Tunggu Snap ready
      await waitForSnap();

      if (typeof window !== 'undefined' && window.snap) {
        const snap = window.snap;

        // 🔥 LOG SEBELUM PAY
        console.log('🔄 Calling snap.pay with token:', data.token);

        snap.pay(data.token, {
          onSuccess: async function (result) {
            console.log('✅ Payment success (client):', result);
            snap.hide();

            // 🔥 Jangan langsung percaya - tunggu webhook konfirmasi ke server
            setIsProcessingPayment(true);
            alert('✅ Pembayaran diterima! Memverifikasi & memperbarui saldo...');

            const pollResult = await pollTransactionStatus(data.order_id);

            if (pollResult.success) {
              alert('🎉 Saldo Anda berhasil ditambahkan!');
              if (onSaldoUpdated) onSaldoUpdated();
              onClose();
            } else if (pollResult.status === "failed") {
              alert('❌ Pembayaran ditolak sistem. Silakan hubungi admin jika saldo terpotong.');
            } else {
              // timeout - webhook lama / belum jalan
              alert('⏳ Pembayaran kamu sedang diproses. Saldo akan muncul dalam beberapa menit. Silakan cek kembali nanti.');
              if (onSaldoUpdated) onSaldoUpdated(); // tetap refresh, siapa tau udah selesai pas user nutup alert
            }

            setIsProcessingPayment(false);
          },
          onPending: function (result) {
            console.log('⏳ Payment pending:', result);
            alert('⏳ Pembayaran pending. Silakan selesaikan pembayaran. Saldo akan otomatis bertambah setelah pembayaran terkonfirmasi.');
            setIsProcessingPayment(false);
          },
          onError: function (result) {
            console.error('❌ Payment error:', result);
            console.error('Error details:', {
              status_message: result.status_message,
              transaction_status: result.transaction_status,
              order_id: data.order_id,
            });

            if (data.redirect_url) {
              const useRedirect = confirm(
                `❌ Pop-up gagal (${result.status_message || 'Unknown error'}). Buka halaman pembayaran di tab baru?`
              );
              if (useRedirect) {
                window.open(data.redirect_url, '_blank');
              }
            }

            alert(`❌ Pembayaran gagal: ${result.status_message || 'Silakan coba lagi.'}`);
            setIsProcessingPayment(false);
          },
          onClose: function () {
            console.log('ℹ️ Payment popup closed');
            setIsProcessingPayment(false);
          }
        });
      } else {
        console.warn('⚠️ Snap not available, redirecting...');
        if (data.redirect_url) {
          window.open(data.redirect_url, '_blank');
        } else {
          throw new Error('No redirect URL available');
        }
      }

      setIsProcessingPayment(false);

    } catch (err) {
      console.error("❌ Error top-up saldo:", err);
      setError(err.message || "Gagal top-up. Silakan coba lagi.");
      alert(`❌ ${err.message || "Gagal top-up. Silakan coba lagi."}`);
      setIsProcessingPayment(false);
    }
  };

  // ============================================================
  // 🔥 HANDLE WITHDRAW REQUEST
  // ============================================================
  const handleWithdrawRequest = async () => {
    if (!withdrawAmount || parseInt(withdrawAmount) < MIN_WITHDRAW) {
      alert(`Minimal penarikan Rp ${MIN_WITHDRAW.toLocaleString()}`);
      return;
    }

    if (parseInt(withdrawAmount) > userSaldo) {
      alert("Saldo tidak mencukupi");
      return;
    }

    if (!bankName || !accountNumber || !accountName) {
      alert("Lengkapi data rekening terlebih dahulu");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("withdraw_requests")
        .insert({
          user_id: userId,
          amount: parseInt(withdrawAmount),
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          status: "pending"
        });

      if (error) throw error;

      alert("✅ Permintaan penarikan telah diajukan!\n\nProses transfer memerlukan waktu maksimal 1x24 jam.");

      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setBankName("");
      setAccountNumber("");
      setAccountName("");

      if (onSaldoUpdated) onSaldoUpdated();

    } catch (err) {
      console.error("Error withdraw:", err);
      alert("Gagal mengajukan penarikan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // 🔥 GET STATUS BADGE
  // ============================================================
  const getStatusBadge = (status) => {
    const baseClass = "text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 leading-none";
    switch (status) {
      case "approved":
      case "completed":
        return <span className={`${baseClass} bg-green-500/10 text-green-400`}><CheckCircle size={10} /> Selesai</span>;
      case "processing":
        return <span className={`${baseClass} bg-sky-500/10 text-sky-400`}><Clock size={10} /> Diproses</span>;
      case "rejected":
        return <span className={`${baseClass} bg-rose-500/10 text-rose-400`}><AlertCircle size={10} /> Ditolak</span>;
      default:
        return <span className={`${baseClass} bg-amber-500/10 text-amber-400`}><Clock size={10} /> Menunggu</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="bg-slate-900 border border-slate-800/80 rounded-t-3xl sm:rounded-2xl w-full max-w-[380px] max-h-[85vh] overflow-y-auto shadow-2xl pb-6 scrollbar-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/60 px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Dompet Warga</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* SALDO CARD */}
              <div className="bg-gradient-to-b from-slate-800/40 to-slate-800/10 rounded-2xl p-5 border border-slate-800/80 text-center">
                <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Saldo Anda</p>
                <h2 className="text-3xl font-black text-emerald-400 my-1.5 tracking-tight">
                  Rp {(userSaldo || 0).toLocaleString("id-ID")}
                </h2>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <p className="text-[11px] text-slate-500">
                    💰 Poin: <strong className="text-emerald-400">{userPoints}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    💱 1 Poin = Rp {POIN_TO_SALDO_RATE.toLocaleString()}
                  </p>
                </div>
                {!isEligible && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Minimal penarikan senilai <strong>Rp {MIN_WITHDRAW.toLocaleString("id-ID")}</strong>
                  </p>
                )}
              </div>

              {/* 🔥 BARU: KONVERSI POIN KE SALDO */}
              <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">Tukar Poin Jadi Saldo</p>
                      <p className="text-[9px] text-slate-400">
                        {userPoints} Poin = Rp {(userPoints * POIN_TO_SALDO_RATE).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handlePoinToSaldo}
                    disabled={userPoints < 10}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${userPoints >= 10
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                  >
                    {userPoints >= 10 ? "Tukar" : "Min 10 Poin"}
                  </button>
                </div>
              </div>

              {/* KESEMPATAN DAPAT SALDO */}
              {moneyOpportunities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Kesempatan Dapat Saldo
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {moneyOpportunities.slice(0, 3).map((opp) => (
                      <button
                        key={opp.id}
                        onClick={() => {
                          if (onOpportunityClick) {
                            onOpportunityClick(opp);
                          }
                        }}
                        className="w-full p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-left hover:bg-emerald-500/20 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-xl">{opp.icon || "💰"}</div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-200">{opp.title}</p>
                            <p className="text-[9px] text-slate-400 line-clamp-1">{opp.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-emerald-400">+Rp{opp.reward_value?.toLocaleString()}</p>
                            <p className="text-[8px] text-slate-500">📅 {new Date(opp.deadline).toLocaleDateString('id-ID')}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {moneyOpportunities.length > 3 && (
                      <p className="text-[9px] text-slate-500 text-center">
                        +{moneyOpportunities.length - 3} kesempatan lainnya
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ========== SECTION TOP-UP SALDO ========== */}
              <div className="border-t border-slate-800 pt-4">
                <button
                  onClick={() => setShowTopUpOptions(!showTopUpOptions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-slate-800 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-200">Top-Up Saldo</p>
                      <p className="text-[9px] text-slate-400">Dapat bonus & poin</p>
                    </div>
                  </div>
                  <ArrowUpRight className={`w-4 h-4 text-slate-400 transition-transform ${showTopUpOptions ? 'rotate-90' : ''}`} />
                </button>

                <AnimatePresence>
                  {showTopUpOptions && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {TOP_UP_PACKAGES.map((pkg) => (
                          <button
                            key={pkg.price}
                            onClick={() => handleTopUpSaldo(pkg)}
                            disabled={isProcessingPayment}
                            className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 transition-all text-center disabled:opacity-50 relative"
                          >
                            <p className="text-sm font-bold text-emerald-400">{pkg.label}</p>
                            {pkg.bonus > 0 && (
                              <p className="text-[8px] text-amber-400">+Rp{pkg.bonus.toLocaleString()}</p>
                            )}
                            {pkg.points > 0 && (
                              <p className="text-[8px] text-emerald-400">+{pkg.points} Poin</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isProcessingPayment && (
                  <div className="text-center mt-2">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[10px] text-slate-400 mt-1">Memproses pembayaran...</p>
                  </div>
                )}
              </div>

              {/* WITHDRAW BUTTON */}
              {!showWithdrawForm ? (
                <button
                  onClick={() => setShowWithdrawForm(true)}
                  disabled={!isEligible}
                  className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 tracking-wide uppercase ${isEligible
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 cursor-pointer"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                >
                  <Banknote size={14} />
                  Tarik Saldo Ke Rekening
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2.5 bg-slate-800/20 rounded-2xl p-4 border border-slate-800/60"
                >
                  <p className="text-xs font-bold text-slate-300 mb-1">Tujuan Transfer</p>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500/50 outline-none transition-colors"
                    required
                  >
                    <option value="">Pilih Bank</option>
                    {["BCA", "Mandiri", "BRI", "BNI", "BSI", "CIMB Niaga", "SeaBank"].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="Other">Bank Lainnya</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Nomor Rekening"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500/50 outline-none transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Nama Pemilik Rekening"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500/50 outline-none transition-colors"
                  />
                  <input
                    type="number"
                    placeholder={`Minimal Rp ${MIN_WITHDRAW.toLocaleString()}`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500/50 outline-none transition-colors"
                  />
                  <div className="flex gap-2 pt-1.5">
                    <button
                      onClick={handleWithdrawRequest}
                      disabled={submitting}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Memproses..." : "Ajukan"}
                    </button>
                    <button
                      onClick={() => setShowWithdrawForm(false)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </motion.div>
              )}

              {/* TABLES */}
              <div className="space-y-3">
                <div className="flex border-b border-slate-800">
                  <button
                    onClick={() => setActiveTab("income")}
                    className={`flex-1 pb-2.5 text-xs font-bold transition-all text-center border-b-2 ${activeTab === "income" ? "text-emerald-400 border-emerald-400" : "text-slate-500 border-transparent"
                      }`}
                  >
                    Pemasukan
                  </button>
                  <button
                    onClick={() => setActiveTab("withdraw")}
                    className={`flex-1 pb-2.5 text-xs font-bold transition-all text-center border-b-2 ${activeTab === "withdraw" ? "text-emerald-400 border-emerald-400" : "text-slate-500 border-transparent"
                      }`}
                  >
                    Penarikan ({withdrawRequests.length})
                  </button>
                </div>

                <div className="space-y-2 min-h-[150px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : activeTab === "income" ? (
                    transactions.length > 0 ? (
                      transactions.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/10 border border-slate-800/40">
                          <div className="overflow-hidden pr-2">
                            <p className="text-xs font-medium text-slate-200 truncate flex items-center gap-1">
                              {item.icon} {item.title}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-md ${item.type === 'poin_conversion'
                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                            : 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10'
                            }`}>
                            {item.type === 'poin_conversion' ? '+' : ''}Rp {item.amount?.toLocaleString("id-ID")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <p className="text-xs">Belum ada pemasukan.</p>
                        <p className="text-[10px] text-slate-600 mt-1">Ikuti bounty atau tukar poin!</p>
                      </div>
                    )
                  ) : (
                    withdrawRequests.length > 0 ? (
                      withdrawRequests.map((req) => (
                        <div key={req.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/10 border border-slate-800/40">
                          <div>
                            <p className="text-xs font-medium text-slate-200">Tarik Cash ({req.bank_name})</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-slate-300 mb-1">-Rp {req.amount.toLocaleString("id-ID")}</p>
                            {getStatusBadge(req.status)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <p className="text-xs">Belum ada pengajuan penarikan.</p>
                      </div>
                    )
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
