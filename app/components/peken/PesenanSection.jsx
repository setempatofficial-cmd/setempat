'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, ShoppingBag, User, Store, Clock,
  CheckCircle, XCircle, Truck, MapPin, MessageCircle,
  Eye, Search, ArrowLeft, X, Loader2,
  ChevronDown, ChevronUp, Calendar, AlertCircle, Briefcase, Star,
  Phone, Navigation, Home, Award, Shield, TrendingUp,
  Users, UserCheck, UserX, Filter, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// ============================================
// HOOK CUSTOM UNTUK EXPAND STATE
// ============================================
function useExpandState() {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const isExpanded = useCallback((id) => {
    return expandedId === id;
  }, [expandedId]);

  return { expandedId, toggleExpand, isExpanded };
}

export default function PesananSection({
  userId,
  userRole,
  isDriver,
  isRewang,
  locationName,
  onBack,
  onReviewOrder
}) {
  const [selectedRole, setSelectedRole] = useState('penjual');

  const availableRoles = useMemo(() => {
    return [
      { id: 'penjual', label: 'Penjual', icon: Store, isActive: userRole === 'penjual' },
      { id: 'driver', label: 'Driver', icon: Truck, isActive: isDriver },
      { id: 'rewang', label: 'Rewang', icon: Briefcase, isActive: isRewang },
    ].filter(role => role.isActive);
  }, [userRole, isDriver, isRewang]);

  useEffect(() => {
    if (availableRoles.length > 0) {
      setSelectedRole(availableRoles[0].id);
    }
  }, [availableRoles]);

  if (availableRoles.length === 0) {
    return (
      <PembeliView
        userId={userId}
        locationName={locationName}
        onBack={onBack}
        onReviewOrder={onReviewOrder}
      />
    );
  }

  const viewProps = {
    userId,
    locationName,
    onBack,
    onReviewOrder,
    availableRoles,
    selectedRole,
    setSelectedRole
  };

  if (selectedRole === 'penjual') return <PenjualView {...viewProps} />;
  if (selectedRole === 'driver') return <DriverView {...viewProps} />;
  if (selectedRole === 'rewang') return <RewangView {...viewProps} />;

  return <PembeliView {...viewProps} />;
}

// ============================================
// KOMPONEN PEMBELI VIEW
// ============================================
function PembeliView({ userId, locationName, onBack, onReviewOrder, availableRoles, selectedRole, setSelectedRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);
  const { expandedId, toggleExpand, isExpanded } = useExpandState();
  const containerRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('pesanan')
        .select('*')
        .eq('pembeli_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const productIds = [...new Set(ordersData.map(o => o.produk_id).filter(Boolean))];
      let productsData = [];
      if (productIds.length > 0) {
        const { data } = await supabase
          .from('produk')
          .select('id, nama_barang, harga, foto_url, deskripsi, satuan')
          .in('id', productIds);
        productsData = data || [];
      }

      const userIds = [...new Set([...ordersData.map(o => o.pembeli_id), ...ordersData.map(o => o.penjual_id)].filter(Boolean))];
      let profilesData = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone')
          .in('id', userIds);
        profilesData = data || [];
      }

      const ordersWithDetails = ordersData.map(order => ({
        ...order,
        produk: productsData.find(p => p.id === order.produk_id) || null,
        pembeli: profilesData.find(p => p.id === order.pembeli_id) || null,
        penjual: profilesData.find(p => p.id === order.penjual_id) || null
      }));

      setOrders(ordersWithDetails);
    } catch (err) {
      console.error('Error:', err);
      setError('Gagal mengunduh pesanan.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!confirm(`Yakin ingin mengubah status menjadi ${newStatus}?`)) return;

    try {
      const { error } = await supabase
        .from('pesanan')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  };

  const formatRupiah = (harga) => {
    if (!harga && harga !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (searchQuery) {
        const productName = order.produk?.nama_barang?.toLowerCase() || '';
        const sellerName = order.penjual?.full_name?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        if (!productName.includes(query) && !sellerName.includes(query)) return false;
      }
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  const StatusBadge = React.memo(({ status }) => {
    const config = {
      menunggu: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
      diproses: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
      dikirim: { label: 'Dikirim', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
      selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
      dibatalkan: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle }
    };
    const cfg = config[status] || config.menunggu;
    const Icon = cfg.icon;
    return (
      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${cfg.color}`}>
        <Icon size={10} />
        {cfg.label}
      </div>
    );
  });
  StatusBadge.displayName = 'StatusBadge';

  const OrderCard = React.memo(({ order }) => {
    const expanded = isExpanded(order.id);
    const product = order.produk || {
      nama_barang: order.nama_barang || 'Produk',
      foto_url: order.foto_url || [],
      harga: order.jumlah > 0 ? order.total_harga / order.jumlah : order.total_harga,
    };
    const penjual = order.penjual;
    const partyPhone = penjual?.phone;

    const handleChat = () => {
      if (partyPhone) {
        let cleanPhone = partyPhone.toString().replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
      } else {
        alert('Nomor WhatsApp tidak tersedia');
      }
    };

    const getOjekStatus = () => {
      if (order.shipping_method === 'ojek') {
        const statusConfig = {
          'menunggu_driver': { text: 'Menunggu Driver', color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock },
          'driver_ditugaskan': { text: 'Driver Ditugaskan', color: 'text-blue-600', bg: 'bg-blue-50', icon: UserCheck },
          'dalam_perjalanan': { text: 'Dalam Perjalanan', color: 'text-purple-600', bg: 'bg-purple-50', icon: Navigation },
          'sampai_tujuan': { text: 'Sampai Tujuan', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
        };
        const config = statusConfig[order.shipping_status] || statusConfig['menunggu_driver'];
        const Icon = config.icon;
        return (
          <div className={`mt-2 p-2 rounded-xl ${config.bg} flex items-center gap-2`}>
            <Icon size={14} className={config.color} />
            <span className={`text-[9px] font-bold ${config.color}`}>{config.text}</span>
          </div>
        );
      }
      return null;
    };

    const handleToggle = (e) => {
      e.stopPropagation();
      toggleExpand(order.id);
    };

    return (
      <motion.div
        layout
        initial={false}
        className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div
          className="p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50/50 transition-colors"
          onClick={handleToggle}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={14} className="text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-slate-400">Pesanan ke</p>
                <p className="text-[11px] font-bold text-slate-700 truncate">
                  {product?.nama_barang || 'Produk tidak tersedia'}
                </p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <div className="flex items-center gap-1">
              <User size={10} />
              <span>{penjual?.full_name || 'Penjual'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={10} />
              <span>{formatDate(order.created_at)}</span>
            </div>
          </div>
          <div className="flex justify-center mt-2">
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} className="text-slate-400" />
            </motion.div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    {product?.foto_url?.[0] ? (
                      <img src={product.foto_url[0]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={24} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400">
                      {order.jumlah} x {formatRupiah(product?.harga || 0)}
                    </p>
                    <p className="text-sm font-black text-orange-600">
                      {formatRupiah(order.total_harga)}
                    </p>
                  </div>
                </div>

                {order.alamat_pengiriman && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-slate-600 break-words">{order.alamat_pengiriman}</p>
                    </div>
                  </div>
                )}

                {getOjekStatus()}

                <div className="mt-3 space-y-2">
                  {order.status === 'dikirim' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'selesai')}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
                    >
                      ✅ Pesanan Diterima
                    </button>
                  )}
                  {order.status === 'selesai' && (
                    <button
                      onClick={() => onReviewOrder?.(order)}
                      className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
                    >
                      ⭐ Beri Ulasan
                    </button>
                  )}
                  <button
                    onClick={handleChat}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-bold text-slate-600 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <MessageCircle size={14} />
                    Chat Penjual
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  });
  OrderCard.displayName = 'OrderCard';

  return (
    <div className="w-full pb-24" ref={containerRef}>
      <PesananHeader
        title="Belanjaan Saya"
        subtitle="Riwayat pesanan yang Anda beli"
        locationName={locationName}
        onBack={onBack}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />

      <div className="px-6 mt-4">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari pesanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition"
          />
        </div>
      </div>

      <div className="px-6 mt-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <p className="text-xs text-slate-400 mt-2">Memuat pesanan...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Belum ada pesanan</p>
            <p className="text-slate-400 text-xs mt-1">Yuk, belanja sekarang!</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// KOMPONEN PENJUAL VIEW (Dengan perbaikan serupa)
// ============================================
function PenjualView({ userId, locationName, onBack, onReviewOrder, availableRoles, selectedRole, setSelectedRole }) {
  const [activeTab, setActiveTab] = useState('masuk');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ menunggu: 0, diproses: 0, dikirim: 0, selesai: 0 });
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedOrderForDriver, setSelectedOrderForDriver] = useState(null);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const { expandedId, toggleExpand, isExpanded } = useExpandState();

  const fetchOrders = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const filterColumn = activeTab === 'masuk' ? 'penjual_id' : 'pembeli_id';
      const { data: ordersData, error } = await supabase
        .from('pesanan')
        .select('*')
        .eq(filterColumn, userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!ordersData?.length) {
        setOrders([]);
        return;
      }

      const productIds = [...new Set(ordersData.map(o => o.produk_id).filter(Boolean))];
      const { data: productsData } = await supabase
        .from('produk')
        .select('id, nama_barang, harga, foto_url, satuan')
        .in('id', productIds);

      const userIds = [...new Set([...ordersData.map(o => o.pembeli_id), ...ordersData.map(o => o.penjual_id)].filter(Boolean))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', userIds);

      const ordersWithDetails = ordersData.map(order => ({
        ...order,
        produk: productsData?.find(p => p.id === order.produk_id) || null,
        pembeli: profilesData?.find(p => p.id === order.pembeli_id) || null,
        penjual: profilesData?.find(p => p.id === order.penjual_id) || null
      }));

      setOrders(ordersWithDetails);

      if (activeTab === 'masuk') {
        const newStats = { menunggu: 0, diproses: 0, dikirim: 0, selesai: 0 };
        ordersWithDetails.forEach(o => { if (newStats[o.status] !== undefined) newStats[o.status]++; });
        setStats(newStats);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Gagal memuat pesanan');
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!confirm(`Yakin mengubah status jadi ${newStatus}?`)) return;
    try {
      await supabase
        .from('pesanan')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      fetchOrders();
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  };

  const fetchNearbyDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const { data: drivers } = await supabase
        .from('profiles')
        .select('id, full_name, phone, motor_info, driver_rating, driver_status')
        .eq('is_driver', true)
        .eq('driver_status', 'standby')
        .limit(15);

      const driversWithDistance = drivers?.map(d => ({
        ...d,
        distance: (Math.random() * 5 + 0.5).toFixed(1)
      })) || [];
      setAvailableDrivers(driversWithDistance);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const assignDriver = async (orderId, driver) => {
    const { error } = await supabase
      .from('pesanan')
      .update({ driver_id: driver.id, shipping_status: 'driver_ditugaskan' })
      .eq('id', orderId);

    if (error) {
      alert('Gagal');
      return false;
    }

    const message = `*🛵 PESANAN ANTAR BARU*\n\nHalo ${driver.full_name}, ada pesanan butuh diantar!\n📍 Ambil di lokasi penjual\n📍 Kirim ke: ${selectedOrderForDriver?.alamat_pengiriman}\n💰 Ongkir: Rp ${selectedOrderForDriver?.estimated_ongkir?.toLocaleString() || '5.000'}`;
    window.open(`https://wa.me/${driver.phone}?text=${encodeURIComponent(message)}`, '_blank');
    return true;
  };

  const formatRupiah = (harga) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (searchQuery) {
        const productName = order.produk?.nama_barang?.toLowerCase() || '';
        const buyerName = order.pembeli?.full_name?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        if (!productName.includes(query) && !buyerName.includes(query)) return false;
      }
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  const StatusBadge = React.memo(({ status }) => {
    const config = {
      menunggu: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
      diproses: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
      dikirim: { label: 'Dikirim', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
      selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    };
    const cfg = config[status] || config.menunggu;
    const Icon = cfg.icon;
    return (
      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${cfg.color}`}>
        <Icon size={10} /> {cfg.label}
      </div>
    );
  });
  StatusBadge.displayName = 'StatusBadge';

  const OrderCard = React.memo(({ order, type }) => {
    const expanded = isExpanded(order.id);
    const isSeller = type === 'masuk';
    const product = order.produk || { nama_barang: 'Produk', foto_url: [], harga: order.total_harga / order.jumlah };
    const otherParty = isSeller ? order.pembeli : order.penjual;
    const partyName = otherParty?.full_name || 'Warga';
    const partyPhone = otherParty?.phone;

    const handleChat = () => {
      if (partyPhone) {
        let cleanPhone = partyPhone.toString().replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
      }
    };

    const getActionButtons = () => {
      if (isSeller) {
        if (order.status === 'menunggu') {
          return (
            <button
              onClick={() => updateOrderStatus(order.id, 'diproses')}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
            >
              📦 Proses Pesanan
            </button>
          );
        }
        if (order.status === 'diproses') {
          return (
            <button
              onClick={() => updateOrderStatus(order.id, 'dikirim')}
              className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
            >
              🚚 Kirim Pesanan
            </button>
          );
        }
        if (order.status === 'dikirim') {
          return (
            <button
              onClick={() => updateOrderStatus(order.id, 'selesai')}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
            >
              ✅ Konfirmasi Selesai
            </button>
          );
        }
      } else {
        if (order.status === 'dikirim') {
          return (
            <button
              onClick={() => updateOrderStatus(order.id, 'selesai')}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
            >
              ✅ Pesanan Diterima
            </button>
          );
        }
        if (order.status === 'selesai') {
          return (
            <button
              onClick={() => onReviewOrder?.(order)}
              className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
            >
              ⭐ Beri Ulasan
            </button>
          );
        }
      }
      return null;
    };

    const getOjekButtons = () => {
      if (isSeller && order.shipping_method === 'ojek' && order.shipping_status === 'menunggu_driver') {
        return (
          <button
            onClick={() => {
              setSelectedOrderForDriver(order);
              fetchNearbyDrivers();
              setShowDriverModal(true);
            }}
            className="w-full mt-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Truck size={14} /> Cari Driver Ojek
          </button>
        );
      }
      return null;
    };

    const getOjekStatus = () => {
      if (!isSeller && order.shipping_method === 'ojek') {
        const statusConfig = {
          'menunggu_driver': { text: '🔄 Menunggu Driver', color: 'text-orange-600', bg: 'bg-orange-50' },
          'driver_ditugaskan': { text: '👤 Driver Ditugaskan', color: 'text-blue-600', bg: 'bg-blue-50' },
          'dalam_perjalanan': { text: '🛵 Dalam Perjalanan', color: 'text-purple-600', bg: 'bg-purple-50' },
          'sampai_tujuan': { text: '✅ Sampai Tujuan', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        };
        const config = statusConfig[order.shipping_status] || statusConfig['menunggu_driver'];
        return (
          <div className={`mt-2 p-2 rounded-xl ${config.bg}`}>
            <span className={`text-[9px] font-bold ${config.color}`}>{config.text}</span>
          </div>
        );
      }
      return null;
    };

    const handleToggle = (e) => {
      e.stopPropagation();
      toggleExpand(order.id);
    };

    return (
      <motion.div
        className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div
          className="p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50/50 transition-colors"
          onClick={handleToggle}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                {isSeller ? <Store size={14} className="text-emerald-600" /> : <ShoppingBag size={14} className="text-blue-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-slate-400">{isSeller ? 'Dipesan dari' : 'Pesanan ke'}</p>
                <p className="text-[11px] font-bold text-slate-700 truncate">{product.nama_barang}</p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <span className="flex items-center gap-1">
              <User size={10} />
              {partyName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {formatDate(order.created_at)}
            </span>
          </div>
          <div className="flex justify-center mt-2">
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} className="text-slate-400" />
            </motion.div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    {product.foto_url?.[0] ? (
                      <img src={product.foto_url[0]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={24} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400">
                      {order.jumlah} x {formatRupiah(product.harga)}
                    </p>
                    <p className="text-sm font-black text-orange-600">
                      {formatRupiah(order.total_harga)}
                    </p>
                  </div>
                </div>

                {order.alamat_pengiriman && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-slate-600 break-words">{order.alamat_pengiriman}</p>
                    </div>
                  </div>
                )}

                {getOjekStatus()}

                <div className="mt-3 space-y-2">
                  {getActionButtons()}
                  {getOjekButtons()}
                  <button
                    onClick={handleChat}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-bold text-slate-600 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <MessageCircle size={14} />
                    Chat {isSeller ? 'Pembeli' : 'Penjual'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  });
  OrderCard.displayName = 'OrderCard';

  return (
    <div className="w-full pb-24">
      <PesananHeader
        title="Pesanan"
        subtitle="Kelola pesanan masuk & riwayat belanja"
        locationName={locationName}
        onBack={onBack}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />

      <div className="px-6">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setActiveTab('masuk'); setStatusFilter('all'); }}
            className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${activeTab === 'masuk'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
          >
            <Package size={14} />
            Masuk
            {stats.menunggu > 0 && (
              <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">
                {stats.menunggu}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('keluar'); setStatusFilter('all'); }}
            className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${activeTab === 'keluar'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
          >
            <ShoppingBag size={14} /> Belanjaan
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari pesanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition"
          />
        </div>

        {orders.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap transition ${statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Semua ({orders.length})
            </button>
            {['menunggu', 'diproses', 'dikirim', 'selesai'].map(s => {
              const count = orders.filter(o => o.status === s).length;
              if (count === 0) return null;
              const colors = {
                menunggu: 'bg-amber-500',
                diproses: 'bg-blue-500',
                dikirim: 'bg-purple-500',
                selesai: 'bg-emerald-500'
              };
              const labels = {
                menunggu: 'Menunggu',
                diproses: 'Diproses',
                dikirim: 'Dikirim',
                selesai: 'Selesai'
              };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold whitespace-nowrap transition ${statusFilter === s
                      ? `${colors[s]} text-white`
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {labels[s]} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 mt-2 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <p className="text-xs text-slate-400 mt-2">Memuat pesanan...</p>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-20">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Belum ada pesanan</p>
            <p className="text-slate-400 text-xs mt-1">
              {activeTab === 'masuk' ? 'Belum ada pembeli yang memesan' : 'Belum ada riwayat belanja'}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} type={activeTab} />
          ))
        )}
      </div>

      {/* Driver Modal */}
      <AnimatePresence>
        {showDriverModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDriverModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-800">Pilih Driver Ojek</h3>
                  <p className="text-[10px] text-slate-400">Driver standby terdekat</p>
                </div>
                <button
                  onClick={() => setShowDriverModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {loadingDrivers ? (
                  <div className="flex flex-col items-center py-12">
                    <Loader2 size={32} className="animate-spin text-orange-500" />
                    <p className="text-xs text-slate-400 mt-2">Mencari driver...</p>
                  </div>
                ) : availableDrivers.length === 0 ? (
                  <div className="text-center py-12">
                    <Truck size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Belum ada driver standby</p>
                    <p className="text-slate-400 text-xs mt-1">Coba lagi nanti</p>
                  </div>
                ) : (
                  availableDrivers.map((driver, index) => (
                    <motion.div
                      key={driver.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 border rounded-xl hover:border-emerald-500 transition cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{driver.full_name}</p>
                            <div className="flex items-center gap-1">
                              <Star size={12} className="text-yellow-500 fill-yellow-500" />
                              <span className="text-[9px] font-bold">{driver.driver_rating || '4.5'}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500">{driver.motor_info || 'Motor'}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] text-emerald-600 flex items-center gap-1">
                              <Navigation size={10} />
                              {driver.distance} km
                            </span>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                              Standby
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (await assignDriver(selectedOrderForDriver.id, driver)) {
                              alert(`✅ Driver ${driver.full_name} ditugaskan!`);
                              setShowDriverModal(false);
                              fetchOrders();
                            }
                          }}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
                        >
                          Pilih
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// KOMPONEN DRIVER VIEW (Dengan perbaikan serupa)
// ============================================
function DriverView({ userId, locationName, onBack, availableRoles, selectedRole, setSelectedRole }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { expandedId, toggleExpand, isExpanded } = useExpandState();

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    const { data } = await supabase
      .from('pesanan')
      .select('*, produk:produk_id(nama_barang, foto_url), pembeli:pembeli_id(full_name, phone, avatar_url)')
      .eq('driver_id', userId)
      .in('shipping_status', ['menunggu_driver', 'driver_ditugaskan', 'dalam_perjalanan']);
    setDeliveries(data || []);
    setLoading(false);
  };

  const updateStatus = async (orderId, status) => {
    await supabase
      .from('pesanan')
      .update({ shipping_status: status })
      .eq('id', orderId);
    fetchDeliveries();
  };

  const getStatusConfig = (status) => {
    const config = {
      'menunggu_driver': { label: 'Menunggu Driver', color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock },
      'driver_ditugaskan': { label: 'Driver Ditugaskan', color: 'text-blue-600', bg: 'bg-blue-50', icon: UserCheck },
      'dalam_perjalanan': { label: 'Dalam Perjalanan', color: 'text-purple-600', bg: 'bg-purple-50', icon: Navigation },
    };
    return config[status] || config['menunggu_driver'];
  };

  const formatRupiah = (harga) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);
  };

  const DeliveryCard = React.memo(({ order }) => {
    const expanded = isExpanded(order.id);
    const statusConfig = getStatusConfig(order.shipping_status);
    const StatusIcon = statusConfig.icon;

    const handleToggle = (e) => {
      e.stopPropagation();
      toggleExpand(order.id);
    };

    return (
      <motion.div
        className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div
          className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
          onClick={handleToggle}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                {order.produk?.foto_url?.[0] ? (
                  <img src={order.produk.foto_url[0]} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={20} className="text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{order.produk?.nama_barang || 'Produk'}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <User size={10} />
                  {order.pembeli?.full_name || 'Pembeli'}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                <StatusIcon size={10} />
                {statusConfig.label}
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-2">
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} className="text-slate-400" />
            </motion.div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-3">
                <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl">
                  <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400">Alamat Pengiriman</p>
                    <p className="text-xs text-slate-700 break-words">{order.alamat_pengiriman}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold text-orange-600">{formatRupiah(order.total_harga + (order.ongkir || 0))}</span>
                </div>

                <div className="flex gap-2">
                  {order.shipping_status === 'menunggu_driver' && (
                    <button
                      onClick={() => updateStatus(order.id, 'dalam_perjalanan')}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
                    >
                      🛵 Ambil Barang
                    </button>
                  )}
                  {order.shipping_status === 'dalam_perjalanan' && (
                    <button
                      onClick={() => updateStatus(order.id, 'selesai')}
                      className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-[10px] font-bold transition active:scale-95"
                    >
                      ✅ Selesai Antar
                    </button>
                  )}
                  <button
                    onClick={() => window.open(`https://wa.me/${order.pembeli?.phone}`)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-bold text-slate-600 transition active:scale-95 flex items-center gap-1"
                  >
                    <MessageCircle size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  });
  DeliveryCard.displayName = 'DeliveryCard';

  return (
    <div className="w-full pb-24">
      <PesananHeader
        title="Antaran Saya"
        subtitle="Pesanan yang harus diantar"
        locationName={locationName}
        onBack={onBack}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />

      <div className="px-6 mt-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <p className="text-xs text-slate-400 mt-2">Memuat antaran...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-20">
            <Truck size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Belum ada pesanan antar</p>
            <p className="text-slate-400 text-xs mt-1">Stay tuned, nanti ada pesanan masuk</p>
          </div>
        ) : (
          deliveries.map(order => (
            <DeliveryCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// KOMPONEN REWANG VIEW
// ============================================
function RewangView({ userId, locationName, onBack, availableRoles, selectedRole, setSelectedRole }) {
  return (
    <div className="w-full pb-24">
      <PesananHeader
        title="Pesanan Jasa"
        subtitle="Pesanan jasa yang masuk"
        locationName={locationName}
        onBack={onBack}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />

      <div className="px-6">
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase size={32} className="text-orange-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Fitur Rewang</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Fitur untuk mengelola pesanan jasa sedang dalam pengembangan.
            <br />
            <span className="text-xs">Nantikan update selanjutnya! 🚀</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// KOMPONEN HEADER
// ============================================
function PesananHeader({ title, subtitle, locationName, onBack, availableRoles, selectedRole, setSelectedRole }) {
  return (
    <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-sm -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 p-2 -ml-2 text-slate-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
          <span className="text-xs font-bold">Kembali</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {locationName || "Pakijangan"}
          </span>
        </div>
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-black text-slate-800 tracking-tighter">{title}</h2>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {availableRoles && availableRoles.length > 1 && (
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-2">
          {availableRoles.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${selectedRole === role.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-200'
                }`}
            >
              <role.icon size={14} />
              {role.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}