"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit, Trash2, Eye, EyeOff, TrendingUp, History, Gift, Users, CheckCircle, Clock, DollarSign } from "lucide-react";

export default function ManageVouchersPage() {
  const [activeTab, setActiveTab] = useState('vouchers'); // 'vouchers', 'transactions', 'merchant-recap'
  const [vouchers, setVouchers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [merchantRecap, setMerchantRecap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);

  // Satukan inisialisasi data agar loading selesai bersamaan
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchVouchers(), fetchTransactions()]);
      setLoading(false);
    };
    initData();
  }, []);

  const fetchVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setVouchers(data);
    } catch (err) {
      console.error("Error fetching vouchers:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      // 1. Ambil transaksi dulu
      const { data: transData, error: transError } = await supabase
        .from("voucher_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (transError) throw transError;

      if (!transData || transData.length === 0) {
        setTransactions([]);
        setMerchantRecap([]);
        return;
      }

      // 2. Ambil data user (profiles)
      const userIds = [...new Set(transData.map(t => t.user_id).filter(Boolean))];
      let usersData = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds);
        usersData = data || [];
      }

      // 3. Ambil data voucher
      const voucherIds = [...new Set(transData.map(t => t.voucher_id).filter(Boolean))];
      let vouchersData = [];
      if (voucherIds.length > 0) {
        const { data } = await supabase
          .from("vouchers")
          .select("id, name, code, merchant, points_required")
          .in("id", voucherIds);
        vouchersData = data || [];
      }

      // 4. Gabungkan data dengan aman
      const userMap = new Map(usersData.map(u => [u.id, u]));
      const voucherMap = new Map(vouchersData.map(v => [v.id, v]));

      const enrichedTransactions = transData.map(trans => ({
        ...trans,
        profiles: userMap.get(trans.user_id) || { full_name: 'Warga Anonim', username: 'anon' },
        vouchers: voucherMap.get(trans.voucher_id) || { name: 'Voucher Terhapus', code: '-', merchant: 'Unknown' }
      }));

      console.log("✅ Enriched transactions:", enrichedTransactions);
      setTransactions(enrichedTransactions);

      // 5. Hitung rekap merchant
      const merchantMap = new Map();
      enrichedTransactions.forEach(trans => {
        const merchant = trans.vouchers?.merchant || 'Unknown';
        if (!merchantMap.has(merchant)) {
          merchantMap.set(merchant, {
            merchant,
            total_redeemed: 0,
            total_claimed: 0,
            total_points: 0,
          });
        }
        const rec = merchantMap.get(merchant);
        if (trans.status === 'pending') rec.total_redeemed++;
        else if (trans.status === 'redeemed') rec.total_claimed++;
        rec.total_points += trans.points_spent || 0;
      });
      setMerchantRecap(Array.from(merchantMap.values()));

    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Hapus voucher ini?")) {
      await supabase.from("vouchers").delete().eq("id", id);
      fetchVouchers();
    }
  };

  const toggleActive = async (voucher) => {
    await supabase
      .from("vouchers")
      .update({ is_active: !voucher.is_active })
      .eq("id", voucher.id);
    fetchVouchers();
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') {
      return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-[10px] font-bold">Menunggu Klaim</span>;
    }
    if (status === 'redeemed') {
      return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">Sudah Diklaim</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded-full text-[10px] font-bold">{status}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString('id-ID');
    } catch {
      return "-";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-medium">
        Memuat data portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-5">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Manajemen Voucher</h1>
          {activeTab === 'vouchers' && (
            <button
              onClick={() => {
                setEditingVoucher(null);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 rounded-xl text-white font-bold flex items-center gap-2 hover:bg-emerald-700 transition"
            >
              <Plus size={18} /> Buat Voucher
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-slate-700 flex-wrap">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'vouchers'
              ? 'border-b-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <Gift size={16} />
            Voucher
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'transactions'
              ? 'border-b-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <History size={16} />
            Riwayat Transaksi
          </button>
          <button
            onClick={() => setActiveTab('merchant-recap')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'merchant-recap'
              ? 'border-b-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <TrendingUp size={16} />
            Rekap Merchant
          </button>
        </div>

        {/* TAB 1: VOUCHER LIST */}
        {activeTab === 'vouchers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vouchers.map((voucher) => (
              <div key={voucher.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white">{voucher.name}</h3>
                    <p className="text-xs text-slate-400">{voucher.code}</p>
                  </div>
                  <button onClick={() => toggleActive(voucher)}>
                    {voucher.is_active ? (
                      <Eye className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                </div>

                <p className="text-sm text-slate-300 mt-2">{voucher.description}</p>
                <p className="text-xs text-amber-400 mt-1">{voucher.merchant}</p>

                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                  <span className="text-emerald-400 font-bold">{voucher.points_required} Poin</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingVoucher(voucher);
                        setShowModal(true);
                      }}
                      className="p-1.5 bg-slate-700 rounded-lg hover:bg-slate-600"
                    >
                      <Edit size={14} className="text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(voucher.id)}
                      className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>

                {voucher.quota && (
                  <p className="text-[10px] text-slate-500 mt-2">
                    Kuota: {voucher.used_count || 0}/{voucher.quota}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: RIWAYAT TRANSAKSI */}
        {activeTab === 'transactions' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 border-b border-slate-700">
                  <tr>
                    <th className="p-3 text-left text-slate-400 text-xs">User</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Voucher</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Merchant</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Poin</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Status</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Ditukar</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Diklaim</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500">Belum ada transaksi</td>
                    </tr>
                  ) : (
                    transactions.map((trans) => (
                      <tr key={trans.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                        <td className="p-3">
                          <div>
                            <p className="text-white text-sm font-medium">{trans.profiles?.full_name}</p>
                            <p className="text-slate-500 text-[10px]">@{trans.profiles?.username}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-white text-sm">{trans.vouchers?.name}</p>
                          <p className="text-slate-500 text-[10px]">{trans.vouchers?.code}</p>
                        </td>
                        <td className="p-3 text-slate-300 text-sm">{trans.vouchers?.merchant}</td>
                        <td className="p-3 text-emerald-400 text-sm font-medium">{trans.points_spent || 0}</td>
                        <td className="p-3">{getStatusBadge(trans.status)}</td>
                        <td className="p-3 text-slate-400 text-xs">
                          {formatDate(trans.created_at || trans.redeemed_at)}
                        </td>
                        <td className="p-3 text-slate-400 text-xs">
                          {formatDate(trans.claimed_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: REKAP MERCHANT */}
        {activeTab === 'merchant-recap' && (
          <div className="space-y-4">
            {/* Ringkasan Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <Gift size={18} />
                  <span className="text-xs font-bold">Total Voucher Ditukar</span>
                </div>
                <p className="text-2xl font-bold text-white">{transactions.filter(t => t.status === 'pending').length}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle size={18} />
                  <span className="text-xs font-bold">Total Voucher Diklaim</span>
                </div>
                <p className="text-2xl font-bold text-white">{transactions.filter(t => t.status === 'redeemed').length}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <DollarSign size={18} />
                  <span className="text-xs font-bold">Total Poin Dikeluarkan</span>
                </div>
                <p className="text-2xl font-bold text-white">{transactions.reduce((sum, t) => sum + (t.points_spent || 0), 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Rekap per Merchant */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      <th className="p-3 text-left text-slate-400 text-xs">Merchant</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Menunggu Klaim</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Sudah Diklaim</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Total Poin</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Estimasi Tagihan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchantRecap.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500">Belum ada data merchant</td>
                      </tr>
                    ) : (
                      merchantRecap.map((merchant) => (
                        <tr key={merchant.merchant} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="p-3">
                            <p className="text-white font-medium">{merchant.merchant}</p>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold">
                              {merchant.total_redeemed}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">
                              {merchant.total_claimed}
                            </span>
                          </td>
                          <td className="p-3 text-white">{merchant.total_points.toLocaleString()}</td>
                          <td className="p-3">
                            <span className="text-emerald-400 font-medium">
                              Rp{(merchant.total_points * 100).toLocaleString()}
                            </span>
                            <p className="text-[8px] text-slate-500">Asumsi 1 poin = Rp100</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Catatan */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400">
                💡 <strong>Catatan:</strong> Estimasi tagihan dihitung berdasarkan total poin yang sudah diklaim.
                Merchant dapat mengajukan penarikan dana sesuai dengan total poin yang sudah diklaim.
              </p>
            </div>
          </div>
        )}

        {/* Modal Form Voucher */}
        {showModal && (
          <VoucherModal
            voucher={editingVoucher}
            onClose={() => setShowModal(false)}
            onSuccess={() => {
              fetchVouchers();
              fetchTransactions(); // Ikut refresh riwayat saat voucher berubah
              setShowModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Modal Form Voucher (sama seperti kode Anda, tidak diubah)
function VoucherModal({ voucher, onClose, onSuccess }) {
  const [form, setForm] = useState({
    code: voucher?.code || "",
    name: voucher?.name || "",
    description: voucher?.description || "",
    merchant: voucher?.merchant || "",
    points_required: voucher?.points_required || 100,
    quota: voucher?.quota || "",
    is_active: voucher?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...form,
      quota: form.quota ? parseInt(form.quota) : null,
    };

    let error;
    if (voucher) {
      const { error: updateError } = await supabase
        .from("vouchers")
        .update(data)
        .eq("id", voucher.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("vouchers")
        .insert([data]);
      error = insertError;
    }

    if (!error) {
      onSuccess();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">
          {voucher ? "Edit Voucher" : "Buat Voucher Baru"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Kode Voucher *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Nama Voucher *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Merchant *</label>
            <input
              type="text"
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Poin yang dibutuhkan *</label>
              <input
                type="number"
                value={form.points_required}
                onChange={(e) => setForm({ ...form, points_required: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                required
                min={1}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Kuota (opsional)</label>
              <input
                type="number"
                value={form.quota}
                onChange={(e) => setForm({ ...form, quota: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                min={1}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <label className="text-sm text-slate-400">Aktifkan voucher</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 rounded-xl text-slate-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-emerald-600 rounded-xl text-white font-bold disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : voucher ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}