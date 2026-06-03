"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, History, Banknote, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function SaldoModal({ isOpen, onClose, userId, userSaldo, onSaldoUpdated }) {
  const [transactions, setTransactions] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("income"); // "income" atau "withdraw"

  // Form withdraw
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const MIN_WITHDRAW = 50000;
  const isEligible = userSaldo >= MIN_WITHDRAW;

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Eksekusi semua query secara paralel agar load super kencang
        const [bountyRes, programRes, withdrawRes] = await Promise.all([
          supabase
            .from("bounty_submissions")
            .select(`id, title, reward_value, created_at, opportunities:opportunity_id (title, icon)`)
            .eq("user_id", userId)
            .eq("reward_type", "money")
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("user_opportunities")
            .select(`id, created_at, opportunities:opportunity_id (title, icon, reward_value, reward_type)`)
            .eq("user_id", userId)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("withdraw_requests")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10)
        ]);

        // Olah data transaksi masuk
        const allTransactions = [
          ...(bountyRes.data || []).map(t => ({
            id: t.id,
            title: t.opportunities?.title || t.title,
            icon: t.opportunities?.icon || "🎯",
            amount: t.reward_value,
            date: t.created_at,
          })),
          ...(programRes.data || [])
            .filter(p => p.opportunities?.reward_type === "money")
            .map(p => ({
              id: p.id,
              title: p.opportunities?.title,
              icon: p.opportunities?.icon || "🎁",
              amount: p.opportunities?.reward_value,
              date: p.created_at,
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
      alert("Lengkapi data rekening");
      return;
    }

    setSubmitting(true);
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

    if (!error) {
      alert("✅ Permintaan penarikan telah diajukan!\n\nProses transfer memerlukan waktu maksimal 1x24 jam.");
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setBankName("");
      setAccountNumber("");
      setAccountName("");
      if (onSaldoUpdated) onSaldoUpdated();
    } else {
      alert("Gagal mengajukan penarikan: " + error.message);
    }
    setSubmitting(false);
  };

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
          {/* ==================== HEADER ==================== */}
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
            {/* ==================== SALDO CARD ==================== */}
            <div className="bg-gradient-to-b from-slate-800/40 to-slate-800/10 rounded-2xl p-5 border border-slate-800/80 text-center">
              <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Saldo Anda</p>
              <h2 className="text-3xl font-black text-emerald-400 my-1.5 tracking-tight">
                Rp {(userSaldo || 0).toLocaleString("id-ID")}
              </h2>
              {!isEligible && (
                <p className="text-[11px] text-slate-500">
                  Minimal penarikan senilai <strong>Rp {MIN_WITHDRAW.toLocaleString("id-ID")}</strong>
                </p>
              )}
            </div>

            {/* ==================== PENARIKAN FORM / TRIGGER BUTTON ==================== */}
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
                  placeholder="Jumlah Penarikan (Rp)"
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

            {/* ==================== TABS MUTASI HISTORY ==================== */}
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

              {/* RENDER LIST BERDASARKAN TAB */}
              <div className="space-y-2 min-h-[150px]">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : activeTab === "income" ? (
                  // TAB PEMASUKAN
                  transactions.length > 0 ? (
                    transactions.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/10 border border-slate-800/40">
                        <div className="overflow-hidden pr-2">
                          <p className="text-xs font-medium text-slate-200 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-emerald-400 shrink-0 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                          +Rp {item.amount?.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p className="text-xs">Belum ada pemasukan.</p>
                    </div>
                  )
                ) : (
                  // TAB PENARIKAN
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
    </AnimatePresence>
  );
}