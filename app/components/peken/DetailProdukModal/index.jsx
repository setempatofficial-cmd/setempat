'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, User, MapPin, MessageCircle,
  ShoppingBag, Package, Star, Share2, Info, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import OrderModal from './OrderModal';
import UlasanModal from './UlasanModal';
import { hitungJarak, formatJarak } from '@/lib/distance'; 

export default function DetailProdukModal({
  product, 
  isOpen, 
  onClose, 
  userId, 
  onOrderSuccess,
  locationName = 'Pasuruan', 
  autoOpenUlasan = false,
  userLatitude, 
  userLongitude
}) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showUlasanModal, setShowUlasanModal] = useState(false);
  const [ulasanList, setUlasanList] = useState([]);
  const [loadingUlasan, setLoadingUlasan] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [jarakKePenjual, setJarakKePenjual] = useState(null);


  const isOwner = userId && product?.user_id === userId;
  

  const formatRupiah = (harga) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);

  // Perhitungan Rating Rata-rata
  const averageRating = useMemo(() => {
    if (!ulasanList || ulasanList.length === 0) return "0.0";
    const total = ulasanList.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    return (total / ulasanList.length).toFixed(1);
  }, [ulasanList]);

  // Logika WhatsApp Chat
  const handleChat = () => {
    const phoneNumber = product?.penjual_phone;
    if (!phoneNumber) return alert('Nomor WhatsApp tidak tersedia');
    let cleanPhone = phoneNumber.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    window.open(`https://wa.me/${cleanPhone}?text=Halo Cak, saya tertarik dengan ${product.nama_barang}`, '_blank');
  };

  // Logika Share
  const handleShareToWA = () => {
    if (!product) return;
    const shareUrl = `${window.location.origin}/panyangan?product=${product.id}`;
    const message = `*${product.nama_barang}*\n\n💰 Harga: ${formatRupiah(product.harga)}\n📍 Lokasi: ${product.penjual_desa || locationName}\n✨ Cek Barang: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Fetch Ulasan dengan Join ke tabel Profiles
  const fetchUlasan = useCallback(async () => {
    if (!product?.id) return;
    setLoadingUlasan(true);
    try {
      const { data, error } = await supabase
        .from('ulasan')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('produk_id', product.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) setUlasanList(data);
    } catch (err) {
      console.error("Error fetching ulasan:", err);
    } finally {
      setLoadingUlasan(false);
    }
  }, [product?.id]);

  // Validasi apakah user sudah pernah beli (untuk syarat kasih ulasan)
  const checkUserPurchase = useCallback(async () => {
    if (!userId || !product?.id) return;
    try {
      const { data } = await supabase
        .from('pesanan')
        .select('id')
        .eq('pembeli_id', userId)
        .eq('produk_id', product.id)
        .eq('status', 'selesai')
        .maybeSingle();
      setHasPurchased(!!data);
    } catch (err) {
      console.error("Error checking purchase:", err);
    }
  }, [userId, product?.id]);

  const handleBalasUlasan = async (ulasanId) => {
  if (!isOwner) return;

  const balasan = prompt("Halo Bakul, masukkan balasan sampeyan:");
  
  if (!balasan || balasan.trim() === "") return;

  try {
    const { error } = await supabase
      .from('ulasan')
      .update({ 
        balasan_penjual: balasan,
        dibalas_pada: new Date().toISOString() // Mengisi kolom dibalas_pada secara otomatis
      })
      .eq('id', ulasanId);

    if (error) throw error;
    
    alert('✅ Balasan berhasil dikirim!');
    fetchUlasan(); // Refresh daftar ulasan agar langsung muncul
  } catch (err) {
    alert('Gagal ngirim balasan, Cak: ' + err.message);
  }
};

  useEffect(() => {
    if (isOpen && product) {
      fetchUlasan();
      if (userId) checkUserPurchase();
      if (autoOpenUlasan) setShowUlasanModal(true);
      
      if (userLatitude && userLongitude && product.penjual_lat && product.penjual_lng) {
        const jarak = hitungJarak(userLatitude, userLongitude, product.penjual_lat, product.penjual_lng);
        setJarakKePenjual(jarak);
      }
    }
  }, [isOpen, userId, autoOpenUlasan, fetchUlasan, checkUserPurchase, userLatitude, userLongitude, product]);

  if (!isOpen || !product) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-stone-50 overflow-y-auto max-w-[420px] mx-auto shadow-2xl font-sans animate-in fade-in duration-300">
        
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 max-w-[450px] mx-auto z-50 flex items-center justify-between p-4 pointer-events-none">
          <button onClick={onClose} className="p-2.5 bg-white/90 backdrop-blur-xl rounded-xl shadow-sm text-stone-800 pointer-events-auto active:scale-90 transition-all border border-stone-100">
            <ArrowLeft size={18} />
          </button>
          <button onClick={handleShareToWA} className="p-2.5 bg-emerald-500 rounded-xl shadow-lg text-white pointer-events-auto active:scale-90 transition-all border border-emerald-400">
            <Share2 size={18} />
          </button>
        </nav>

        <main className="pb-32">
          {/* Header Image */}
          <div className="p-3 pt-16">
            <div className="relative h-[320px] rounded-[32px] overflow-hidden shadow-xl ring-4 ring-white">
              {product.foto_url?.[0] ? (
                <img src={product.foto_url[0]} alt={product.nama_barang} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-400"><Package size={40} /></div>
              )}
              
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-white/80 backdrop-blur-md p-3 rounded-[20px] border border-white/50 flex justify-between items-center shadow-md">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase font-black tracking-widest text-stone-500 mb-0.5 truncate">
                      {jarakKePenjual !== null ? `📍 ${formatJarak(jarakKePenjual)} dari Anda` : `Lokal ${product.penjual_desa || locationName}`}
                    </p>
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {jarakKePenjual !== null && jarakKePenjual <= 1 ? '🏠 Tetangga Dekat!' : '👋 Produk Warga'}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex-shrink-0 ${product.stok_ready ? 'bg-emerald-500 text-white' : 'bg-stone-400 text-white'}`}>
                    {product.stok_ready ? 'Ready' : 'Habis'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <section className="px-5 py-2">
            <div className="flex justify-between items-start mb-3 gap-2">
              <h1 className="text-xl font-bold text-stone-900 leading-tight flex-1">{product.nama_barang}</h1>
              <div className="bg-orange-50 p-1.5 rounded-lg text-orange-500 flex-shrink-0"><Sparkles size={16} /></div>
            </div>

            <div className="flex items-center gap-2 mb-6">
               <div className="flex bg-yellow-400/10 px-1.5 py-0.5 rounded-md items-center gap-1">
                  <Star size={12} fill="#facc15" className="text-yellow-400" />
                  <span className="text-[11px] font-black text-yellow-700">{averageRating}</span>
               </div>
               <span className="text-stone-400 text-[11px] font-medium">{ulasanList.length} Ulasan Tetangga</span>
            </div>

            <div className="bg-stone-900 rounded-[24px] p-4 text-white flex justify-between items-center shadow-lg">
              <div>
                <p className="text-stone-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Harga Terbaik</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black">{formatRupiah(product.harga)}</span>
                  <span className="text-stone-500 font-medium text-[10px]">/ {product.satuan || 'Pcs'}</span>
                </div>
              </div>
              <button onClick={() => setShowOrderModal(true)} className="bg-white text-stone-900 h-10 px-5 rounded-xl font-black text-[11px] active:scale-95 transition-transform">
                BELI
              </button>
            </div>
          </section>

          {/* Bento Details */}
<section className="px-5 mt-6 grid grid-cols-2 gap-3">
  <div className="col-span-2 bg-white p-4 rounded-[24px] border border-stone-100 shadow-sm">
    <div className="flex items-center gap-2 mb-2 text-stone-800">
      <Info size={16} className="text-orange-500" />
      <span className="font-bold text-xs">Cerita Produk</span>
    </div>
    <p className="text-stone-500 text-xs leading-relaxed italic">"{product.deskripsi || 'Kualitas asli warga lokal.'}"</p>
  </div>

  {/* BAGIAN BAKUL - DENGAN FOTO GMAIL */}
  <div className="bg-emerald-50 p-4 rounded-[24px] border border-emerald-100 min-w-0">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-emerald-200">
        {product.penjual_foto ? (
          <img 
            src={product.penjual_foto} 
            alt={product.display_name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-emerald-600">
            <User size={12} />
          </div>
        )}
      </div>
      <p className="text-[9px] font-bold text-emerald-800/50 uppercase">Bakul</p>
    </div>
    <p className="text-xs font-bold text-emerald-900 truncate">
      {product.display_name || 'Warga'} {/* Gunakan display_name sesuai logic grid */}
    </p>
  </div>

  <div className="bg-orange-50 p-4 rounded-[24px] border border-orange-100 min-w-0">
    <MapPin size={16} className="text-orange-600 mb-2" />
    <p className="text-[9px] font-bold text-orange-800/50 uppercase">Lokasi</p>
    <p className="text-xs font-bold text-orange-900 truncate">{product.penjual_desa || 'Desa'}</p>
  </div>
</section>

          {/* Section Ulasan */}
          <section id="kata-tetangga" className="px-5 mt-8">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-black text-stone-900 italic">Kata Tetangga</h3>
               {hasPurchased && (
                 <button onClick={() => setShowUlasanModal(true)} className="text-[10px] font-bold text-orange-600 bg-white px-3 py-1.5 rounded-lg border border-stone-200 active:scale-95 transition-all">
                   Tulis Kesan
                 </button>
               )}
            </div>
            
            <div className="space-y-3">
              {loadingUlasan ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-stone-200 border-t-orange-500 rounded-full animate-spin"></div></div>
              ) : ulasanList.length === 0 ? (
                <p className="text-stone-400 text-[11px] italic text-center py-8 bg-white rounded-[24px] border border-dashed border-stone-200">Belum ada ulasan dari tetangga.</p>
              ) : (
                ulasanList.slice(0, 5).map((u) => (
                  <div key={u.id} className="bg-white p-4 rounded-[24px] border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-stone-100 border border-stone-200 flex-shrink-0">
                        {u.profiles?.avatar_url ? (
                          <img 
                            src={u.profiles.avatar_url} 
                            alt={u.profiles.full_name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400"><User size={14} /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[12px] text-stone-900 truncate mr-2">
                            {u.profiles?.full_name || u.nama_pembeli || 'Tetangga'}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Star size={10} fill="#facc15" className="text-yellow-400" />
                            <span className="text-yellow-600 font-black text-[10px]">{u.rating}</span>
                          </div>
                        </div>
                        <p className="text-stone-400 text-[9px]">
                          {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • Terverifikasi
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-stone-600 text-[11px] leading-relaxed pl-1 italic">"{u.komentar}"</p>

                    {u.foto_ulasan && u.foto_ulasan.length > 0 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                        {u.foto_ulasan.map((img, idx) => (
                          <img key={idx} src={img} alt="Ulasan" className="w-14 h-14 rounded-xl object-cover border border-stone-100 flex-shrink-0" />
                        ))}
                      </div>
                    )}

                    {/* TAMPILAN BALASAN PENJUAL */}
{u.balasan_penjual ? (
  <div className="mt-3 p-3 bg-orange-50 rounded-2xl border-l-4 border-orange-400 ml-2 shadow-sm transition-all animate-in slide-in-from-left-2">
    <div className="flex justify-between items-center mb-1.5">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
        <p className="text-[10px] font-black text-orange-900 uppercase tracking-tighter">Balasan Bakul</p>
      </div>
      
      {/* Tambahan: Menampilkan kapan dibalas */}
      {u.dibalas_pada && (
        <span className="text-[8px] font-bold text-orange-400/70 uppercase">
          {new Date(u.dibalas_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
    
    <p className="text-[11px] text-orange-800 leading-relaxed italic">
      "{u.balasan_penjual}"
    </p>
  </div>
) : (
  /* TOMBOL BALAS (Hanya muncul jika user adalah pemilik produk) */
  isOwner && (
    <button 
      onClick={() => handleBalasUlasan(u.id)}
      className="mt-3 flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 hover:border-orange-200 hover:bg-orange-50 text-stone-600 hover:text-orange-600 rounded-xl transition-all active:scale-95 shadow-sm"
    >
      <MessageCircle size={12} className="text-orange-500" />
      <span className="text-[10px] font-black uppercase tracking-tight">Balas Ulasan</span>
    </button>
  )
)}
</div>
                ))
              )}
            </div>
          </section>
        </main>

        {/* Floating Action Footer */}
        <footer className="fixed bottom-4 left-4 right-4 max-w-[418px] mx-auto z-[70]">
          <div className="bg-white/80 backdrop-blur-2xl p-2.5 rounded-[24px] shadow-2xl border border-white flex gap-2 ring-1 ring-black/5">
            <button onClick={handleChat} className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all flex-shrink-0">
              <MessageCircle size={20} />
            </button>
            <button 
              disabled={!product.stok_ready}
              onClick={() => setShowOrderModal(true)}
              className={`flex-1 rounded-xl font-bold text-[11px] tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 ${product.stok_ready ? 'bg-stone-900 text-white shadow-xl' : 'bg-stone-200 text-stone-400'}`}
            >
              <ShoppingBag size={16} />
              {product.stok_ready ? 'AMBIL SEKARANG' : 'STOK HABIS'}
            </button>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {showOrderModal && <OrderModal isOpen={showOrderModal} onClose={() => setShowOrderModal(false)} product={product} userId={userId} onOrderSuccess={onOrderSuccess} onCloseParent={onClose} />}
      {showUlasanModal && <UlasanModal isOpen={showUlasanModal} onClose={() => setShowUlasanModal(false)} product={product} userId={userId} onSuccess={fetchUlasan} />}
    </>
  );
}