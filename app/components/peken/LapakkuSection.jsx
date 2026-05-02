'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Store, Package, Edit, Trash2, TrendingUp, Plus, Loader2, MapPin, 
  XCircle, Search, ArrowLeft, X, UserPlus, ShoppingBag,
  Clock, Shield, Award
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function LapakkuSection({ 
  userId, 
  locationName, 
  onBack, 
  onAddProduct,
  onEditProduct,
  isSeller,           // dari profile.is_seller (boolean)
  ktpStatus,          // dari profile.ktp_status
  ktpRejectionReason, // dari profile.ktp_rejection_reason
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

  // Fetch Transaksi
  const fetchMyTransactions = useCallback(async () => {
    if (!userId || !isSeller) return;
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('pesanan')
        .select(`
          *,
          produk:produk_id (nama_barang, foto_url),
          pembeli:profiles!pembeli_id (full_name, phone)
        `)
        .eq('penjual_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
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
      minimumFractionDigits: 0
    }).format(harga || 0);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.nama_barang?.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'active') return matchesSearch && product.is_active;
    if (filterStatus === 'inactive') return matchesSearch && !product.is_active;
    return matchesSearch;
  });

  const toggleProductStatus = async (productId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('produk')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: !currentStatus } : p));
    } catch (err) {
      alert('Gagal mengubah status');
    }
  };

  const deleteProduct = async (productId) => {
    setDeletingId(productId);
    try {
      const { error } = await supabase.from('produk').delete().eq('id', productId);
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
      const { error } = await supabase.from('pesanan').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === orderId ? { ...t, status: newStatus } : t));
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

  const ActiveSellerState = () => (
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

        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
          {['produk', 'transaksi'].map((tab) => (
            <button key={tab} onClick={() => setSelectedTab(tab)} className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${selectedTab === tab ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>
              {tab === 'produk' ? <Package size={14} className="inline mr-1" /> : <ShoppingBag size={14} className="inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {selectedTab === 'produk' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari dagangan..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-orange-500" />
            </div>
            
            {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-orange-500" /></div> : 
             filteredProducts.map(product => (
              <div key={product.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800">{product.nama_barang}</h4>
                    <p className="text-orange-600 font-black text-sm">{formatRupiah(product.harga)}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {product.is_active ? 'Aktif' : 'Nonaktif'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEditProduct(product)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Edit size={14} /> Edit</button>
                  <button onClick={() => toggleProductStatus(product.id, product.is_active)} className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold">
                    {product.is_active ? 'Matikan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(product)} className="p-2 bg-red-50 text-red-600 rounded-xl"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Render Transaksi di sini (mirip aslinya) */
          <div className="space-y-3">
            {loadingTransactions ? <Loader2 className="animate-spin mx-auto mt-10" /> : transactions.map(order => (
               <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold">{order.produk?.nama_barang}</span>
                    <span className="text-[10px] uppercase text-orange-600 font-bold">{order.status}</span>
                 </div>
                 <div className="text-[10px] text-slate-500 mb-3">Pembeli: {order.pembeli?.full_name}</div>
                 {order.status === 'menunggu' && (
                   <button onClick={() => updateOrderStatus(order.id, 'diproses')} className="w-full py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">Proses Pesanan</button>
                 )}
               </div>
            ))}
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

  // LOGIKA NAVIGASI UTAMA
  if (!userId) return <div className="p-10 text-center font-bold">Harap Login</div>;
  if (isSeller) return <ActiveSellerState />;
  if (ktpStatus === 'pending') return <PendingState />;
  if (ktpStatus === 'rejected') return <RejectedState />;
  return <RegisterSellerState />;
}

// Sub-komponen Header agar kode tidak berulang
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