'use client';

import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, Truck, MapPin, ShoppingBag, ArrowLeft, Package, RefreshCw, Info, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function OrderModal({ isOpen, onClose, product, userId, onOrderSuccess, onCloseParent }) {
  const [loading, setLoading] = useState(false);
  const [shippingMethod, setShippingMethod] = useState('pickup');
  
  // State Jarak & Lokasi
  const [realDistance, setRealDistance] = useState(null); // Jarak asli GPS
  const [distance, setDistance] = useState(1); // Jarak pilihan slider
  const [ongkirOjek, setOngkirOjek] = useState(5000);
  const [orderForm, setOrderForm] = useState({ jumlah: 1, catatan: '', alamat_pengiriman: '' });

  // Fungsi Hitung Jarak Garis Lurus (Haversine Formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius bumi dalam KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  // Ambil Lokasi Pembeli & Penjual Saat Ini
  useEffect(() => {
    if (isOpen && shippingMethod === 'ojek' && !realDistance) {
      // Ambil posisi user
      navigator.geolocation.getCurrentPosition((pos) => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;

        // Ambil Lat/Lon Penjual dari data produk
        const sellerLat = product.penjual_lat || product.profiles?.latitude;
        const sellerLon = product.penjual_lon || product.profiles?.longitude;

        if (sellerLat && sellerLon) {
          const d = calculateDistance(userLat, userLon, sellerLat, sellerLon);
          setRealDistance(d);
          setDistance(Math.max(d, 0.5)); // Set slider minimal sesuai jarak GPS
        }
      }, (error) => {
        console.error('Error getting location:', error);
        setRealDistance(1); // fallback jika gagal
      });
    }
  }, [isOpen, shippingMethod, product, realDistance]);

  // Hitung Ongkir Otomatis (Rp 2.500/km, Min Rp 5.000)
  useEffect(() => {
    if (shippingMethod === 'ojek') {
      const hitung = distance * 2500;
      setOngkirOjek(Math.max(hitung, 5000));
    } else {
      setOngkirOjek(0);
    }
  }, [distance, shippingMethod]);

  if (!isOpen) return null;

  const formatRupiah = (harga) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga || 0);

  const handleSubmitOrder = async () => {
    if (!userId) return alert('Login dulu, Cak!');
    if (shippingMethod === 'ojek' && !orderForm.alamat_pengiriman) return alert('Alamat kirim diisi dulu.');
    
    // Validasi jarak pilihan tidak lebih kecil dari jarak GPS
    if (shippingMethod === 'ojek' && realDistance && distance < realDistance) {
      return alert(`⚠️ Jarak pilihan (${distance} KM) lebih kecil dari jarak sebenarnya (${realDistance} KM). Silakan sesuaikan.`);
    }

    setLoading(true);
    try {
      const totalBayar = (product.harga * orderForm.jumlah) + ongkirOjek;
      
      const { error } = await supabase.from('pesanan').insert({
        produk_id: product.id,
        pembeli_id: userId,
        penjual_id: product.user_id,
        jumlah: orderForm.jumlah,
        total_harga: totalBayar,
        ongkir: shippingMethod === 'ojek' ? ongkirOjek : 0,
        estimated_jarak: shippingMethod === 'ojek' ? distance : null,
        estimated_jarak_real: shippingMethod === 'ojek' ? realDistance : null, // simpan jarak asli GPS
        catatan: orderForm.catatan,
        status: 'menunggu',
        shipping_method: shippingMethod,
        alamat_pengiriman: shippingMethod === 'ojek' ? orderForm.alamat_pengiriman : 'Ambil di tempat',
      });
      
      if (error) throw error;
      
      // Kirim notifikasi ke penjual (opsional)
      if (shippingMethod === 'ojek' && product.penjual_phone) {
        const waMsg = `*PESANAN BARU*%0AProduk: ${product.nama_barang}%0AJumlah: ${orderForm.jumlah}%0AJarak: ${distance} KM (GPS: ${realDistance} KM)%0AOngkir: ${formatRupiah(ongkirOjek)}%0AAlamat: ${orderForm.alamat_pengiriman}`;
        window.open(`https://wa.me/${product.penjual_phone}?text=${waMsg}`, '_blank');
      }
      
      alert('✅ Pesanan Berhasil!');
      onOrderSuccess?.();
      onClose();
      onCloseParent?.();
    } catch (err) {
      alert('❌ Gagal: ' + err.message);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[420px] max-h-[95vh] overflow-y-auto rounded-t-[32px] animate-in slide-in-from-bottom duration-300">
        
        {/* Handle Bar & Close */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 pt-3 pb-2 border-b border-stone-50">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-6">
            <button onClick={onClose} className="p-1 text-stone-400"><ArrowLeft size={22} /></button>
            <span className="font-black text-sm uppercase tracking-widest text-stone-800">Checkout</span>
            <div className="w-8" />
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Ringkasan Ringkas */}
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
            {product.foto_url?.[0] ? (
              <img src={product.foto_url[0]} className="w-12 h-12 rounded-xl object-cover" alt="" />
            ) : (
              <div className="w-12 h-12 bg-stone-200 rounded-xl flex items-center justify-center">
                <Package size={20} className="text-stone-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-stone-800 truncate">{product.nama_barang}</p>
              <p className="text-xs font-black text-orange-600">{formatRupiah(product.harga)}</p>
            </div>
            {/* Stepper Jumlah */}
            <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-stone-200">
              <button onClick={() => setOrderForm(p => ({...p, jumlah: Math.max(1, p.jumlah - 1)}))}><Minus size={14} /></button>
              <span className="font-black text-sm">{orderForm.jumlah}</span>
              <button onClick={() => setOrderForm(p => ({...p, jumlah: p.jumlah + 1}))}><Plus size={14} /></button>
            </div>
          </div>

          {/* Opsi Kirim */}
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShippingMethod('pickup')}
              className={`p-3 rounded-2xl border-2 flex items-center gap-2 transition-all ${shippingMethod === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-stone-100'}`}
            >
              <MapPin size={16} className={shippingMethod === 'pickup' ? 'text-orange-500' : 'text-stone-300'} />
              <span className={`text-[11px] font-black ${shippingMethod === 'pickup' ? 'text-orange-900' : 'text-stone-500'}`}>Ambil Sendiri</span>
            </button>
            <button 
              onClick={() => setShippingMethod('ojek')}
              className={`p-3 rounded-2xl border-2 flex items-center gap-2 transition-all ${shippingMethod === 'ojek' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-100'}`}
            >
              <Truck size={16} className={shippingMethod === 'ojek' ? 'text-emerald-500' : 'text-stone-300'} />
              <span className={`text-[11px] font-black ${shippingMethod === 'ojek' ? 'text-emerald-900' : 'text-stone-500'}`}>Ojek Warga</span>
            </button>
          </div>

          {/* Input Ojek dengan GPS Detection */}
          {shippingMethod === 'ojek' && (
            <div className="p-4 bg-emerald-600 rounded-[24px] text-white space-y-4 animate-in fade-in slide-in-from-top-2">
              {/* Tombol kembali ke Ambil Sendiri */}
              <button 
                onClick={() => setShippingMethod('pickup')}
                className="text-[9px] font-bold text-white/80 flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full self-start"
              >
                <ArrowLeft size={10} /> Ganti Ambil Sendiri
              </button>
              
              <textarea 
                placeholder="Alamat Lengkap (RT/RW/Patokan)..."
                className="w-full p-3 bg-white/10 rounded-xl text-xs placeholder:text-white/50 border border-white/10 outline-none focus:bg-white/20 transition-all"
                rows={2}
                value={orderForm.alamat_pengiriman}
                onChange={(e) => setOrderForm(p => ({...p, alamat_pengiriman: e.target.value}))}
              />
              
              {/* GPS Detection Card */}
              <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Navigation size={14} className="text-emerald-300" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Deteksi Jarak GPS</span>
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {realDistance ? `${realDistance} KM` : 'Mencari...'}
                  </span>
                </div>
                <p className="text-[8px] text-white/70 leading-tight">
                  Jarak garis lurus dari lokasi Anda ke penjual.
                </p>
              </div>
              
              <div className="bg-black/10 p-3 rounded-xl">
                <div className="flex justify-between text-[10px] font-bold mb-2 uppercase">
                  <span>📏 Pilih Jarak Tempuh</span>
                  <span>{distance} KM</span>
                </div>
                <input 
                  type="range" 
                  min={realDistance ? Math.max(realDistance, 0.5) : 0.5} 
                  max="15" 
                  step="0.5" 
                  value={distance}
                  onChange={(e) => setDistance(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                />
                <div className="flex justify-between mt-2 text-[9px] opacity-60 font-bold">
                  <span>🏠 Dekat</span>
                  <span>🏞️ Jauh</span>
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t border-white/20">
                  <span className="text-[10px] font-bold text-white/80">💰 Ongkos Kirim:</span>
                  <span className="text-[11px] font-black text-white">{formatRupiah(ongkirOjek)}</span>
                </div>
                <p className="text-[8px] text-white/50 text-center mt-2">*Rp 2.500/km • Minimal Rp 5.000</p>
              </div>

              {/* Peringatan jika jarak pilihan kurang dari jarak real */}
              {realDistance && distance < realDistance && (
                <div className="flex gap-2 p-2 bg-red-500/30 rounded-xl border border-red-500/50">
                  <Info size={14} className="text-red-200 shrink-0" />
                  <p className="text-[8px] text-red-100">
                    ⚠️ Jarak pilihan ({distance} KM) lebih kecil dari jarak GPS ({realDistance} KM). Silakan sesuaikan!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Catatan */}
          <input 
            type="text" 
            placeholder="📝 Catatan (opsional)..."
            className="w-full p-3 bg-stone-50 rounded-xl text-xs outline-none border border-transparent focus:border-stone-200 transition-all"
            onChange={(e) => setOrderForm(p => ({...p, catatan: e.target.value}))}
          />

          {/* Ringkasan & Tombol */}
          <div className="p-5 bg-stone-900 rounded-[28px] text-white">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Total Pembayaran</p>
                <p className="text-xl font-black text-orange-500 tracking-tight">
                  {formatRupiah((product.harga * orderForm.jumlah) + ongkirOjek)}
                </p>
                {shippingMethod === 'ojek' && (
                  <p className="text-[8px] text-white/30 mt-1">Termasuk ongkir {formatRupiah(ongkirOjek)}</p>
                )}
              </div>
              <button 
                onClick={handleSubmitOrder}
                disabled={loading || (shippingMethod === 'ojek' && realDistance && distance < realDistance)}
                className="bg-orange-600 h-12 px-6 rounded-xl font-black text-sm active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-orange-900/20"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
                {loading ? 'Memproses...' : 'PESAN'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}