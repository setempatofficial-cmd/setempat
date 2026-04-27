'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, ShoppingBag, User, Store, Clock, 
  CheckCircle, XCircle, Truck, MapPin, MessageCircle,
  Eye, Search, ArrowLeft, X, Loader2,
  ChevronRight, Calendar, AlertCircle, Briefcase, Star
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function PesenanSection({ 
  userId, 
  userRole,      // 'penjual', 'warga'
  isDriver,      // true/false
  isRewang,      // true/false
  locationName, 
  onBack,
  onReviewOrder 
}) {
  // Role yang tersedia untuk user ini
  const [selectedRole, setSelectedRole] = useState('penjual');
  
  // Tentukan role yang aktif
  const availableRoles = [
    { id: 'penjual', label: 'Penjual', icon: Store, isActive: userRole === 'penjual' },
    { id: 'driver', label: 'Driver', icon: Truck, isActive: isDriver },
    { id: 'rewang', label: 'Rewang', icon: Briefcase, isActive: isRewang },
  ].filter(role => role.isActive);

  // Set default role
  useEffect(() => {
    if (availableRoles.length > 0) {
      setSelectedRole(availableRoles[0].id);
    }
  }, [userRole, isDriver, isRewang]);

  // Jika tidak ada role aktif, tampilkan sebagai pembeli
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

  // Render berdasarkan role yang dipilih
  if (selectedRole === 'penjual') {
    return (
      <PenjualView 
        userId={userId}
        locationName={locationName}
        onBack={onBack}
        onReviewOrder={onReviewOrder}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />
    );
  }

  if (selectedRole === 'driver') {
    return (
      <DriverView 
        userId={userId}
        locationName={locationName}
        onBack={onBack}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />
    );
  }

  if (selectedRole === 'rewang') {
    return (
      <RewangView 
        userId={userId}
        locationName={locationName}
        onBack={onBack}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
      />
    );
  }

  return (
    <PembeliView 
      userId={userId} 
      locationName={locationName} 
      onBack={onBack} 
      onReviewOrder={onReviewOrder}
      availableRoles={availableRoles}
      selectedRole={selectedRole}
      setSelectedRole={setSelectedRole}
    />
  );
}

// ============================================
// KOMPONEN PEMBELI VIEW (Hanya Belanjaan)
// ============================================
function PembeliView({ userId, locationName, onBack, onReviewOrder, availableRoles, selectedRole, setSelectedRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);

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
    const confirmed = window.confirm(`Yakin ingin mengubah status menjadi ${newStatus}?`);
    if (!confirmed) return;
    
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('pesanan')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (searchQuery) {
      const productName = order.produk?.nama_barang?.toLowerCase() || '';
      const sellerName = order.penjual?.full_name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      if (!productName.includes(query) && !sellerName.includes(query)) return false;
    }
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    return true;
  });

  const formatRupiah = (harga) => {
    if (!harga && harga !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

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

  const OrderCard = ({ order }) => {
    const [expanded, setExpanded] = useState(false);
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
          'driver_ditugaskan': { text: 'Driver Ditugaskan', color: 'text-blue-600', bg: 'bg-blue-50', icon: Truck },
          'dalam_perjalanan': { text: 'Dalam Perjalanan', color: 'text-purple-600', bg: 'bg-purple-50', icon: Truck },
        };
        const config = statusConfig[order.shipping_status] || statusConfig['menunggu_driver'];
        const Icon = config.icon;
        return (
          <div className={`mt-2 p-2 rounded-xl ${config.bg}`}>
            <div className="flex items-center gap-2">
              <Icon size={12} className={config.color} />
              <span className={`text-[9px] font-bold ${config.color}`}>{config.text}</span>
            </div>
          </div>
        );
      }
      return null;
    };

    return (
      <motion.div layout className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <ShoppingBag size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] text-slate-400">Pesanan ke</p>
                <p className="text-[11px] font-bold text-slate-700">{product?.nama_barang || 'Produk tidak tersedia'}</p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <div className="flex items-center gap-1"><User size={10} /><span>{penjual?.full_name || 'Penjual'}</span></div>
            <div className="flex items-center gap-1"><Calendar size={10} /><span>{formatDate(order.created_at)}</span></div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden">
              {product?.foto_url?.[0] ? (
                <img src={product.foto_url[0]} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-slate-300" /></div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[9px] text-slate-400">{order.jumlah} x {formatRupiah(product?.harga || 0)}</p>
                  <p className="text-sm font-black text-orange-600">{formatRupiah(order.total_harga)}</p>
                </div>
              </div>
              <button onClick={() => setExpanded(!expanded)} className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                <Eye size={10} /> {expanded ? 'Sembunyikan' : 'Lihat detail'}
              </button>
            </div>
          </div>
          
          {expanded && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {order.alamat_pengiriman && (
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-slate-400 mt-0.5" />
                  <p className="text-[10px] text-slate-600">{order.alamat_pengiriman}</p>
                </div>
              )}
              <button onClick={handleChat} className="text-[10px] font-bold text-orange-500">Hubungi Penjual</button>
            </div>
          )}
          
          {getOjekStatus()}
        </div>
        
        <div className="p-4 pt-0">
          {order.status === 'dikirim' && (
            <button onClick={() => updateOrderStatus(order.id, 'selesai')} className="w-full py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold">
              Pesanan Diterima
            </button>
          )}
          {order.status === 'selesai' && (
            <button onClick={() => onReviewOrder?.(order)} className="w-full py-2 bg-yellow-500 text-white rounded-xl text-[10px] font-bold">
              📝 Beri Ulasan
            </button>
          )}
          <button onClick={handleChat} className="w-full mt-2 py-2 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600">Chat Penjual</button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full pb-24">
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
          <input type="text" placeholder="Cari pesanan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-xs" />
        </div>
      </div>

      <div className="px-6 mt-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-20"><Loader2 size={32} className="animate-spin text-slate-400" /></div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20"><ShoppingBag size={40} className="mx-auto text-slate-300" /><p className="mt-2 text-slate-400">Belum ada pesanan</p></div>
        ) : (
          filteredOrders.map(order => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}

// ============================================
// KOMPONEN PENJUAL VIEW
// ============================================
function PenjualView({ userId, locationName, onBack, onReviewOrder, availableRoles, selectedRole, setSelectedRole }) {
  const [activeTab, setActiveTab] = useState('masuk');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ menunggu: 0, diproses: 0, dikirim: 0, selesai: 0 });
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedOrderForDriver, setSelectedOrderForDriver] = useState(null);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

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
      const { data: productsData } = await supabase.from('produk').select('id, nama_barang, harga, foto_url, satuan').in('id', productIds);
      
      const userIds = [...new Set([...ordersData.map(o => o.pembeli_id), ...ordersData.map(o => o.penjual_id)].filter(Boolean))];
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);

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
    setUpdatingId(orderId);
    try {
      await supabase.from('pesanan').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
      fetchOrders();
    } catch (err) { alert('Gagal: ' + err.message); }
    finally { setUpdatingId(null); }
  };

  const filteredOrders = orders.filter(order => {
    if (searchQuery) {
      const productName = order.produk?.nama_barang?.toLowerCase() || '';
      const buyerName = order.pembeli?.full_name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      if (!productName.includes(query) && !buyerName.includes(query)) return false;
    }
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    return true;
  });

  const formatRupiah = (harga) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('id-ID') : '-';

  const StatusBadge = ({ status }) => {
    const config = {
      menunggu: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700', icon: Clock },
      diproses: { label: 'Diproses', color: 'bg-blue-100 text-blue-700', icon: Package },
      dikirim: { label: 'Dikirim', color: 'bg-purple-100 text-purple-700', icon: Truck },
      selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    };
    const cfg = config[status] || config.menunggu;
    const Icon = cfg.icon;
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold ${cfg.color}`}>
        <Icon size={10} /> {cfg.label}
      </div>
    );
  };

  const OrderCard = ({ order, type }) => {
    const [expanded, setExpanded] = useState(false);
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
        if (order.status === 'menunggu') return <button onClick={() => updateOrderStatus(order.id, 'diproses')} className="w-full py-2 bg-orange-500 text-white rounded-xl text-[10px] font-bold">Proses Pesanan</button>;
        if (order.status === 'diproses') return <button onClick={() => updateOrderStatus(order.id, 'dikirim')} className="w-full py-2 bg-purple-500 text-white rounded-xl text-[10px] font-bold">Kirim Pesanan</button>;
        if (order.status === 'dikirim') return <button onClick={() => updateOrderStatus(order.id, 'selesai')} className="w-full py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold">Konfirmasi Selesai</button>;
      } else {
        if (order.status === 'dikirim') return <button onClick={() => updateOrderStatus(order.id, 'selesai')} className="w-full py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold">Pesanan Diterima</button>;
        if (order.status === 'selesai') return <button onClick={() => onReviewOrder?.(order)} className="w-full py-2 bg-yellow-500 text-white rounded-xl text-[10px] font-bold">📝 Beri Ulasan</button>;
      }
      return null;
    };

    const getOjekButtons = () => {
      if (isSeller && order.shipping_method === 'ojek' && order.shipping_status === 'menunggu_driver') {
        return (
          <button onClick={() => { setSelectedOrderForDriver(order); setShowDriverModal(true); }} className="w-full mt-2 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2">
            <Truck size={12} /> Cari Driver Ojek
          </button>
        );
      }
      return null;
    };

    const getOjekStatus = () => {
      if (!isSeller && order.shipping_method === 'ojek') {
        const statusConfig = {
          'menunggu_driver': { text: 'Menunggu Driver', color: 'text-orange-600', bg: 'bg-orange-50' },
          'driver_ditugaskan': { text: 'Driver Ditugaskan', color: 'text-blue-600', bg: 'bg-blue-50' },
          'dalam_perjalanan': { text: 'Dalam Perjalanan', color: 'text-purple-600', bg: 'bg-purple-50' },
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

    return (
      <motion.div className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                {isSeller ? <Store size={14} className="text-emerald-600" /> : <ShoppingBag size={14} className="text-blue-600" />}
              </div>
              <div>
                <p className="text-[9px] text-slate-400">{isSeller ? 'Dipesan dari' : 'Pesanan ke'}</p>
                <p className="text-[11px] font-bold text-slate-700">{product.nama_barang}</p>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <span><User size={10} className="inline mr-1" />{partyName}</span>
            <span><Calendar size={10} className="inline mr-1" />{formatDate(order.created_at)}</span>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden">
              {product.foto_url?.[0] ? <img src={product.foto_url[0]} className="w-full h-full object-cover" /> : <Package size={24} className="m-4 text-slate-300" />}
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-slate-400">{order.jumlah} x {formatRupiah(product.harga)}</p>
              <p className="text-sm font-black text-orange-600">{formatRupiah(order.total_harga)}</p>
              <button onClick={() => setExpanded(!expanded)} className="mt-2 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                <Eye size={10} /> {expanded ? 'Sembunyikan' : 'Lihat detail'}
              </button>
            </div>
          </div>
          
          {expanded && order.alamat_pengiriman && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-start gap-2"><MapPin size={12} className="text-slate-400 mt-0.5" /><p className="text-[10px] text-slate-600">{order.alamat_pengiriman}</p></div>
              <button onClick={handleChat} className="mt-2 text-[10px] font-bold text-orange-500">Hubungi {isSeller ? 'Pembeli' : 'Penjual'} via WA</button>
            </div>
          )}
          
          {getOjekStatus()}
        </div>
        
        <div className="p-4 pt-0">
          {getActionButtons()}
          {getOjekButtons()}
          <button onClick={handleChat} className="w-full mt-2 py-2 bg-slate-100 rounded-xl text-[10px] font-bold">Chat</button>
        </div>
      </motion.div>
    );
  };

  const fetchNearbyDrivers = async (order) => {
    setLoadingDrivers(true);
    try {
      const { data: drivers } = await supabase
        .from('profiles')
        .select('id, full_name, phone, motor_info, driver_rating, driver_status')
        .eq('is_driver', true)
        .eq('driver_status', 'standby')
        .limit(15);
      
      const driversWithDistance = drivers?.map(d => ({ ...d, distance: (Math.random() * 5 + 0.5).toFixed(1) })) || [];
      setAvailableDrivers(driversWithDistance);
    } catch (err) { console.error(err); }
    finally { setLoadingDrivers(false); }
  };

  const assignDriver = async (orderId, driver) => {
    const { error } = await supabase
      .from('pesanan')
      .update({ driver_id: driver.id, shipping_status: 'driver_ditugaskan' })
      .eq('id', orderId);
    
    if (error) { alert('Gagal'); return false; }
    
    const message = `*🛵 PESANAN ANTAR BARU*\n\nHalo ${driver.full_name}, ada pesanan butuh diantar!\n📍 Ambil di lokasi penjual\n📍 Kirim ke: ${selectedOrderForDriver?.alamat_pengiriman}\n💰 Ongkir: Rp ${selectedOrderForDriver?.estimated_ongkir?.toLocaleString() || '5.000'}`;
    window.open(`https://wa.me/${driver.phone}?text=${encodeURIComponent(message)}`, '_blank');
    return true;
  };

  return (
    <div className="w-full pb-24">
      <PesananHeader title="Pesanan" subtitle="Kelola pesanan masuk & riwayat belanja" locationName={locationName} onBack={onBack} availableRoles={availableRoles} selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
      
      <div className="px-6">
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setActiveTab('masuk'); setStatusFilter('all'); }} className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${activeTab === 'masuk' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Package size={14} /> Masuk {stats.menunggu > 0 && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{stats.menunggu}</span>}
          </button>
          <button onClick={() => { setActiveTab('keluar'); setStatusFilter('all'); }} className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${activeTab === 'keluar' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <ShoppingBag size={14} /> Belanjaan
          </button>
        </div>
        
        <div className="relative mb-3">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari pesanan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-xs" />
        </div>
        
        {orders.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-3">
            <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-full text-[9px] font-bold ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Semua ({orders.length})</button>
            {['menunggu', 'diproses', 'dikirim', 'selesai'].map(s => {
              const count = orders.filter(o => o.status === s).length;
              if (count === 0) return null;
              const colors = { menunggu: 'bg-amber-500', diproses: 'bg-blue-500', dikirim: 'bg-purple-500', selesai: 'bg-emerald-500' };
              const labels = { menunggu: 'Menunggu', diproses: 'Diproses', dikirim: 'Dikirim', selesai: 'Selesai' };
              return <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-[9px] font-bold ${statusFilter === s ? `${colors[s]} text-white` : 'bg-slate-100'}`}>{labels[s]} ({count})</button>;
            })}
          </div>
        )}
      </div>

      <div className="px-6 mt-2 space-y-4">
        {loading ? <Loader2 size={32} className="animate-spin mx-auto my-20 text-slate-400" />
        : error ? <div className="text-center text-red-500 py-20">{error}</div>
        : filteredOrders.length === 0 ? <div className="text-center py-20"><Package size={40} className="mx-auto text-slate-300" /><p className="mt-2 text-slate-400">Belum ada pesanan</p></div>
        : filteredOrders.map(order => <OrderCard key={order.id} order={order} type={activeTab} />)}
      </div>

      {showDriverModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] overflow-hidden">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between">
              <h3 className="font-black">Pilih Driver Ojek</h3>
              <button onClick={() => setShowDriverModal(false)}><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {loadingDrivers ? <Loader2 className="animate-spin mx-auto my-8" />
              : availableDrivers.length === 0 ? <div className="text-center py-8"><Truck className="mx-auto text-slate-300" /><p>Belum ada driver standby</p></div>
              : availableDrivers.map(driver => (
                <div key={driver.id} className="p-3 border rounded-xl flex justify-between items-center">
                  <div><p className="font-bold">{driver.full_name}</p><p className="text-[10px] text-slate-500">{driver.motor_info}</p><span className="text-[9px] text-emerald-600">{driver.distance} km</span></div>
                  <button onClick={async () => { if (await assignDriver(selectedOrderForDriver.id, driver)) { alert(`✅ Driver ${driver.full_name} ditugaskan!`); setShowDriverModal(false); fetchOrders(); } }} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold">Pilih</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// KOMPONEN DRIVER VIEW (Sederhana untuk sekarang)
// ============================================
function DriverView({ userId, locationName, onBack, availableRoles, selectedRole, setSelectedRole }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    const { data } = await supabase
      .from('pesanan')
      .select('*, produk:produk_id(nama_barang), pembeli:pembeli_id(full_name, phone)')
      .eq('driver_id', userId)
      .in('shipping_status', ['menunggu_driver', 'driver_ditugaskan', 'dalam_perjalanan']);
    setDeliveries(data || []);
    setLoading(false);
  };

  const updateStatus = async (orderId, status) => {
    await supabase.from('pesanan').update({ shipping_status: status }).eq('id', orderId);
    fetchDeliveries();
  };

  return (
    <div className="w-full pb-24">
      <PesananHeader title="Antaran" subtitle="Pesanan yang harus diantar" locationName={locationName} onBack={onBack} availableRoles={availableRoles} selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
      <div className="px-6 space-y-4">
        {loading ? <Loader2 className="animate-spin mx-auto my-20" />
        : deliveries.length === 0 ? <div className="text-center py-20"><Truck className="mx-auto text-slate-300" /><p className="mt-2">Belum ada pesanan antar</p></div>
        : deliveries.map(order => (
          <div key={order.id} className="bg-white rounded-2xl border p-4">
            <p className="font-bold">{order.produk?.nama_barang}</p>
            <p className="text-sm text-slate-600">Kirim ke: {order.alamat_pengiriman}</p>
            <div className="flex gap-2 mt-3">
              {order.shipping_status === 'menunggu_driver' && <button onClick={() => updateStatus(order.id, 'dalam_perjalanan')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs">Ambil Barang</button>}
              {order.shipping_status === 'dalam_perjalanan' && <button onClick={() => updateStatus(order.id, 'selesai')} className="px-4 py-2 bg-purple-500 text-white rounded-xl text-xs">Selesai Antar</button>}
              <button onClick={() => window.open(`https://wa.me/${order.pembeli?.phone}`)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs">Hubungi Pembeli</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// KOMPONEN REWANG VIEW (Placeholder untuk sekarang)
// ============================================
function RewangView({ locationName, onBack, availableRoles, selectedRole, setSelectedRole }) {
  return (
    <div className="w-full pb-24">
      <PesananHeader title="Pesanan Jasa" subtitle="Pesanan jasa yang masuk" locationName={locationName} onBack={onBack} availableRoles={availableRoles} selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
      <div className="px-6">
        <div className="text-center py-20">
          <Briefcase size={40} className="mx-auto text-slate-300" />
          <p className="mt-2 text-slate-400">Fitur Rewang sedang dalam pengembangan</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// KOMPONEN HEADER BERSAMA
// ============================================
function PesananHeader({ title, subtitle, locationName, onBack, availableRoles, selectedRole, setSelectedRole }) {
  return (
    <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-sm -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 p-2 -ml-2 text-slate-600 active:scale-95">
          <ArrowLeft size={20} />
          <span className="text-xs font-bold">Kembali</span>
        </button>
        <div className="flex items-center gap-2">
          <ShoppingBag size={14} className="text-orange-500" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{locationName || "Pakijangan"}</span>
        </div>
      </div>
      <div className="mb-2">
        <h2 className="text-xl font-black text-slate-800 tracking-tighter">{title}</h2>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      
      {/* Role Selector */}
      {availableRoles && availableRoles.length > 1 && (
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-2">
          {availableRoles.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                selectedRole === role.id 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500'
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