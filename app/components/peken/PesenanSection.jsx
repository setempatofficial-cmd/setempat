'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, ShoppingBag, User, Store, Clock, 
  CheckCircle, XCircle, Truck, MapPin, MessageCircle,
  Eye, Search, ArrowLeft, X, Loader2,
  ChevronRight, Calendar, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function PesenanSection({ 
  userId, 
  locationName, 
  onBack 
}) {
  const [activeTab, setActiveTab] = useState('masuk');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  
  const [stats, setStats] = useState({
    menunggu: 0,
    diproses: 0,
    dikirim: 0,
    selesai: 0
  });

  // Fetch pesanan
  const fetchOrders = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let query;
      
      if (activeTab === 'masuk') {
        // Sebagai PENJUAL - lihat pesanan atas produk user
        query = supabase
          .from('pesanan')
          .select(`
            *,
            produk:produk_id (
              id,
              nama_barang,
              harga,
              satuan,
              foto_url
            ),
            pembeli:pembeli_id (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('penjual_id', userId)
          .order('created_at', { ascending: false });
      } else {
        // Sebagai PEMBELI - lihat pesanan yang user beli
        query = supabase
          .from('pesanan')
          .select(`
            *,
            produk:produk_id (
              id,
              nama_barang,
              harga,
              satuan,
              foto_url
            ),
            penjual:penjual_id (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('pembeli_id', userId)
          .order('created_at', { ascending: false });
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        // Jika tabel belum ada, jangan tampilkan error
        if (fetchError.code === '42P01') {
          console.log('ℹ️ Tabel pesanan belum tersedia');
          setOrders([]);
          setStats({ menunggu: 0, diproses: 0, dikirim: 0, selesai: 0 });
          return;
        }
        throw fetchError;
      }
      
      setOrders(data || []);
      
      // Hitung statistik untuk tab masuk
      if (activeTab === 'masuk') {
        const waiting = (data || []).filter(o => o?.status === 'menunggu').length;
        const processed = (data || []).filter(o => o?.status === 'diproses').length;
        const shipped = (data || []).filter(o => o?.status === 'dikirim').length;
        const completed = (data || []).filter(o => o?.status === 'selesai').length;
        
        setStats({ 
          menunggu: waiting, 
          diproses: processed, 
          dikirim: shipped, 
          selesai: completed 
        });
      }
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Gagal memuat pesanan');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Update status pesanan
  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setError(null);
    
    try {
      const { error: updateError } = await supabase
        .from('pesanan')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      // Update stats
      if (activeTab === 'masuk') {
        setStats(prev => {
          const oldStatus = orders.find(o => o.id === orderId)?.status;
          const newStats = { ...prev };
          if (oldStatus && newStats[oldStatus] > 0) newStats[oldStatus]--;
          if (newStats[newStatus] !== undefined) newStats[newStatus]++;
          return newStats;
        });
      }
      
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Gagal mengupdate status pesanan');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (searchQuery) {
      const productName = order.produk?.nama_barang?.toLowerCase() || '';
      const buyerName = order.pembeli?.full_name?.toLowerCase() || '';
      const sellerName = order.penjual?.full_name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      
      if (!productName.includes(query) && !buyerName.includes(query) && !sellerName.includes(query)) {
        return false;
      }
    }
    
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    
    return true;
  });

  // Format Rupiah
  const formatRupiah = (harga) => {
    if (!harga && harga !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(harga);
  };

  // Format tanggal
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const config = {
      menunggu: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700', icon: Clock },
      diproses: { label: 'Diproses', color: 'bg-blue-100 text-blue-700', icon: Package },
      dikirim: { label: 'Dikirim', color: 'bg-purple-100 text-purple-700', icon: Truck },
      selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
      dibatalkan: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700', icon: XCircle }
    };
    
    const cfg = config[status] || config.menunggu;
    const Icon = cfg.icon;
    
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold ${cfg.color}`}>
        <Icon size={10} />
        {cfg.label}
      </div>
    );
  };

  // Order Card Component
  const OrderCard = ({ order, type }) => {
    const [expanded, setExpanded] = useState(false);
    const isSeller = type === 'masuk';
    const otherParty = isSeller ? order.pembeli : order.penjual;
    const partyName = otherParty?.full_name || 'Warga';
    const product = order.produk;
    
    const getActionButtons = () => {
      if (isSeller) {
        switch (order.status) {
          case 'menunggu':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'diproses')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-bold"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Proses Pesanan'}
              </button>
            );
          case 'diproses':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'dikirim')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-purple-500 text-white rounded-xl text-[10px] font-bold"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Kirim Pesanan'}
              </button>
            );
          case 'dikirim':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'selesai')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Konfirmasi Selesai'}
              </button>
            );
          default:
            return null;
        }
      } else {
        if (order.status === 'dikirim') {
          return (
            <button
              onClick={() => updateOrderStatus(order.id, 'selesai')}
              disabled={updatingId === order.id}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold"
            >
              {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Pesanan Diterima'}
            </button>
          );
        }
        return null;
      }
    };
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm"
      >
        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isSeller ? 'bg-emerald-50' : 'bg-blue-50'
              }`}>
                {isSeller ? (
                  <Store size={14} className="text-emerald-600" />
                ) : (
                  <ShoppingBag size={14} className="text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-[9px] text-slate-400">
                  {isSeller ? 'Dipesan dari' : 'Pesanan ke'}
                </p>
                <p className="text-[11px] font-bold text-slate-700">
                  {isSeller ? product?.nama_barang || '-' : product?.nama_barang || '-'}
                </p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <div className="flex items-center gap-1">
              <User size={10} />
              <span>{partyName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={10} />
              <span>{formatDate(order.created_at)}</span>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
              {product?.foto_url?.[0] ? (
                <img 
                  src={product.foto_url[0]} 
                  alt={product.nama_barang}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={24} className="text-slate-300" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <h4 className="text-xs font-bold text-slate-800 mb-1">
                {product?.nama_barang || 'Produk tidak tersedia'}
              </h4>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[9px] text-slate-400">
                    {order.jumlah} x {formatRupiah(product?.harga || 0)}
                  </p>
                  <p className="text-sm font-black text-orange-600">
                    {formatRupiah(order.total_harga)}
                  </p>
                </div>
              </div>
              
              {order.catatan && (
                <p className="text-[9px] text-slate-500 bg-slate-50 p-2 rounded-xl mt-2">
                  📝 {order.catatan}
                </p>
              )}
              
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-[9px] font-bold text-slate-400 flex items-center gap-1"
              >
                <Eye size={10} />
                {expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                <ChevronRight size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  {order.alamat_pengiriman && (
                    <div className="flex items-start gap-2">
                      <MapPin size={12} className="text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-bold text-slate-500">Alamat Pengiriman</p>
                        <p className="text-[10px] text-slate-600">{order.alamat_pengiriman}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <MessageCircle size={12} className="text-slate-400" />
                    <button className="text-[10px] font-bold text-orange-500">
                      Hubungi {isSeller ? 'Pembeli' : 'Penjual'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {getActionButtons() && (
          <div className="p-4 pt-0 flex gap-2">
            {getActionButtons()}
            <button className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600">
              Chat
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // Empty State
  const EmptyState = () => (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        {activeTab === 'masuk' ? (
          <Package size={40} className="text-slate-400" />
        ) : (
          <ShoppingBag size={40} className="text-slate-400" />
        )}
      </div>
      <h3 className="text-slate-800 font-black text-lg mb-1">
        {activeTab === 'masuk' ? 'Durung ono pesanan' : 'Durung ono riwayat belanja'}
      </h3>
      <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">
        {activeTab === 'masuk' 
          ? 'Ketika ana warga sing pesan dagangan sampeyan, bakal muncul mrene.'
          : 'Sampeyan durung ono pesanan. Ayo belanja ing Panyangan!'}
      </p>
    </div>
  );

  // Error State
  const ErrorState = () => (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={40} className="text-red-400" />
      </div>
      <h3 className="text-slate-800 font-black text-lg mb-1">Error</h3>
      <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">{error}</p>
      <button
        onClick={fetchOrders}
        className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold"
      >
        Coba Lagi
      </button>
    </div>
  );

  // Login required state
  if (!userId) {
    return (
      <div className="py-20 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Package size={40} className="text-slate-400" />
        </div>
        <h3 className="text-slate-800 font-black text-lg mb-1">Login Dulu yuk</h3>
        <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">
          Silakan login untuk melihat pesanan sampeyan
        </p>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold"
        >
          Login Sekarang
        </button>
      </div>
    );
  }

  return (
    <div className="w-full pb-24">
      {/* Sticky Header with Back Button */}
      <div className="sticky top-0 z-[100] bg-white -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
        
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-600 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
            <span className="text-xs font-bold text-slate-600">Kembali</span>
          </button>
          
          <div className="flex items-center gap-2">
            <ShoppingBag size={14} className="text-orange-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {locationName || "Pakijangan"}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-800 tracking-tighter">Pesenan</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Kelola pesanan lan riwayat transaksi
          </p>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('masuk')}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              activeTab === 'masuk'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Package size={14} />
            Masuk
            {stats.menunggu > 0 && (
              <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                {stats.menunggu}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('keluar')}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              activeTab === 'keluar'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ShoppingBag size={14} />
            Belanjaan
          </button>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'masuk' ? "Cari pesanan..." : "Cari riwayat belanja..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-slate-50 rounded-2xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          
          {/* Filter Status (hanya untuk tab masuk) */}
          {activeTab === 'masuk' && orders.length > 0 && (
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                Kabeh ({orders.length})
              </button>
              {stats.menunggu > 0 && (
                <button
                  onClick={() => setStatusFilter('menunggu')}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                    statusFilter === 'menunggu' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  Menunggu ({stats.menunggu})
                </button>
              )}
              {stats.diproses > 0 && (
                <button
                  onClick={() => setStatusFilter('diproses')}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                    statusFilter === 'diproses' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  Diproses ({stats.diproses})
                </button>
              )}
              {stats.dikirim > 0 && (
                <button
                  onClick={() => setStatusFilter('dikirim')}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                    statusFilter === 'dikirim' ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-600'
                  }`}
                >
                  Dikirim ({stats.dikirim})
                </button>
              )}
              {stats.selesai > 0 && (
                <button
                  onClick={() => setStatusFilter('selesai')}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                    statusFilter === 'selesai' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  Selesai ({stats.selesai})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 size={32} className="animate-spin text-slate-400 mb-2" />
            <p className="text-[10px] font-bold text-slate-400">Ngunduh pesanan...</p>
          </div>
        ) : error ? (
          <ErrorState />
        ) : filteredOrders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} type={activeTab} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}