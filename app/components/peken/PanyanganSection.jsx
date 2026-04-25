'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Search, Plus,
  Package, ShoppingBag, ChevronRight,
  User, MapPin, MessageCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// Daftar kategori dengan sentuhan lokal
const CATEGORIES = [
  { id: 'all', label: 'Kabeh', icon: '🌈' },
  { id: 'makanan', label: 'Panganan', icon: '🍿' },
  { id: 'minuman', label: 'Ombenan', icon: '🥤' },
  { id: 'pertanian', label: 'Hasil Bumi', icon: '🌽' },
  { id: 'kerajinan', label: 'Kriya', icon: '🎨' },
  { id: 'jasa', label: 'Jasa', icon: '🛠️' },
];

export default function PanyanganSection({
  locationName = 'Pasuruan',
  userId,
  onBack,
  onAddProduct
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // --- LOGIKA SMART HEADER ---
  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 20) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  // --- FETCH DATA ---
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('produk')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('nama_barang', `%${searchQuery}%`);
      }

      if (selectedCategory !== 'all') {
        query = query.eq('kategori', selectedCategory);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setProducts(data || []);
    } catch (err) {
      console.error('Error:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const formatRupiah = (harga) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(harga || 0);
  };

  return (
    <div className="relative min-h-screen bg-[#FBFBFE]">

      {/* HEADER & SEARCH (OPTIMIZED - FINAL) */}
      <div className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-300 ${
        showHeader ? 'translate-y-0' : '-translate-y-[62px]'
      }`}>
        <div className="max-w-[420px] mx-auto bg-white/80 backdrop-blur-md border-b border-slate-100">

          {/* Baris 1: Navigasi & Lokasi Aktif */}
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="p-2 -ml-2 text-slate-600 active:scale-90 transition-all">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h3 className="font-black text-slate-900 text-sm italic tracking-tighter leading-none">PANYANGAN</h3>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Pasar Warga</p>
              </div>
            </div>

            {/* LOKASI AKTIF (Pojok Kanan Atas - Pengganti Tombol Plus) */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full shadow-sm">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-orange-700 uppercase tracking-tight">
                {locationName}
              </span>
              <MapPin size={10} className="text-orange-500" />
            </div>
          </div>

          {/* Baris 2: Search & Kategori */}
          <div className="px-6 pb-3 space-y-3">
            {/* Search Input */}
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <input
                type="text"
                placeholder="Golek panganan opo kriya..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-xl text-[11px] focus:bg-white focus:border-orange-200 focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Horizontal Scroll Categories */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all border ${
                    selectedCategory === cat.id
                      ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                      : 'bg-white border-slate-100 text-slate-500 hover:border-orange-200'
                  }`}
                >
                  <span className="mr-1">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT AREA: Grid Mepet & Estetik */}
      <div className="pt-48 px-2 pb-24 max-w-[420px] mx-auto">

        {/* SKELETON LOADING */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl aspect-[3/4] animate-pulse border border-slate-50" />
            ))}
          </div>
        ) : products.length === 0 ? (
          /* EMPTY STATE */
          <div className="py-20 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-orange-50 rounded-[32px] flex items-center justify-center mb-6 rotate-3">
              <ShoppingBag size={40} className="text-orange-400" />
            </div>
            <h4 className="text-slate-900 font-black text-lg uppercase tracking-tight">Kosong Lur</h4>
            <p className="text-slate-400 text-[10px] mt-2 max-w-[180px] font-bold leading-relaxed uppercase">
              Mungkin durung ono sing dodolan nangkene.
            </p>
          </div>
        ) : (
          /* MAIN GRID: Mepet Pinggir & Pinterest Style */
          <div className="columns-2 gap-2 space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="break-inside-avoid bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm active:scale-[0.98] transition-all flex flex-col group"
              >
                {/* FOTO PRODUK */}
                <div className="relative bg-slate-50 overflow-hidden">
                  {product.foto_url?.[0] ? (
                    <img
                      src={product.foto_url[0]}
                      alt={product.nama_barang}
                      className="w-full h-auto block object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="aspect-square flex items-center justify-center text-slate-200">
                      <Package size={40} strokeWidth={1} />
                    </div>
                  )}

                  {/* BADGE STATUS (Floating) */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter backdrop-blur-md shadow-sm ${
                      product.stok_ready ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'
                    }`}>
                      {product.stok_ready ? 'Ready' : 'Entek'}
                    </span>

                    {product.kondisi_lokal && (
                      <div className="px-2 py-0.5 bg-black/40 backdrop-blur-md text-white text-[6px] font-black uppercase tracking-widest rounded-md w-fit">
                        ✨ {product.kondisi_lokal}
                      </div>
                    )}
                  </div>
                </div>

                {/* DETAIL DAGANGAN */}
                <div className="p-3">
                  <h4 className="text-[11px] font-black text-slate-800 leading-tight uppercase line-clamp-2 italic tracking-tight mb-1">
                    {product.nama_barang}
                  </h4>

                  {/* Info Penjual (Kearifan Lokal) */}
                  <div className="flex items-center gap-1.5 mt-1.5 mb-2">
                    <div className="w-4 h-4 bg-orange-100 rounded-full flex items-center justify-center">
                      <User size={8} className="text-orange-600" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 italic truncate">
                      Duwe {product.nama_penjual || 'Warga'}
                    </span>
                  </div>

                  {/* Harga & Satuan */}
                  <div className="mt-auto flex items-baseline gap-1">
                    <span className="text-sm font-black text-slate-900 tracking-tighter">
                      {formatRupiah(product.harga).replace('Rp', '').trim()}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">/ {product.satuan || 'Pcs'}</span>
                  </div>

                  {/* Lokasi & Tombol Sapa */}
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex justify-between items-center group/btn">
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-slate-400 uppercase leading-none">Lokasi</span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <MapPin size={7} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-700 truncate max-w-[50px]">
                          {product.ancer_ancer || locationName}
                        </span>
                      </div>
                    </div>

                    {/* TOMBOL SAPA (WA Style) */}
                    <button className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-100 active:scale-90 transition-all hover:bg-emerald-600">
                      <MessageCircle size={14} fill="currentColor" className="text-emerald-200" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}