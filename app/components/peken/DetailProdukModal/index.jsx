'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, User, MapPin, MessageCircle,
  ShoppingBag, Package, Store, Info, Star, Share2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import OrderModal from './OrderModal';
import UlasanModal from './UlasanModal';

// --- Sub-Components untuk Kebersihan Kode ---

const BadgeStok = ({ ready }) => (
  <div className={`absolute top-4 right-4 px-4 py-1.5 rounded-full text-xs font-bold shadow-md backdrop-blur-md ${
    ready ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
  }`}>
    {ready ? '● Tersedia' : '● Habis'}
  </div>
);

const SectionTitle = ({ icon: Icon, title, color = "text-orange-500" }) => (
  <div className="flex items-center gap-2 text-stone-800 font-bold border-b border-stone-100 pb-2 mb-3">
    <Icon size={18} className={color} />
    <span>{title}</span>
  </div>
);

export default function DetailProdukModal({
  product,
  isOpen,
  onClose,
  userId,
  onOrderSuccess,
  locationName = 'Pasuruan',
  autoOpenUlasan = false
}) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showUlasanModal, setShowUlasanModal] = useState(false);
  const [ulasanList, setUlasanList] = useState([]);
  const [loadingUlasan, setLoadingUlasan] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);

  // --- Logic & Helpers ---

  const formatRupiah = (harga) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);

  const averageRating = useMemo(() => {
    if (ulasanList.length === 0) return 0;
    const sum = ulasanList.reduce((acc, curr) => acc + curr.rating, 0);
    return (sum / ulasanList.length).toFixed(1);
  }, [ulasanList]);

  const handleShareToWA = () => {
    if (!product) return;
    const message = `*${product.nama_barang}*\n\n` +
      `💰 Harga: ${formatRupiah(product.harga)}\n` +
      `📍 Lokasi: ${locationName}\n` +
      `✨ Detail: ${window.location.origin}/peken?product=${product.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleChat = () => {
    const phoneNumber = product.penjual_phone;
    if (!phoneNumber) return alert('Nomor WhatsApp tidak tersedia');
    let cleanPhone = phoneNumber.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    window.open(`https://wa.me/${cleanPhone}?text=Halo, saya tertarik dengan ${product.nama_barang}`, '_blank');
  };

  const fetchUlasan = useCallback(async () => {
    if (!product?.id) return;
    setLoadingUlasan(true);
    try {
      const { data, error } = await supabase
        .from('ulasan')
        .select('*')
        .eq('produk_id', product.id)
        .order('created_at', { ascending: false });
      if (!error) setUlasanList(data || []);
    } finally {
      setLoadingUlasan(false);
    }
  }, [product?.id]);

  const checkUserPurchase = useCallback(async () => {
    if (!userId || !product?.id) return;
    const { data } = await supabase
      .from('pesanan')
      .select('id')
      .eq('pembeli_id', userId)
      .eq('produk_id', product.id)
      .eq('status', 'selesai')
      .maybeSingle();
    setHasPurchased(!!data);
  }, [userId, product?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchUlasan();
      if (userId) checkUserPurchase();
      if (autoOpenUlasan) setShowUlasanModal(true);
    }
  }, [isOpen, userId, autoOpenUlasan, fetchUlasan, checkUserPurchase]);

  if (!isOpen || !product) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-stone-50 overflow-y-auto max-w-[450px] mx-auto shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Sticky Header */}
        <header className="sticky top-0 bg-white/90 backdrop-blur-lg border-b border-stone-100 z-50 p-4 flex items-center justify-between">
          <button onClick={onClose} className="p-2.5 bg-stone-100 rounded-full active:scale-90 transition-transform">
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <h2 className="font-bold text-stone-800">Detail Produk</h2>
          <button onClick={handleShareToWA} className="p-2.5 bg-emerald-50 rounded-full active:scale-90 transition-transform">
            <Share2 size={20} className="text-emerald-600" />
          </button>
        </header>

        <main className="pb-32">
          {/* Hero Image */}
          <div className="relative h-[400px] bg-stone-200">
            {product.foto_url?.[0] ? (
              <img src={product.foto_url[0]} alt={product.nama_barang} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                <Package size={64} strokeWidth={1} />
                <p className="mt-2 text-sm italic">Foto belum tersedia</p>
              </div>
            )}
            <BadgeStok ready={product.stok_ready} />
          </div>

          {/* Product Info Card */}
          <section className="bg-white -mt-10 relative rounded-t-[40px] p-6 shadow-sm border-t border-stone-100">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-stone-900 leading-tight mb-2">{product.nama_barang}</h1>
              <div className="flex items-center gap-2 text-stone-500 bg-stone-50 w-fit px-3 py-1 rounded-lg">
                <Store size={14} />
                <span className="text-xs font-semibold uppercase tracking-wider">{locationName} Local Pride</span>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-8 p-5 bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-3xl border border-orange-100">
              <span className="text-3xl font-black text-orange-600">{formatRupiah(product.harga)}</span>
              <span className="text-orange-400 font-medium font-mono">/ {product.satuan || 'Pcs'}</span>
            </div>

            {/* Seller & Location Row */}
            <div className="grid grid-cols-1 gap-4 mb-8">
              <div className="flex items-center gap-4 p-4 bg-white border border-stone-100 rounded-2xl hover:border-emerald-200 transition-colors">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                  <User size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold text-stone-400 tracking-tighter">Pemilik Usaha</p>
                  <p className="font-bold text-stone-800 line-clamp-1">{product.nama_penjual || 'Warga Desa'}</p>
                </div>
                <button onClick={handleChat} className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-100 active:scale-90 transition-transform">
                  <MessageCircle size={20} />
                </button>
              </div>

              <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl">
                <div className="p-2 bg-white rounded-lg text-orange-500 shadow-sm">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-800">Lokasi Pengambilan</p>
                  <p className="text-xs text-stone-500 leading-relaxed mt-0.5">{product.ancer_ancer || `Area ${locationName}`}</p>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="mb-10">
              <SectionTitle icon={Info} title="Cerita Produk" />
              <p className="text-stone-600 text-sm leading-relaxed bg-stone-50/50 p-4 rounded-2xl italic border border-dashed border-stone-200">
                "{product.deskripsi || 'Produk unggulan hasil karya tangan warga lokal yang dijamin kualitas dan keasliannya.'}"
              </p>
            </div>

            {/* Reviews Section */}
            <div id="kata-tetangga" className="pt-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-stone-800 text-lg">Kata Tetangga</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex text-yellow-400">
                      <Star size={14} fill="currentColor" />
                    </div>
                    <span className="text-xs font-bold text-stone-500">
                      {averageRating > 0 ? `${averageRating}/5.0` : 'Belum ada rating'} • {ulasanList.length} Ulasan
                    </span>
                  </div>
                </div>
                {hasPurchased && (
                  <button onClick={() => setShowUlasanModal(true)} className="text-xs font-bold text-orange-600 bg-orange-50 px-4 py-2.5 rounded-full border border-orange-100 active:bg-orange-100 transition-colors">
                    Beri Ulasan
                  </button>
                )}
              </div>

              {/* Ulasan List Render */}
              <div className="space-y-4">
                {loadingUlasan ? (
                  <div className="animate-pulse flex flex-col gap-2">
                    <div className="h-20 bg-stone-100 rounded-2xl w-full" />
                  </div>
                ) : ulasanList.length === 0 ? (
                  <div className="text-center py-10 px-6 border-2 border-dashed border-stone-100 rounded-[32px]">
                    <p className="text-stone-400 text-sm italic">Belum ada ulasan dari warga.</p>
                  </div>
                ) : (
                  ulasanList.slice(0, 3).map((ulasan) => (
                    <div key={ulasan.id} className="p-4 rounded-3xl border border-stone-100 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-[10px] font-bold">
                            {ulasan.nama_pembeli?.charAt(0) || 'W'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-stone-800">{ulasan.nama_pembeli}</p>
                            <div className="flex text-yellow-400">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} size={8} fill={i < ulasan.rating ? "currentColor" : "none"} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-stone-400">{new Date(ulasan.created_at).toLocaleDateString('id-ID')}</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-snug italic">"{ulasan.komentar}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>

        {/* Action Bottom Bar */}
        <footer className="fixed bottom-0 left-0 right-0 max-w-[450px] mx-auto p-4 bg-white/80 backdrop-blur-xl border-t border-stone-100 flex gap-3 z-[60]">
          <button
            onClick={() => document.getElementById('kata-tetangga')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center justify-center w-20 aspect-square bg-stone-50 text-stone-600 rounded-2xl border border-stone-200 active:scale-95 transition-all"
          >
            <Star size={20} className={averageRating > 0 ? "text-yellow-500" : "text-stone-300"} fill={averageRating > 0 ? "currentColor" : "none"} />
            <span className="text-[9px] font-black mt-1 uppercase">Rating</span>
          </button>

          <button
            onClick={() => product.stok_ready && setShowOrderModal(true)}
            disabled={!product.stok_ready}
            className={`flex-1 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${
              product.stok_ready 
                ? 'bg-orange-600 text-white shadow-orange-200 hover:bg-orange-700' 
                : 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
            }`}
          >
            <ShoppingBag size={20} />
            <span className="tracking-wide">{product.stok_ready ? 'PESAN SEKARANG' : 'STOK HABIS'}</span>
          </button>
        </footer>
      </div>

      {/* Modals */}
      <OrderModal 
        isOpen={showOrderModal} 
        onClose={() => setShowOrderModal(false)} 
        product={product} 
        userId={userId} 
        onOrderSuccess={onOrderSuccess} 
        onCloseParent={onClose} 
      />
      <UlasanModal 
        isOpen={showUlasanModal} 
        onClose={() => setShowUlasanModal(false)} 
        product={product} 
        userId={userId} 
        onSuccess={fetchUlasan} 
      />
    </>
  );
}