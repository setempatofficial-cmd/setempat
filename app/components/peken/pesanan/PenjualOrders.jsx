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

export default function PenjualOrders({ 
  userId, 
  locationName, 
  onBack,
  onReviewOrder 
}) {
  const [activeTab, setActiveTab] = useState('masuk'); // 'masuk' atau 'belanjaan'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedOrderForDriver, setSelectedOrderForDriver] = useState(null);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  
  const [stats, setStats] = useState({
    menunggu: 0,
    diproses: 0,
    dikirim: 0,
    selesai: 0
  });

  const fetchOrders = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    
    try {
      // Jika tab 'masuk' → sebagai PENJUAL, filter penjual_id
      // Jika tab 'belanjaan' → sebagai PEMBELI, filter pembeli_id
      const filterColumn = activeTab === 'masuk' ? 'penjual_id' : 'pembeli_id';
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('pesanan')
        .select('*')
        .eq(filterColumn, userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      
      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Ambil data produk
      const productIds = [...new Set(ordersData.map(o => o.produk_id).filter(Boolean))];
      let productsData = [];
      if (productIds.length > 0) {
        const { data, error: productsError } = await supabase
          .from('produk')
          .select('id, nama_barang, harga, foto_url, deskripsi, satuan')
          .in('id', productIds);
        
        if (productsError) throw productsError;
        productsData = data || [];
      }

      // Ambil data profiles
      const userIds = [...new Set([
        ...ordersData.map(o => o.pembeli_id),
        ...ordersData.map(o => o.penjual_id)
      ].filter(Boolean))];
      
      let profilesData = [];
      if (userIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone')
          .in('id', userIds);
        
        if (profilesError) throw profilesError;
        profilesData = data || [];
      }

      const ordersWithDetails = ordersData.map(order => ({
        ...order,
        produk: productsData.find(p => p.id === order.produk_id) || null,
        pembeli: profilesData.find(p => p.id === order.pembeli_id) || null,
        penjual: profilesData.find(p => p.id === order.penjual_id) || null
      }));

      setOrders(ordersWithDetails);
      
      // Hitung statistik hanya untuk tab 'masuk'
      if (activeTab === 'masuk') {
        const statsObj = {
          menunggu: 0,
          diproses: 0,
          dikirim: 0,
          selesai: 0
        };
        
        ordersWithDetails.forEach(order => {
          if (statsObj[order.status] !== undefined) {
            statsObj[order.status]++;
          }
        });
        
        setStats(statsObj);
      }
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Gagal mengunduh pesanan.');
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    const confirmed = window.confirm(`Yakin ingin mengubah status menjadi ${newStatus}?`);
    if (!confirmed) return;
    
    setUpdatingId(orderId);
    setError(null);
    
    try {
      const updateData = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'selesai') {
        updateData.tanggal_selesai = new Date().toISOString();
      }
      
      const { error: updateError } = await supabase
        .from('pesanan')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) throw updateError;
      
      const oldOrder = orders.find(o => o.id === orderId);
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      if (activeTab === 'masuk' && oldOrder) {
        setStats(prev => {
          const newStats = { ...prev };
          if (newStats[oldOrder.status] > 0) newStats[oldOrder.status]--;
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
      
      if (!productName.includes(query) && 
          !buyerName.includes(query) && 
          !sellerName.includes(query)) {
        return false;
      }
    }
    
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    
    return true;
  });

  const formatRupiah = (harga) => {
    if (!harga && harga !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(harga);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fungsi ambil driver terdekat
  const fetchNearbyDrivers = async (order) => {
    setLoadingDrivers(true);
    try {
      const { data: drivers, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, motor_info, driver_rating, latitude, longitude, driver_status')
        .eq('is_driver', true)
        .eq('driver_status', 'standby')
        .limit(15);
      
      if (error) throw error;
      
      const driversWithDistance = drivers?.map(driver => {
        let distance = 0;
        if (order.latitude && order.longitude && driver.latitude && driver.longitude) {
          distance = calculateDistance(
            order.latitude, order.longitude,
            driver.latitude, driver.longitude
          );
        } else {
          distance = (Math.random() * 5 + 0.5);
        }
        return { ...driver, distance: distance.toFixed(1) };
      }).sort((a, b) => a.distance - b.distance) || [];
      
      setAvailableDrivers(driversWithDistance);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      alert('Gagal mengambil data driver');
    } finally {
      setLoadingDrivers(false);
    }
  };

  // Fungsi hitung jarak
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Fungsi assign driver ke pesanan
  const assignDriverToOrder = async (orderId, driver) => {
    const { error } = await supabase
      .from('pesanan')
      .update({ 
        driver_id: driver.id, 
        shipping_status: 'driver_ditugaskan',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    
    if (error) {
      alert('Gagal menugaskan driver');
      return false;
    }
    
    const message = `*🛵 PESANAN ANTAR BARU* 🛵\n\n` +
      `Halo *${driver.full_name}*, ada pesanan yang butuh diantar!\n\n` +
      `📍 *Ambil di:* ${selectedOrderForDriver?.alamat_penjual || 'Lokasi penjual'}\n` +
      `📍 *Kirim ke:* ${selectedOrderForDriver?.alamat_pengiriman}\n` +
      `💰 *Ongkir:* Rp ${selectedOrderForDriver?.estimated_ongkir?.toLocaleString() || '5.000'}\n` +
      `📦 *Pesanan:* ${selectedOrderForDriver?.produk?.nama_barang || 'Produk'}\n\n` +
      `Silakan konfirmasi setelah mengambil barang.\n\n` +
      `_Dikirim dari aplikasi Setempat.id_`;
    
    window.open(`https://wa.me/${driver.phone}?text=${encodeURIComponent(message)}`, '_blank');
    
    return true;
  };

  // Buka modal pilih driver
  const openDriverModal = (order) => {
    setSelectedOrderForDriver(order);
    fetchNearbyDrivers(order);
    setShowDriverModal(true);
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
    
    const product = order.produk || {
      nama_barang: order.nama_barang || 'Produk',
      foto_url: order.foto_url || [],
      harga: order.jumlah > 0 ? order.total_harga / order.jumlah : order.total_harga,
      deskripsi: order.deskripsi || ''
    };

    const otherParty = isSeller ? order.pembeli : order.penjual;
    const partyName = otherParty?.full_name || 'Warga';
    const partyPhone = otherParty?.phone;
    
    const getActionButtons = () => {
      if (isSeller) {
        switch (order.status) {
          case 'menunggu':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'diproses')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Proses Pesanan'}
              </button>
            );
          case 'diproses':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'dikirim')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-purple-500 text-white rounded-xl text-[10px] font-bold hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Kirim Pesanan'}
              </button>
            );
          case 'dikirim':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'selesai')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Konfirmasi Selesai'}
              </button>
            );
          default:
            return null;
        }
      } else {
        switch (order.status) {
          case 'dikirim':
            return (
              <button
                onClick={() => updateOrderStatus(order.id, 'selesai')}
                disabled={updatingId === order.id}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {updatingId === order.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Pesanan Diterima'}
              </button>
            );
          case 'selesai':
            return (
              <button
                onClick={() => onReviewOrder?.(order)}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-xl text-[10px] font-bold hover:bg-yellow-600 transition-colors"
              >
                📝 Beri Ulasan
              </button>
            );
          default:
            return null;
        }
      }
    };

    // Tombol khusus untuk ojek (penjual)
    const getOjekButtons = () => {
      if (isSeller && order.shipping_method === 'ojek' && order.shipping_status === 'menunggu_driver') {
        return (
          <button
            onClick={() => openDriverModal(order)}
            className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <Truck size={12} /> Cari Driver Ojek
          </button>
        );
      }
      return null;
    };

    // Status ojek untuk pembeli
    const getOjekStatus = () => {
      if (!isSeller && order.shipping_method === 'ojek') {
        const statusConfig = {
          'menunggu_driver': { text: 'Menunggu Driver', color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock },
          'driver_ditugaskan': { text: 'Driver Ditugaskan', color: 'text-blue-600', bg: 'bg-blue-50', icon: Truck },
          'dalam_perjalanan': { text: 'Dalam Perjalanan', color: 'text-purple-600', bg: 'bg-purple-50', icon: Truck },
          'selesai': { text: 'Pesanan Selesai', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle }
        };
        const config = statusConfig[order.shipping_status] || statusConfig['menunggu_driver'];
        const Icon = config.icon;
        return (
          <div className={`mt-2 p-2 rounded-xl ${config.bg}`}>
            <div className="flex items-center gap-2">
              <Icon size={12} className={config.color} />
              <span className={`text-[9px] font-bold ${config.color}`}>{config.text}</span>
            </div>
            {order.driver && (
              <p className="text-[8px] text-slate-500 mt-1">
                Driver: {order.driver.full_name}
              </p>
            )}
          </div>
        );
      }
      return null;
    };

    const handleChat = () => {
      if (partyPhone) {
        let cleanPhone = partyPhone.toString().replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('62') && cleanPhone.length > 0) {
          cleanPhone = '62' + cleanPhone;
        }
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
      } else {
        alert('Nomor WhatsApp tidak tersedia');
      }
    };
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isSeller ? 'bg-emerald-50' : 'bg-blue-50'
              }`}>
                {isSeller ? <Store size={14} className="text-emerald-600" /> : <ShoppingBag size={14} className="text-blue-600" />}
              </div>
              <div>
                <p className="text-[9px] text-slate-400">{isSeller ? 'Dipesan dari' : 'Pesanan ke'}</p>
                <p className="text-[11px] font-bold text-slate-700">{product?.nama_barang || 'Produk tidak tersedia'}</p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <div className="flex items-center gap-1"><User size={10} /><span>{partyName}</span></div>
            <div className="flex items-center gap-1"><Calendar size={10} /><span>{formatDate(order.created_at)}</span></div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
              {product?.foto_url && product.foto_url.length > 0 ? (
                <img src={product.foto_url[0]} alt={product.nama_barang} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-slate-300" /></div>
              )}
            </div>
            
            <div className="flex-1">
              <h4 className="text-xs font-bold text-slate-800 mb-1 line-clamp-2">{product?.nama_barang || 'Produk tidak tersedia'}</h4>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[9px] text-slate-400">{order.jumlah} x {formatRupiah(product?.harga || 0)}</p>
                  <p className="text-sm font-black text-orange-600">{formatRupiah(order.total_harga)}</p>
                </div>
              </div>
              
              {order.catatan && (
                <div className="text-[9px] text-slate-500 bg-slate-50 p-2 rounded-xl mt-2">
                  <span className="font-bold">📝 Catatan:</span> {order.catatan}
                </div>
              )}
              
              <button onClick={() => setExpanded(!expanded)} className="mt-2 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                <Eye size={10} />
                {expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                <ChevronRight size={10} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
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
                  
                  <div className="flex items-center gap-2 pt-2">
                    <MessageCircle size={12} className="text-slate-400" />
                    <button onClick={handleChat} className="text-[10px] font-bold text-orange-500">
                      Hubungi {isSeller ? 'Pembeli' : 'Penjual'} via WhatsApp
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Tombol Aksi */}
        {getActionButtons() && (
          <div className="p-4 pt-0 flex gap-2">
            {getActionButtons()}
            <button onClick={handleChat} className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600">Chat</button>
          </div>
        )}
        
        {/* Tombol Ojek */}
        {getOjekButtons() && (
          <div className="px-4 pb-4 pt-0">{getOjekButtons()}</div>
        )}
        
        {/* Status Ojek */}
        {getOjekStatus()}
      </motion.div>
    );
  };

  // Empty State
  const EmptyState = () => (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        {activeTab === 'masuk' ? <Package size={40} className="text-slate-400" /> : <ShoppingBag size={40} className="text-slate-400" />}
      </div>
      <h3 className="text-slate-800 font-black text-lg mb-1">
        {activeTab === 'masuk' ? 'Belum ada pesanan' : 'Belum ada riwayat belanja'}
      </h3>
      <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">
        {activeTab === 'masuk' 
          ? 'Ketika ada warga yang pesan dagangan Anda, akan muncul di sini.'
          : 'Anda belum memiliki pesanan. Yuk belanja di Panyangan!'}
      </p>
    </div>
  );

  // Error State
  const ErrorState = () => (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={40} className="text-red-400" />
      </div>
      <h3 className="text-slate-800 font-black text-lg mb-1">Terjadi Kesalahan</h3>
      <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">{error}</p>
      <button onClick={fetchOrders} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">
        Coba Lagi
      </button>
    </div>
  );

  if (!userId) {
    return (
      <div className="py-20 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Package size={40} className="text-slate-400" />
        </div>
        <h3 className="text-slate-800 font-black text-lg mb-1">Login Dulu Yuk</h3>
        <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">Silakan login untuk melihat pesanan Anda</p>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">Login Sekarang</button>
      </div>
    );
  }

  return (
    <div className="w-full pb-24">
      {/* Header */}
      <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-sm -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-2 p-2 -ml-2 text-slate-600 active:scale-95 transition-all">
            <ArrowLeft size={20} />
            <span className="text-xs font-bold">Kembali</span>
          </button>
          <div className="flex items-center gap-2">
            <ShoppingBag size={14} className="text-orange-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{locationName || "Pakijangan"}</span>
          </div>
        </div>

        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-800 tracking-tighter">Pesanan</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Kelola pesanan dan riwayat transaksi</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setActiveTab('masuk'); setStatusFilter('all'); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              activeTab === 'masuk' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Package size={14} />
            Masuk
            {stats.menunggu > 0 && activeTab === 'masuk' && (
              <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{stats.menunggu}</span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('keluar'); setStatusFilter('all'); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              activeTab === 'keluar' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <ShoppingBag size={14} />
            Belanjaan
          </button>
        </div>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={activeTab === 'masuk' ? "Cari pesanan..." : "Cari riwayat belanja..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-slate-50 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-200" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2"><X size={14} className="text-slate-400" /></button>}
          </div>
          
          {orders.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>Semua ({orders.length})</button>
              {['menunggu', 'diproses', 'dikirim', 'selesai'].map(status => {
                const count = orders.filter(o => o.status === status).length;
                if (count === 0) return null;
                const colors = { menunggu: 'bg-amber-500', diproses: 'bg-blue-500', dikirim: 'bg-purple-500', selesai: 'bg-emerald-500' };
                const labels = { menunggu: 'Menunggu', diproses: 'Diproses', dikirim: 'Dikirim', selesai: 'Selesai' };
                return (
                  <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${statusFilter === status ? `${colors[status]} text-white` : 'bg-slate-100 text-slate-500'}`}>{labels[status]} ({count})</button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col items-center py-20"><Loader2 size={32} className="animate-spin text-slate-400 mb-2" /><p className="text-[10px] font-bold text-slate-400">Memuat pesanan...</p></div>
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

      {/* Modal Pilih Driver */}
      {showDriverModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
              <div><h3 className="font-black text-lg">🚛 Pilih Driver Ojek</h3><p className="text-[10px] text-slate-500">Driver terdekat dari lokasi toko</p></div>
              <button onClick={() => setShowDriverModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {loadingDrivers ? (
                <div className="text-center py-8"><Loader2 size={32} className="animate-spin mx-auto text-emerald-500" /><p className="text-xs text-slate-500 mt-2">Mencari driver terdekat...</p></div>
              ) : availableDrivers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3"><Truck size={28} className="text-slate-400" /></div>
                  <p className="text-sm font-bold text-slate-700">Belum ada driver standby</p>
                  <button onClick={() => setShowDriverModal(false)} className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold">Tutup</button>
                </div>
              ) : (
                availableDrivers.map((driver) => (
                  <div key={driver.id} className="p-4 border rounded-xl hover:border-emerald-300">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><p className="font-bold text-slate-800">{driver.full_name}</p><div className="flex items-center gap-0.5 text-[9px] font-bold text-yellow-500"><Star size={10} fill="currentColor" /> {driver.driver_rating || 4.5}</div></div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{driver.motor_info}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><MapPin size={8} /> {driver.distance} km</span>
                          <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-600`}>Standby</span>
                        </div>
                      </div>
                      <button onClick={async () => {
                        const success = await assignDriverToOrder(selectedOrderForDriver.id, driver);
                        if (success) { alert(`✅ Driver ${driver.full_name} ditugaskan!`); setShowDriverModal(false); fetchOrders(); }
                      }} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold">Pilih</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t bg-slate-50"><p className="text-[8px] text-slate-400 text-center">Driver akan di-notifikasi via WhatsApp setelah dipilih</p></div>
          </div>
        </div>
      )}
    </div>
  );
}