"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus, Edit, Trash2, Eye, EyeOff, TrendingUp, History, Gift,
  Users, CheckCircle, Clock, DollarSign, Tv, Video, Crown,
  RefreshCw, Ban, Play, Square, AlertTriangle, Banknote, Download
} from "lucide-react";

export default function ManageVouchersPage() {
  const [activeTab, setActiveTab] = useState('vouchers');
  const [vouchers, setVouchers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [liveAccessTransactions, setLiveAccessTransactions] = useState([]);
  const [merchantRecap, setMerchantRecap] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);

  const [topupTransactions, setTopupTransactions] = useState([]);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchVouchers(), fetchTransactions(), fetchLiveAccess(), fetchVideos(), fetchTopups()]);
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

      const fetchTopups = async () => {
        try {
          const { data: topupData, error } = await supabase
            .from("voucher_transactions")
            .select("*")
            .eq("metadata->>type", "topup_saldo")
            .order("created_at", { ascending: false });

          if (error) throw error;

          if (!topupData || topupData.length === 0) {
            setTopupTransactions([]);
            return;
          }

          const userIds = [...new Set(topupData.map(t => t.user_id).filter(Boolean))];
          let usersData = [];
          if (userIds.length > 0) {
            const { data } = await supabase
              .from("profiles")
              .select("id, full_name, username, email")
              .in("id", userIds);
            usersData = data || [];
          }

          const userMap = new Map(usersData.map(u => [u.id, u]));

          const enrichedTopups = topupData.map(t => ({
            ...t,
            profiles: userMap.get(t.user_id) || { full_name: "Warga Anonim", username: "anon" },
            order_id: t.metadata?.order_id || "-",
          }));

          setTopupTransactions(enrichedTopups);
        } catch (err) {
          console.error("Error fetching topups:", err);
        }
      };

      const userIds = [...new Set(transData.map(t => t.user_id).filter(Boolean))];
      let usersData = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds);
        usersData = data || [];
      }

      const voucherIds = [...new Set(transData.map(t => t.voucher_id).filter(Boolean))];
      let vouchersData = [];
      if (voucherIds.length > 0) {
        const { data } = await supabase
          .from("vouchers")
          .select("id, name, code, merchant, points_required, type")
          .in("id", voucherIds);
        vouchersData = data || [];
      }

      const userMap = new Map(usersData.map(u => [u.id, u]));
      const voucherMap = new Map(vouchersData.map(v => [v.id, v]));

      const enrichedTransactions = transData.map(trans => ({
        ...trans,
        profiles: userMap.get(trans.user_id) || { full_name: 'Warga Anonim', username: 'anon' },
        vouchers: voucherMap.get(trans.voucher_id) || { name: 'Voucher Terhapus', code: '-', merchant: 'Unknown', type: 'physical' }
      }));

      setTransactions(enrichedTransactions);

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
        else if (trans.status === 'redeemed' || trans.status === 'active') rec.total_claimed++;
        rec.total_points += trans.points_spent || 0;
      });
      setMerchantRecap(Array.from(merchantMap.values()));

    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const fetchTopups = async () => {
    try {
      const { data: topupData, error } = await supabase
        .from("voucher_transactions")
        .select("*")
        .eq("metadata->>type", "topup_saldo")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!topupData || topupData.length === 0) {
        setTopupTransactions([]);
        return;
      }

      const userIds = [...new Set(topupData.map(t => t.user_id).filter(Boolean))];
      let usersData = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, email")
          .in("id", userIds);
        usersData = data || [];
      }

      const userMap = new Map(usersData.map(u => [u.id, u]));

      const enrichedTopups = topupData.map(t => ({
        ...t,
        profiles: userMap.get(t.user_id) || { full_name: "Warga Anonim", username: "anon" },
        order_id: t.metadata?.order_id || "-",
      }));

      setTopupTransactions(enrichedTopups);
    } catch (err) {
      console.error("Error fetching topups:", err);
    }
  };

  const fetchLiveAccess = async () => {
    try {
      const { data, error } = await supabase
        .from("voucher_transactions")
        .select(`
          *,
          profiles:user_id (id, full_name, username),
          vouchers:voucher_id (id, name, code, merchant, type)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLiveAccessTransactions(data || []);
    } catch (err) {
      console.error("Error fetching live access:", err);
    }
  };

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setVideos(data);
    } catch (err) {
      console.error("Error fetching videos:", err);
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

  const handleRevokeLiveAccess = async (transactionId) => {
    if (!confirm("Yakin ingin mencabut akses live user ini?")) return;

    try {
      const { error } = await supabase
        .from("voucher_transactions")
        .update({
          status: 'redeemed',
          claimed_at: new Date().toISOString()
        })
        .eq("id", transactionId);

      if (error) throw error;

      alert("✅ Akses live berhasil dicabut!");
      fetchLiveAccess();
      fetchTransactions();
    } catch (err) {
      alert("Gagal mencabut akses: " + err.message);
    }
  };

  const handleDeleteVideo = async (id) => {
    if (confirm("Hapus video ini?")) {
      await supabase.from("videos").delete().eq("id", id);
      fetchVideos();
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'Menunggu Klaim', color: 'bg-yellow-500/20 text-yellow-400' },
      'active': { label: '✅ Aktif', color: 'bg-green-500/20 text-green-400' },
      'redeemed': { label: 'Sudah Diklaim', color: 'bg-emerald-500/20 text-emerald-400' },
      'expired': { label: 'Kadaluarsa', color: 'bg-red-500/20 text-red-400' },
      'revoked': { label: 'Dicabut', color: 'bg-red-500/20 text-red-400' },
    };
    const config = statusMap[status] || { label: status, color: 'bg-slate-500/20 text-slate-400' };
    return <span className={`px-2 py-0.5 ${config.color} rounded-full text-[10px] font-bold`}>{config.label}</span>;
  };

  const getTypeBadge = (type) => {
    const typeMap = {
      'physical': { label: '🏪 Fisik', color: 'bg-amber-500/20 text-amber-400' },
      'live': { label: '🔴 LIVE', color: 'bg-red-500/20 text-red-400' },
      'video': { label: '🎬 Video', color: 'bg-blue-500/20 text-blue-400' },
      'subscription': { label: '📺 Berlangganan', color: 'bg-purple-500/20 text-purple-400' },
    };
    const config = typeMap[type] || { label: type, color: 'bg-slate-500/20 text-slate-400' };
    return <span className={`px-2 py-0.5 ${config.color} rounded-full text-[10px] font-bold`}>{config.label}</span>;
  };

  const exportTopupCSV = () => {
    const headers = ["Nama", "Username", "Order ID", "Jumlah", "Status", "Tanggal Top-Up", "Tanggal Selesai"];

    const rows = topupTransactions.map(t => [
      t.profiles?.full_name || "-",
      t.profiles?.username || "-",
      t.order_id,
      t.amount || 0,
      t.status,
      formatDateTime(t.created_at),
      formatDateTime(t.claimed_at),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap-topup-saldo-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString('id-ID');
    } catch {
      return "-";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString('id-ID');
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
          <button
            onClick={() => setActiveTab('topup')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'topup'
              ? 'border-b-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <Banknote size={16} />
            Top-Up Saldo
            {topupTransactions.filter(t => t.status === 'pending').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">
                {topupTransactions.filter(t => t.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('live-access')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'live-access'
              ? 'border-b-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <Tv size={16} />
            Akses Live
            {liveAccessTransactions.filter(t => t.status === 'active').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold">
                {liveAccessTransactions.filter(t => t.status === 'active').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'videos'
              ? 'border-b-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <Video size={16} />
            Video
          </button>
        </div>

        {/* TAB 1: VOUCHER LIST */}
        {activeTab === 'vouchers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vouchers.map((voucher) => (
              <div key={voucher.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{voucher.name}</h3>
                      {getTypeBadge(voucher.type)}
                    </div>
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

                {voucher.type === 'live' && voucher.stream_id && (
                  <p className="text-[10px] text-red-400/70 mt-1">
                    🔴 Stream ID: {voucher.stream_id}
                  </p>
                )}
                {voucher.type === 'video' && voucher.video_id && (
                  <p className="text-[10px] text-blue-400/70 mt-1">
                    🎬 Video ID: {voucher.video_id}
                  </p>
                )}

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
                    <th className="p-3 text-left text-slate-400 text-xs">Tipe</th>
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
                      <td colSpan="8" className="p-8 text-center text-slate-500">Belum ada transaksi</td>
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
                        <td className="p-3">{getTypeBadge(trans.vouchers?.type)}</td>
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
                <p className="text-2xl font-bold text-white">{transactions.filter(t => t.status === 'redeemed' || t.status === 'active').length}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <DollarSign size={18} />
                  <span className="text-xs font-bold">Total Poin Dikeluarkan</span>
                </div>
                <p className="text-2xl font-bold text-white">{transactions.reduce((sum, t) => sum + (t.points_spent || 0), 0).toLocaleString()}</p>
              </div>
            </div>

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

            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400">
                💡 <strong>Catatan:</strong> Estimasi tagihan dihitung berdasarkan total poin yang sudah diklaim.
                Merchant dapat mengajukan penarikan dana sesuai dengan total poin yang sudah diklaim.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE ACCESS */}
        {activeTab === 'live-access' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold">🔴 Akses Live Aktif</h3>
                <p className="text-slate-400 text-xs">User yang sedang memiliki akses live</p>
              </div>
              <button
                onClick={fetchLiveAccess}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-xs transition flex items-center gap-1"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 border-b border-slate-700">
                  <tr>
                    <th className="p-3 text-left text-slate-400 text-xs">User</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Voucher</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Status</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Mulai Akses</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Expired</th>
                    <th className="p-3 text-left text-slate-400 text-xs">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {liveAccessTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        Tidak ada akses live aktif
                      </td>
                    </tr>
                  ) : (
                    liveAccessTransactions.map((trans) => (
                      <tr key={trans.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                        <td className="p-3">
                          <p className="text-white text-sm font-medium">{trans.profiles?.full_name || 'Warga'}</p>
                          <p className="text-slate-500 text-[10px]">@{trans.profiles?.username || 'anon'}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-white text-sm">{trans.vouchers?.name}</p>
                          <p className="text-slate-500 text-[10px]">{trans.vouchers?.code}</p>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                            <Play size={10} /> AKTIF
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-xs">
                          {formatDateTime(trans.redeemed_at)}
                        </td>
                        <td className="p-3 text-slate-400 text-xs">
                          {formatDateTime(trans.expired_at)}
                          {new Date(trans.expired_at) < new Date() && (
                            <span className="ml-1 text-red-400 text-[10px]">⚠️</span>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleRevokeLiveAccess(trans.id)}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <Ban size={12} /> Cabut Akses
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/30">
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <strong>Catatan:</strong> Mencabut akses akan mengubah status menjadi 'redeemed' dan user tidak bisa mengakses live lagi.
              </p>
            </div>
          </div>
        )}

        {/* TAB BARU: TOP-UP SALDO */}
        {activeTab === 'topup' && (
          <div className="space-y-4">
            {/* Rekap Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle size={18} />
                  <span className="text-xs font-bold">Total Masuk (Selesai)</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  Rp{topupTransactions
                    .filter(t => t.status === 'completed')
                    .reduce((sum, t) => sum + (t.amount || 0), 0)
                    .toLocaleString('id-ID')}
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <Clock size={18} />
                  <span className="text-xs font-bold">Menunggu Pembayaran</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {topupTransactions.filter(t => t.status === 'pending').length}
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                  <AlertTriangle size={18} />
                  <span className="text-xs font-bold">Gagal</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {topupTransactions.filter(t => t.status === 'failed').length}
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-sky-400 mb-2">
                  <History size={18} />
                  <span className="text-xs font-bold">Total Transaksi</span>
                </div>
                <p className="text-2xl font-bold text-white">{topupTransactions.length}</p>
              </div>
            </div>

            {/* Tombol Export */}
            <div className="flex justify-end">
              <button
                onClick={exportTopupCSV}
                disabled={topupTransactions.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>

            {/* Tabel */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      <th className="p-3 text-left text-slate-400 text-xs">Warga</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Order ID</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Jumlah</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Status</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Tgl Top-Up</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Tgl Selesai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topupTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500">Belum ada transaksi top-up</td>
                      </tr>
                    ) : (
                      topupTransactions.map((t) => (
                        <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="p-3">
                            <p className="text-white text-sm font-medium">{t.profiles?.full_name}</p>
                            <p className="text-slate-500 text-[10px]">@{t.profiles?.username}</p>
                          </td>
                          <td className="p-3 text-slate-400 text-[10px] font-mono">{t.order_id}</td>
                          <td className="p-3 text-emerald-400 text-sm font-bold">Rp{(t.amount || 0).toLocaleString('id-ID')}</td>
                          <td className="p-3">
                            {t.status === 'completed' && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">✅ Selesai</span>}
                            {t.status === 'pending' && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">⏳ Menunggu</span>}
                            {t.status === 'failed' && <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full text-[10px] font-bold">❌ Gagal</span>}
                          </td>
                          <td className="p-3 text-slate-400 text-xs">{formatDateTime(t.created_at)}</td>
                          <td className="p-3 text-slate-400 text-xs">{formatDateTime(t.claimed_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: VIDEOS */}
        {activeTab === 'videos' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingVideo(null);
                  setShowVideoModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 rounded-xl text-white font-bold flex items-center gap-2 hover:bg-emerald-700 transition"
              >
                <Plus size={18} /> Tambah Video
              </button>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      <th className="p-3 text-left text-slate-400 text-xs">Judul</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Kategori</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Durasi</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Premium</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Status</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Views</th>
                      <th className="p-3 text-left text-slate-400 text-xs">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-500">Belum ada video</td>
                      </tr>
                    ) : (
                      videos.map((video) => (
                        <tr key={video.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="p-3">
                            <p className="text-white text-sm font-medium">{video.title}</p>
                            {video.thumbnail_url && (
                              <img src={video.thumbnail_url} alt="" className="w-12 h-8 object-cover rounded mt-1" />
                            )}
                          </td>
                          <td className="p-3 text-slate-300 text-sm">{video.category || '-'}</td>
                          <td className="p-3 text-slate-300 text-sm">
                            {video.duration ? `${Math.floor(video.duration / 60)}m ${video.duration % 60}s` : '-'}
                          </td>
                          <td className="p-3">
                            {video.is_premium ? (
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-bold">Premium</span>
                            ) : (
                              <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-lg text-xs font-bold">Free</span>
                            )}
                          </td>
                          <td className="p-3">
                            {video.is_active ? (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold">Aktif</span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold">Nonaktif</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-300 text-sm">{video.views_count || 0}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingVideo(video);
                                  setShowVideoModal(true);
                                }}
                                className="p-1.5 bg-slate-700 rounded-lg hover:bg-slate-600"
                              >
                                <Edit size={14} className="text-slate-300" />
                              </button>
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30"
                              >
                                <Trash2 size={14} className="text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Form Voucher */}
        {showModal && (
          <VoucherModal
            voucher={editingVoucher}
            videos={videos}
            onClose={() => setShowModal(false)}
            onSuccess={() => {
              fetchVouchers();
              fetchTransactions();
              setShowModal(false);
            }}
          />
        )}

        {/* Modal Form Video */}
        {showVideoModal && (
          <VideoModal
            video={editingVideo}
            onClose={() => setShowVideoModal(false)}
            onSuccess={() => {
              fetchVideos();
              setShowVideoModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// VOUCHER MODAL
// ============================================================
function VoucherModal({ voucher, videos, onClose, onSuccess }) {
  const [form, setForm] = useState({
    code: voucher?.code || "",
    name: voucher?.name || "",
    description: voucher?.description || "",
    merchant: voucher?.merchant || "",
    points_required: voucher?.points_required || 100,
    quota: voucher?.quota || "",
    is_active: voucher?.is_active ?? true,
    type: voucher?.type || "physical",
    stream_id: voucher?.stream_id || "",
    video_id: voucher?.video_id || "",
    saldo_price: voucher?.saldo_price || 5000,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      code: form.code,
      name: form.name,
      description: form.description,
      merchant: form.merchant,
      points_required: parseInt(form.points_required),
      quota: form.quota ? parseInt(form.quota) : null,
      is_active: form.is_active,
      type: form.type,
      stream_id: form.type === 'live' ? form.stream_id : null,
      video_id: form.type === 'video' ? form.video_id : null,
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
    } else {
      alert("Error: " + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
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

          {/* Tipe Voucher */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Tipe Voucher *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              required
            >
              <option value="physical">🏪 Fisik (Makanan/Kopi)</option>
              <option value="live">🔴 Live Streaming</option>
              <option value="video">🎬 Video Premium</option>
              <option value="subscription">📺 Berlangganan</option>
            </select>
          </div>

          {/* Field khusus LIVE */}
          {form.type === 'live' && (
            <div>
              <label className="text-sm text-slate-400 block mb-1">Stream ID *</label>
              <input
                type="text"
                value={form.stream_id}
                onChange={(e) => setForm({ ...form, stream_id: e.target.value })}
                placeholder="Masukkan Live Input ID dari Cloudflare"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Contoh: 66be4bf738797e01e1fca35a7bdecdcd
              </p>
            </div>
          )}

          {/* Field khusus VIDEO */}
          {form.type === 'video' && (
            <div>
              <label className="text-sm text-slate-400 block mb-1">Pilih Video *</label>
              <select
                value={form.video_id}
                onChange={(e) => setForm({ ...form, video_id: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                required
              >
                <option value="">Pilih Video</option>
                {videos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.title} {video.is_premium ? '⭐' : ''}
                  </option>
                ))}
              </select>
              {videos.length === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  ⚠️ Belum ada video. Tambahkan video dulu di tab Video.
                </p>
              )}
            </div>
          )}

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

// ============================================================
// VIDEO MODAL
// ============================================================
function VideoModal({ video, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: video?.title || "",
    description: video?.description || "",
    thumbnail_url: video?.thumbnail_url || "",
    video_url: video?.video_url || "",
    duration: video?.duration || "",
    category: video?.category || "",
    is_premium: video?.is_premium ?? true,
    is_active: video?.is_active ?? true,
    saldo_price: video?.saldo_price || 5000,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      title: form.title,
      description: form.description,
      thumbnail_url: form.thumbnail_url,
      video_url: form.video_url,
      duration: form.duration ? parseInt(form.duration) : null,
      category: form.category || null,
      is_premium: form.is_premium,
      is_active: form.is_active,
      saldo_price: form.saldo_price || 5000,
    };

    let error;
    if (video) {
      const { error: updateError } = await supabase
        .from("videos")
        .update(data)
        .eq("id", video.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("videos")
        .insert([data]);
      error = insertError;
    }

    if (!error) {
      onSuccess();
      onClose();
    } else {
      alert("Error: " + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {video ? "Edit Video" : "Tambah Video Baru"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Judul Video *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
            <label className="text-sm text-slate-400 block mb-1">URL Video *</label>
            <input
              type="url"
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=... atau https://..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Bisa pakai YouTube, Vimeo, atau direct video URL
            </p>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">URL Thumbnail</label>
            <input
              type="url"
              value={form.thumbnail_url}
              onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
              placeholder="https://example.com/thumbnail.jpg"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Durasi (detik)</label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                min={1}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Kategori</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Kuliner, Wisata, dll"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              />
            </div>
          </div>

          {/* 🔥 TAMBAHKAN FIELD HARGA SALDO DI SINI */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Harga Saldo (Rp)</label>
            <input
              type="number"
              value={form.saldo_price || 5000}
              onChange={(e) => setForm({ ...form, saldo_price: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              min={1000}
              step={1000}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Harga dalam Rupiah untuk pembelian via saldo (contoh: 5000)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={form.is_premium}
                onChange={(e) => setForm({ ...form, is_premium: e.target.checked })}
                className="w-4 h-4"
              />
              Premium (butuh voucher)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              Aktif
            </label>
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
              {saving ? "Menyimpan..." : video ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 