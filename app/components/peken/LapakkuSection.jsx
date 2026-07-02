'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Package, Edit, Trash2, TrendingUp, Plus, Loader2, MapPin,
  XCircle, Search, ArrowLeft, X, UserPlus, ShoppingBag,
  Clock, Shield, Award, Truck, Phone, MapPin as MapPinIcon,
  CheckCircle, AlertCircle, User, Calendar, CreditCard,
  Navigation, DollarSign, Home, Eye, ChevronDown, ChevronUp,
  Image as ImageIcon, Tag, Star, Heart
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function LapakkuSection({
  userId,
  locationName,
  onBack,
  onAddProduct,
  onEditProduct,
  isSeller,
  ktpStatus,
  ktpRejectionReason,
  onOpenDaftarBakul,
  onRefreshStatus
}) {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, totalValue: 0 });
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTab, setSelectedTab] = useState('produk');
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [transactionStats, setTransactionStats] = useState({
    total: 0,
    revenue: 0,
    pending: 0,
    processing: 0,
    shipping: 0,
    completed: 0
  });

  // Fetch Produk
  const fetchMyProducts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('produk')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
      const activeProducts = (data || []).filter(p => p.is_active === true);
      const totalValue = (data || []).reduce((sum, p) => sum + (p.harga || 0), 0);

      setStats({
        total: data?.length || 0,
        active: activeProducts.length,
        totalValue: totalValue
      });
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Gagal memuat data produk');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch Transaksi dengan informasi lengkap
  const fetchMyTransactions = useCallback(async () => {
    if (!userId || !isSeller) return;
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('pesanan')
        .select(`
          *,
          produk:produk_id (
            nama_barang, 
            foto_url,
            harga,
            deskripsi
          ),
          pembeli:profiles!pembeli_id (
            full_name, 
            phone,
            avatar_url,
            alamat
          ),
          driver:profiles!driver_id (
            full_name, 
            phone
          )
        `)
        .eq('penjual_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validData = (data || []).filter(order => order.produk !== null);
      setTransactions(validData);

      const stats = {
        total: validData.length,
        revenue: validData
          .filter(t => t.status === 'selesai')
          .reduce((sum, t) => sum + (t.total_harga || 0) + (t.ongkir || 0), 0),
        pending: validData.filter(t => t.status === 'menunggu').length,
        processing: validData.filter(t => t.status === 'diproses').length,
        shipping: validData.filter(t => t.status === 'dikirim').length,
        completed: validData.filter(t => t.status === 'selesai').length
      };
      setTransactionStats(stats);

    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, [userId, isSeller]);

  useEffect(() => {
    if (isSeller) {
      fetchMyProducts();
    }
  }, [fetchMyProducts, isSeller]);

  useEffect(() => {
    if (isSeller && selectedTab === 'transaksi') {
      fetchMyTransactions();
    }
  }, [selectedTab, isSeller, fetchMyTransactions]);

  const formatRupiah = (harga) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(harga || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      'menunggu': {
        label: 'Menunggu Konfirmasi',
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock,
        actions: ['diproses']
      },
      'diproses': {
        label: 'Sedang Diproses',
        color: 'bg-blue-100 text-blue-800',
        icon: Package,
        actions: ['dikirim']
      },
      'dikirim': {
        label: 'Sedang Dikirim',
        color: 'bg-purple-100 text-purple-800',
        icon: Truck,
        actions: ['selesai']
      },
      'selesai': {
        label: 'Selesai',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        actions: []
      },
      'batal': {
        label: 'Dibatalkan',
        color: 'bg-red-100 text-red-800',
        icon: XCircle,
        actions: []
      }
    };
    return configs[status] || configs['menunggu'];
  };

  const getShippingStatusConfig = (status) => {
    const configs = {
      'menunggu_driver': { label: 'Menunggu Driver', icon: Clock },
      'driver_ditugaskan': { label: 'Driver Ditugaskan', icon: UserPlus },
      'dalam_perjalanan': { label: 'Dalam Perjalanan', icon: Navigation },
      'sampai_tujuan': { label: 'Sampai Tujuan', icon: CheckCircle }
    };
    return configs[status] || configs['menunggu_driver'];
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.nama_barang?.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'active') return matchesSearch && product.is_active;
    if (filterStatus === 'inactive') return matchesSearch && !product.is_active;
    return matchesSearch;
  });

  const filteredTransactions = transactions.filter(order => {
    if (transactionFilter === 'all') return true;
    return order.status === transactionFilter;
  });

  const toggleProductStatus = async (productId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('produk')
        .update({ is_active: !currentStatus })
        .eq('id', productId)
        .eq('user_id', userId);

      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: !currentStatus } : p));
    } catch (err) {
      alert('Gagal mengubah status');
    }
  };

  const deleteProduct = async (productId) => {
    setDeletingId(productId);
    try {
      const { error } = await supabase
        .from('produk')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId);

      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== productId));
      setShowDeleteConfirm(null);
    } catch (err) {
      alert('Gagal menghapus');
    } finally {
      setDeletingId(null);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'selesai') {
        updateData.tanggal_selesai = new Date().toISOString();
      }

      const { error } = await supabase
        .from('pesanan')
        .update(updateData)
        .eq('id', orderId)
        .eq('penjual_id', userId);

      if (error) throw error;

      setTransactions(prev => prev.map(t =>
        t.id === orderId ? { ...t, ...updateData } : t
      ));

    } catch (err) {
      alert('Gagal update status');
    }
  };

  // ==========================================
  // RENDER STATES
  // ==========================================

  const RegisterSellerState = () => (
    <div className="w-full pb-24">
      <Header onBack={onBack} title="Lapakku" subtitle="Daftar jadi Bakul" locationName={locationName} />
      <div className="py-16 flex flex-col items-center text-center px-6">
        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <Store size={48} className="text-orange-500" />
        </div>
        <h3 className="text-slate-800 font-black text-xl mb-2">Durung Dadi Bakul?</h3>
        <p className="text-slate-500 text-sm mb-6">Daftar dadi penjual supaya bisa gelar dagangan lan melayani warga {locationName}.</p>
        <button onClick={onOpenDaftarBakul} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all">
          <UserPlus size={18} /> Daftar Jadi Bakul
        </button>
      </div>
    </div>
  );

  const PendingState = () => (
    <div className="w-full pb-24">
      <Header onBack={onBack} title="Lapakku" subtitle="Status Verifikasi" locationName={locationName} />
      <div className="p-5">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
          <Clock size={40} className="text-yellow-600 mx-auto mb-3" />
          <h3 className="font-bold text-yellow-800">Sedang Diproses</h3>
          <p className="text-yellow-700 text-xs mt-1">Data KTP sampeyan lagi dicek admin. Sabar nggih, maksimal 1x24 jam.</p>
          <button onClick={onRefreshStatus} className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-xl text-xs font-bold">Refresh Status</button>
        </div>
      </div>
    </div>
  );

  const RejectedState = () => (
    <div className="w-full pb-24">
      <Header onBack={onBack} title="Lapakku" subtitle="Pendaftaran Ditolak" locationName={locationName} />
      <div className="p-5">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <XCircle size={40} className="text-red-600 mb-3" />
          <h3 className="font-bold text-red-800 text-lg">Waduh, Ditolak</h3>
          <p className="text-red-700 text-xs mt-1 mb-4">{ktpRejectionReason || 'Data KTP kurang jelas atau tidak sesuai.'}</p>
          <button onClick={onOpenDaftarBakul} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold">Ajukan Ulang</button>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // KOMPONEN PRODUCT CARD (DIPERBAIKI)
  // ==========================================

  const ProductCard = ({ product }) => {
    const [imageError, setImageError] = useState(false);

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
        {/* Image Section */}
        <div className="relative h-48 bg-slate-100 overflow-hidden">
          {product.foto_url && !imageError ? (
            <img
              src={product.foto_url}
              alt={product.nama_barang}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
              <ImageIcon size={40} className="mb-2" />
              <span className="text-xs">No Image</span>
            </div>
          )}

          {/* Status Badge on Image */}
          <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold shadow-lg ${product.is_active ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'
            }`}>
            {product.is_active ? 'Aktif' : 'Nonaktif'}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex justify-between items-start gap-2 mb-2">
            <h4 className="font-bold text-slate-800 text-sm line-clamp-2 flex-1">
              {product.nama_barang}
            </h4>
          </div>

          <p className="text-orange-600 font-black text-lg mb-3">
            {formatRupiah(product.harga)}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-[10px] text-slate-400 mb-3">
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(product.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short'
              })}
            </div>
            {product.stok && (
              <div className="flex items-center gap-1">
                <Package size={12} />
                Stok: {product.stok}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onEditProduct(product)}
              className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition"
            >
              <Edit size={14} /> Edit
            </button>
            <button
              onClick={() => toggleProductStatus(product.id, product.is_active)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${product.is_active
                  ? 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
            >
              {product.is_active ? 'Matikan' : 'Aktifkan'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(product)}
              className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // KOMPONEN TRANSACTION CARD (DIPERBAIKI)
  // ==========================================

  const TransactionCard = ({ order }) => {
    const isExpanded = expandedOrders.has(order.id);
    const statusConfig = getStatusConfig(order.status);
    const StatusIcon = statusConfig.icon;
    const shippingConfig = getShippingStatusConfig(order.shipping_status);
    const ShippingIcon = shippingConfig.icon;

    const toggleExpand = (e) => {
      e.stopPropagation();
      setExpandedOrders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(order.id)) {
          newSet.delete(order.id);
        } else {
          newSet.clear();
          newSet.add(order.id);
        }
        return newSet;
      });
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all">
        {/* Header Card - Klik untuk toggle */}
        <div
          className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
          onClick={toggleExpand}
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                  #{order.id.slice(0, 8)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${statusConfig.color}`}>
                  <StatusIcon size={12} />
                  {statusConfig.label}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-sm">{order.produk?.nama_barang}</h4>
              <p className="text-orange-600 font-black text-sm">
                {formatRupiah(order.total_harga)}
                {order.jumlah > 1 && (
                  <span className="text-slate-400 font-normal text-xs ml-1">
                    ({order.jumlah} item)
                  </span>
                )}
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <p className="text-[10px] text-slate-400">{formatDate(order.created_at)}</p>
              <button className="text-slate-400 hover:text-slate-600 transition-transform duration-200">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {/* Info Ringkas */}
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
            <div className="flex items-center gap-1">
              <User size={12} />
              {order.pembeli?.full_name || 'Unknown'}
            </div>
            {order.shipping_method === 'delivery' && (
              <div className="flex items-center gap-1">
                <Truck size={12} />
                Delivery
              </div>
            )}
            {order.status === 'selesai' && order.tanggal_selesai && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle size={12} />
                Selesai {formatDate(order.tanggal_selesai)}
              </div>
            )}
          </div>
        </div>

        {/* Expanded Content - dengan animasi */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
        >
          <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
            {/* Detail Produk */}
            <div className="flex gap-3">
              {order.produk?.foto_url && (
                <img
                  src={order.produk.foto_url}
                  alt={order.produk.nama_barang}
                  className="w-20 h-20 rounded-xl object-cover bg-slate-100"
                />
              )}
              <div className="flex-1">
                <h5 className="font-bold text-sm text-slate-800">{order.produk?.nama_barang}</h5>
                <p className="text-xs text-slate-500">{order.produk?.deskripsi?.slice(0, 60)}...</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                    {order.jumlah} x {formatRupiah(order.total_harga / order.jumlah)}
                  </span>
                </div>
              </div>
            </div>

            {/* Informasi Pembeli */}
            <div className="bg-white rounded-xl p-3 border border-slate-100">
              <h6 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                <User size={14} /> Informasi Pembeli
              </h6>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-400">Nama</span>
                <span className="font-medium">{order.pembeli?.full_name || '-'}</span>
                <span className="text-slate-400">Telepon</span>
                <span className="font-medium">{order.pembeli?.phone || '-'}</span>
                {order.penerima_nama && (
                  <>
                    <span className="text-slate-400">Penerima</span>
                    <span className="font-medium">{order.penerima_nama}</span>
                  </>
                )}
                {order.penerima_hp && (
                  <>
                    <span className="text-slate-400">HP Penerima</span>
                    <span className="font-medium">{order.penerima_hp}</span>
                  </>
                )}
              </div>
            </div>

            {/* Informasi Pengiriman */}
            {order.shipping_method && (
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <h6 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                  <Truck size={14} /> Informasi Pengiriman
                </h6>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Metode</span>
                    <span className="font-medium capitalize">
                      {order.shipping_method === 'delivery' ? 'Diantar' : 'Ambil Sendiri'}
                    </span>
                  </div>

                  {order.shipping_method === 'delivery' && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Alamat</span>
                        <span className="font-medium text-right max-w-[200px]">
                          {order.alamat_pengiriman || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Ongkir</span>
                        <span className="font-medium">{formatRupiah(order.ongkir || 0)}</span>
                      </div>
                      {order.estimated_jarak && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Estimasi Jarak</span>
                          <span className="font-medium">{order.estimated_jarak} km</span>
                        </div>
                      )}
                      {order.driver && (
                        <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-100">
                          <User size={12} className="text-slate-400" />
                          <span className="text-xs">Driver: {order.driver.full_name}</span>
                          {order.driver.phone && (
                            <a href={`tel:${order.driver.phone}`} className="text-xs text-blue-600">
                              <Phone size={12} />
                            </a>
                          )}
                        </div>
                      )}
                      {order.shipping_status && (
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <ShippingIcon size={14} className="text-slate-400" />
                          <span className="font-medium">{shippingConfig.label}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Catatan Pembeli */}
            {order.catatan && (
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
                <p className="text-xs text-yellow-800">
                  <span className="font-bold">Catatan:</span> {order.catatan}
                </p>
              </div>
            )}

            {/* Bukti Pembayaran */}
            {order.bukti_pembayaran_url && (
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <button
                  onClick={() => window.open(order.bukti_pembayaran_url, '_blank')}
                  className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                >
                  <CreditCard size={14} /> Lihat Bukti Pembayaran
                </button>
              </div>
            )}

            {/* Action Buttons */}
            {order.status !== 'selesai' && order.status !== 'batal' && (
              <div className="flex gap-2 mt-2">
                {statusConfig.actions.includes('diproses') && order.status === 'menunggu' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'diproses')}
                    className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition"
                  >
                    Proses Pesanan
                  </button>
                )}
                {statusConfig.actions.includes('dikirim') && order.status === 'diproses' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'dikirim')}
                    className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition"
                  >
                    Kirim Pesanan
                  </button>
                )}
                {statusConfig.actions.includes('selesai') && order.status === 'dikirim' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'selesai')}
                    className="flex-1 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition"
                  >
                    Selesaikan Pesanan
                  </button>
                )}
                {order.status === 'menunggu' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'batal')}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition"
                  >
                    Batalkan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // AKTIF SELLER STATE
  // ==========================================

  const ActiveSellerState = () => {
    const totalRevenue = transactionStats.revenue;

    return (
      <div className="w-full pb-24">
        <div className="sticky top-0 z-[100] bg-[#FBFBFE] -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="p-2 -ml-2 text-slate-600"><ArrowLeft size={20} /></button>
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full text-green-700 font-bold text-[10px]">
              <Award size={12} /> Bakul Terverifikasi
            </div>
          </div>

          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">Lapakku</h2>
              <p className="text-[10px] text-slate-400">{stats.total} Produk • {formatRupiah(stats.totalValue)}</p>
            </div>
            <button onClick={onAddProduct} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-orange-200">
              <Plus size={16} /> Tambah
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            {['produk', 'transaksi'].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${selectedTab === tab ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'
                  }`}
              >
                {tab === 'produk' ? <Package size={14} className="inline mr-1" /> : <ShoppingBag size={14} className="inline mr-1" />}
                {tab}
                {tab === 'transaksi' && transactions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[8px]">
                    {transactions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {selectedTab === 'produk' ? (
            // ========== TAB PRODUK ==========
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari dagangan..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-orange-500"
                >
                  <option value="all">Semua</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>

              {/* Product Grid */}
              {loading ? (
                <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-orange-500" size={40} /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-100">
                  <Package size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm font-medium">Belum ada produk</p>
                  <p className="text-slate-400 text-xs mt-1">Mulai jualan sekarang!</p>
                  <button onClick={onAddProduct} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition">
                    + Tambah Produk
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // ========== TAB TRANSAKSI ==========
            <div className="space-y-4">
              {/* Statistik Transaksi */}
              {transactions.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">Total Pesanan</p>
                    <p className="font-black text-slate-800 text-lg">{transactionStats.total}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">Pendapatan</p>
                    <p className="font-black text-green-600 text-sm">{formatRupiah(totalRevenue)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">Menunggu</p>
                    <p className="font-black text-yellow-600 text-lg">{transactionStats.pending}</p>
                  </div>
                </div>
              )}

              {/* Filter Status */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { value: 'all', label: 'Semua' },
                  { value: 'menunggu', label: `Menunggu (${transactionStats.pending})` },
                  { value: 'diproses', label: `Diproses (${transactionStats.processing})` },
                  { value: 'dikirim', label: `Dikirim (${transactionStats.shipping})` },
                  { value: 'selesai', label: `Selesai (${transactionStats.completed})` }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setTransactionFilter(filter.value)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${transactionFilter === filter.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* List Transaksi */}
              {loadingTransactions ? (
                <div className="py-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-orange-500" size={40} />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-100">
                  <ShoppingBag size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm font-medium">Belum ada transaksi</p>
                  <p className="text-slate-400 text-xs mt-1">Tunggu pembeli memesan produkmu</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map(order => (
                    <TransactionCard key={order.id} order={order} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-[32px] p-6 w-full max-w-xs text-center">
              <h3 className="font-black text-slate-800 text-lg mb-2">Hapus Produk?</h3>
              <p className="text-slate-500 text-xs mb-6">Yakin ingin menghapus "{showDeleteConfirm.nama_barang}"? Data tidak bisa kembali.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 rounded-2xl font-bold text-slate-600 text-xs">Batal</button>
                <button onClick={() => deleteProduct(showDeleteConfirm.id)} className="flex-1 py-3 bg-red-500 rounded-2xl font-bold text-white text-xs">Ya, Hapus</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // LOGIKA NAVIGASI UTAMA
  if (!userId) return <div className="p-10 text-center font-bold">Harap Login</div>;
  if (isSeller) return <ActiveSellerState />;
  if (ktpStatus === 'pending') return <PendingState />;
  if (ktpStatus === 'rejected') return <RejectedState />;
  return <RegisterSellerState />;
}

// Sub-komponen Header
function Header({ onBack, title, subtitle, locationName }) {
  return (
    <div className="sticky top-0 z-[100] bg-[#FBFBFE] -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-600"><ArrowLeft size={20} /></button>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
          <MapPin size={12} className="text-orange-500" /> {locationName}
        </div>
      </div>
      <h2 className="text-xl font-black text-slate-800">{title}</h2>
      <p className="text-[10px] text-slate-400">{subtitle}</p>
    </div>
  );
}