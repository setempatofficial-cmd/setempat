'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, Package, Edit, Trash2, Eye, 
  TrendingUp, Plus, Loader2, MapPin, 
  CheckCircle, XCircle, Search,
  ArrowLeft, X
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function LapakkuSection({ 
  userId, 
  locationName, 
  onBack, 
  onAddProduct,
  onEditProduct 
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalValue: 0
  });
  const [error, setError] = useState(null);

  // Fetch produk milik user
  const fetchMyProducts = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('produk')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Tabel belum ada - tidak error, hanya kosong
        if (error.code === '42P01') {
          console.log('Tabel produk belum dibuat, akan dibuat otomatis saat pertama kali upload');
          setProducts([]);
          setStats({ total: 0, active: 0, totalValue: 0 });
          return;
        }
        throw error;
      }
      
      setProducts(data || []);
      
      // Hitung statistik
      const activeProducts = (data || []).filter(p => p.is_active === true);
      const totalValue = (data || []).reduce((sum, p) => sum + (p.harga || 0), 0);
      
      setStats({
        total: data?.length || 0,
        active: activeProducts.length,
        totalValue: totalValue
      });
      
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Gagal memuat data produk');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMyProducts();
  }, [fetchMyProducts]);

  // ... rest of the code (toggleProductStatus, deleteProduct, etc)
  // Sama seperti sebelumnya, tapi tambahkan error handling

  // Format Rupiah
  const formatRupiah = (harga) => {
    if (!harga) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(harga);
  };

  // Filter produk
  const filteredProducts = products.filter(product => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = product.nama_barang?.toLowerCase().includes(query);
      const descMatch = (product.deskripsi || '').toLowerCase().includes(query);
      if (!nameMatch && !descMatch) return false;
    }
    
    if (filterStatus === 'active' && !product.is_active) return false;
    if (filterStatus === 'inactive' && product.is_active) return false;
    
    return true;
  });

  // Toggle status
  const toggleProductStatus = async (productId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('produk')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) {
        if (error.code === '42P01') {
          alert('Tabel produk belum siap, silakan coba lagi nanti');
          return;
        }
        throw error;
      }
      
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, is_active: !currentStatus } : p
      ));
      
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Gagal mengubah status produk');
    }
  };

  // Delete produk
  const deleteProduct = async (productId) => {
    setDeletingId(productId);
    try {
      const { error } = await supabase
        .from('produk')
        .delete()
        .eq('id', productId);

      if (error) {
        if (error.code === '42P01') {
          alert('Tabel produk belum siap');
          return;
        }
        throw error;
      }
      
      setProducts(prev => prev.filter(p => p.id !== productId));
      setShowDeleteConfirm(null);
      
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        active: products.find(p => p.id === productId)?.is_active ? prev.active - 1 : prev.active
      }));
      
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Gagal menghapus produk');
    } finally {
      setDeletingId(null);
    }
  };

  // Empty State
  const EmptyState = () => (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
        <Store size={40} className="text-orange-400" />
      </div>
      <h3 className="text-slate-800 font-black text-lg mb-1">Lapak isih kosong</h3>
      <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto mb-6">
        Sampeyan durung ono dagangan. Ayo mulai jualan ing {locationName || "Pakijangan"}!
      </p>
      <button
        onClick={onAddProduct}
        className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-100 flex items-center gap-2"
      >
        <Plus size={14} /> Mulai Jualan
      </button>
    </div>
  );

  if (!userId) {
    return (
      <div className="py-16 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Store size={40} className="text-slate-400" />
        </div>
        <h3 className="text-slate-800 font-black text-lg mb-1">Login Dulu yuk</h3>
        <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">
          Silakan login untuk melihat lapak sampeyan
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <XCircle size={40} className="text-red-400" />
        </div>
        <h3 className="text-slate-800 font-black text-lg mb-1">Error</h3>
        <p className="text-slate-400 text-[10px] max-w-[220px] mx-auto">
          {error}
        </p>
        <button
          onClick={fetchMyProducts}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="w-full pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-[100] bg-[#FBFBFE] -mx-6 px-6 pt-2 pb-3 border-b border-slate-100">
        
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-600 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
            <span className="text-xs font-bold text-slate-600">Kembali</span>
          </button>
          
          <div className="flex items-center gap-2">
            <Store size={14} className="text-orange-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {locationName || "Pakijangan"}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-800 tracking-tighter">
            Lapakku
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[10px] text-slate-400">
              {stats.total} produk • {stats.active} aktif
            </p>
            {stats.totalValue > 0 && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                <TrendingUp size={10} />
                <span>Total {formatRupiah(stats.totalValue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari dagangan sampeyan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-slate-50 rounded-2xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            Kabeh ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all ${
              filterStatus === 'active'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            Aktif ({stats.active})
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all ${
              filterStatus === 'inactive'
                ? 'bg-slate-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            Nonaktif ({stats.total - stats.active})
          </button>
        </div>
      </div>

      {/* Product List */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 size={32} className="animate-spin text-slate-400 mb-2" />
            <p className="text-[10px] font-bold text-slate-400">Ngunduh dagangan...</p>
          </div>
        ) : products.length === 0 ? (
          <EmptyState />
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold text-sm">Ora ketemu</p>
            <p className="text-slate-400 text-[10px] mt-1">
              {searchQuery ? `Ganti kata kunci "${searchQuery}"` : 'Coba ganti filter'}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-4 text-orange-500 text-[10px] font-bold"
              >
                Hapus filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm">
                {/* Product Card Content - simplified for now */}
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800">{product.nama_barang}</h4>
                      <p className="text-orange-600 font-bold">{formatRupiah(product.harga)}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-[9px] font-bold ${
                      product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {product.is_active ? 'Aktif' : 'Nonaktif'}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onEditProduct(product)}
                      className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleProductStatus(product.id, product.is_active)}
                      className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold"
                    >
                      {product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(product)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      {products.length > 0 && (
        <button
          onClick={onAddProduct}
          className="fixed bottom-24 right-6 z-[90] bg-orange-500 text-white p-4 rounded-full shadow-xl shadow-orange-300 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}