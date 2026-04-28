'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, User, MapPin, MessageCircle,
  ShoppingBag, Package, Store, Info, Star, Share2, 
  ChevronRight, Heart, ShieldCheck, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import OrderModal from './OrderModal';
import UlasanModal from './UlasanModal';

export default function DetailProdukModal({
  product, isOpen, onClose, userId, onOrderSuccess,
  locationName = 'Pasuruan', autoOpenUlasan = false
}) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showUlasanModal, setShowUlasanModal] = useState(false);
  const [ulasanList, setUlasanList] = useState([]);
  const [loadingUlasan, setLoadingUlasan] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);

  const formatRupiah = (harga) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);

  const averageRating = useMemo(() => {
    if (ulasanList.length === 0) return 0;
    return (ulasanList.reduce((acc, curr) => acc + curr.rating, 0) / ulasanList.length).toFixed(1);
  }, [ulasanList]);

  const handleChat = () => {
    const phoneNumber = product.penjual_phone;
    if (!phoneNumber) return alert('Nomor WhatsApp tidak tersedia');
    let cleanPhone = phoneNumber.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    window.open(`https://wa.me/${cleanPhone}?text=Halo Cak, saya tertarik dengan ${product.nama_barang}`, '_blank');
  };

  const handleShareToWA = () => {
    if (!product) return;

    const shareUrl = `${window.location.origin}/panyangan?product=${product.id}`;

    const message = `*${product.nama_barang}*\n\n` +
      `💰 Harga: ${formatRupiah(product.harga)}\n` +
      `📍 Lokasi: ${product.penjual_desa || locationName}\n` +
      `✨ Cek Barang: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const fetchUlasan = useCallback(async () => {
    if (!product?.id) return;
    setLoadingUlasan(true);
    const { data } = await supabase.from('ulasan').select('*').eq('produk_id', product.id).order('created_at', { ascending: false });
    if (data) setUlasanList(data);
    setLoadingUlasan(false);
  }, [product?.id]);

  const checkUserPurchase = useCallback(async () => {
    if (!userId || !product?.id) return;
    const { data } = await supabase.from('pesanan').select('id').eq('pembeli_id', userId).eq('produk_id', product.id).eq('status', 'selesai').maybeSingle();
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
      <div className="fixed inset-0 z-[200] bg-stone-50 overflow-y-auto max-w-[420px] mx-auto shadow-2xl font-sans animate-in fade-in duration-300">
        
        {/* Nav Atas - Lebih Tipis */}
        <nav className="fixed top-0 left-0 right-0 max-w-[450px] mx-auto z-50 flex items-center justify-between p-4 pointer-events-none">
          <button 
            onClick={onClose} 
            className="p-2.5 bg-white/90 backdrop-blur-xl rounded-xl shadow-sm text-stone-800 pointer-events-auto active:scale-90 transition-all border border-stone-100"
          >
            <ArrowLeft size={18} />
          </button>
          
          <button 
            onClick={handleShareToWA} 
            className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-200 text-white pointer-events-auto active:scale-90 transition-all border border-emerald-400"
          >
            <Share2 size={18} />
          </button>
        </nav>

        <main className="pb-32">
          {/* Hero Image - Ukuran disesuaikan agar tidak terlalu dominan */}
          <div className="p-3 pt-16">
            <div className="relative h-[320px] rounded-[32px] overflow-hidden shadow-xl ring-4 ring-white">
              {product.foto_url?.[0] ? (
                <img src={product.foto_url[0]} alt={product.nama_barang} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-400">
                  <Package size={40} />
                </div>
              )}
              
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-white/80 backdrop-blur-md p-3 rounded-[20px] border border-white/50 flex justify-between items-center shadow-md">
                  <div>
                    <p className="text-[9px] uppercase font-black tracking-widest text-stone-500 mb-0.5">Lokal {product.penjual_desa || locationName}</p>
                    <p className="text-xs font-bold text-stone-900">Produk Warga ✨</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                    product.stok_ready ? 'bg-emerald-500 text-white' : 'bg-stone-400 text-white'
                  }`}>
                    {product.stok_ready ? 'Ready' : 'Habis'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Utama - Font Diturunkan */}
          <section className="px-5 py-2">
            <div className="flex justify-between items-start mb-3">
              <h1 className="text-xl font-bold text-stone-900 leading-tight flex-1">
                {product.nama_barang}
              </h1>
              <div className="bg-orange-50 p-1.5 rounded-lg text-orange-500">
                <Sparkles size={16} />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6">
               <div className="flex bg-yellow-400/10 px-1.5 py-0.5 rounded-md items-center gap-1">
                  <Star size={12} fill="#facc15" className="text-yellow-400" />
                  <span className="text-[11px] font-black text-yellow-700">{averageRating}</span>
               </div>
               <span className="text-stone-400 text-[11px] font-medium">{ulasanList.length} Ulasan Tetangga</span>
            </div>

            {/* Price Card - Lebih Slim */}
            <div className="bg-stone-900 rounded-[24px] p-4 text-white flex justify-between items-center shadow-lg">
              <div>
                <p className="text-stone-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Harga Terbaik</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black">{formatRupiah(product.harga)}</span>
                  <span className="text-stone-500 font-medium text-[10px]">/ {product.satuan || 'Pcs'}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowOrderModal(true)} 
                className="bg-white text-stone-900 h-10 px-5 rounded-xl font-black text-[11px] active:scale-95 transition-transform"
              >
                BELI
              </button>
            </div>
          </section>

          {/* Bento Grid - Ukuran Font & Icon Diperkecil */}
          <section className="px-5 mt-6 grid grid-cols-2 gap-3">
            <div className="col-span-2 bg-white p-4 rounded-[24px] border border-stone-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-stone-800">
                <Info size={16} className="text-orange-500" />
                <span className="font-bold text-xs">Cerita Produk</span>
              </div>
              <p className="text-stone-500 text-xs leading-relaxed italic">
                "{product.deskripsi || 'Kualitas asli warga lokal.'}"
              </p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-[24px] border border-emerald-100">
              <User size={16} className="text-emerald-600 mb-2" />
              <p className="text-[9px] font-bold text-emerald-800/50 uppercase">Bakul</p>
              <p className="text-xs font-bold text-emerald-900 truncate">{product.nama_penjual || 'Warga'}</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-[24px] border border-orange-100">
              <MapPin size={16} className="text-orange-600 mb-2" />
              <p className="text-[9px] font-bold text-orange-800/50 uppercase">Lokasi</p>
              <p className="text-xs font-bold text-orange-900 truncate">{product.penjual_desa || 'Desa tidak diketahui'}</p>
            </div>
          </section>

          {/* Ulasan - Ringkas */}
          <section id="kata-tetangga" className="px-5 mt-8">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-black text-stone-900 italic">Kata Tetangga</h3>
               {hasPurchased && (
                 <button onClick={() => setShowUlasanModal(true)} className="text-[10px] font-bold text-orange-600 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
                   Tulis Kesan
                 </button>
               )}
            </div>
            
            <div className="space-y-3">
              {ulasanList.length === 0 ? (
                <p className="text-stone-400 text-[11px] italic text-center py-4 bg-stone-100 rounded-2xl">Belum ada ulasan.</p>
              ) : (
                ulasanList.slice(0, 2).map((u) => (
                  <div key={u.id} className="bg-white p-3 rounded-[20px] border border-stone-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[11px]">{u.nama_pembeli}</span>
                      <span className="text-yellow-500 font-black text-[10px]">★ {u.rating}</span>
                    </div>
                    <p className="text-stone-500 text-[11px] italic">"{u.komentar}"</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        {/* Footer - Lebih Slim & Ergonomis */}
        <footer className="fixed bottom-4 left-4 right-4 max-w-[418px] mx-auto z-[70]">
          <div className="bg-white/80 backdrop-blur-2xl p-2.5 rounded-[24px] shadow-2xl border border-white flex gap-2 ring-1 ring-black/5">
            <button 
              onClick={handleChat}
              className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all"
            >
              <MessageCircle size={20} />
            </button>
            
            <button 
              disabled={!product.stok_ready}
              onClick={() => setShowOrderModal(true)}
              className={`flex-1 rounded-xl font-bold text-[11px] tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 ${
                product.stok_ready 
                ? 'bg-stone-900 text-white shadow-xl' 
                : 'bg-stone-200 text-stone-400'
              }`}
            >
              <ShoppingBag size={16} />
              {product.stok_ready ? 'AMBIL SEKARANG' : 'STOK HABIS'}
            </button>
          </div>
        </footer>
      </div>

      <OrderModal isOpen={showOrderModal} onClose={() => setShowOrderModal(false)} product={product} userId={userId} onOrderSuccess={onOrderSuccess} onCloseParent={onClose} />
      <UlasanModal isOpen={showUlasanModal} onClose={() => setShowUlasanModal(false)} product={product} userId={userId} onSuccess={fetchUlasan} />
    </>
  );
}