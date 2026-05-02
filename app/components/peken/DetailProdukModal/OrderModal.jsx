'use client';

import React, { useState, useEffect } from 'react';
import { 
  Minus, Plus, Truck, MapPin, ShoppingBag, ArrowLeft, 
  Package, RefreshCw, Navigation, Edit2, CheckCircle,
  User, Phone, Clock, Compass, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function OrderModal({ isOpen, onClose, product, userId, onOrderSuccess, onCloseParent }) {
  const [loading, setLoading] = useState(false);
  const [shippingMethod, setShippingMethod] = useState('pickup');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [errorLoad, setErrorLoad] = useState(null);
  
  const [realDistance, setRealDistance] = useState(null);
  const [distance, setDistance] = useState(1);
  const [ongkirOjek, setOngkirOjek] = useState(5000);
  
  const [orderForm, setOrderForm] = useState({ 
    jumlah: 1, 
    catatan: '', 
    alamat_pengiriman: '',
    recipient_name: '',
    recipient_phone: ''
  });

  // Ambil data user dari tabel profiles
  const fetchUserData = async () => {
    if (!userId) {
      console.log("Tidak ada userId");
      return;
    }
    
    setIsLoadingUserData(true);
    setErrorLoad(null);
    
    try {
      console.log("Fetching user data for ID:", userId);
      
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('full_name, phone, alamat, latitude, longitude, desa, kecamatan, kabupaten')
        .eq('id', userId)
        .maybeSingle(); // Gunakan maybeSingle() instead of single() untuk menghindari error jika tidak ada data

      if (error) {
        console.error("Error fetch user:", error);
        setErrorLoad(error.message);
        throw error;
      }

      if (userData) {
        console.log("User data found:", userData);
        
        // Format alamat lengkap dari komponen yang ada
        let fullAddress = userData.alamat || '';
        if (userData.desa) fullAddress += `${fullAddress ? ', ' : ''}${userData.desa}`;
        if (userData.kecamatan) fullAddress += `${fullAddress ? ', ' : ''}${userData.kecamatan}`;
        if (userData.kabupaten) fullAddress += `${fullAddress ? ', ' : ''}${userData.kabupaten}`;
        
        setOrderForm(prev => ({
          ...prev,
          alamat_pengiriman: fullAddress || userData.alamat || '',
          recipient_name: userData.full_name || '',
          recipient_phone: userData.phone || ''
        }));

        // Hitung jarak jika ada koordinat
        if (userData.latitude && userData.longitude && product.penjual_lat && product.penjual_lon) {
          const d = calculateDistance(
            parseFloat(userData.latitude), 
            parseFloat(userData.longitude), 
            parseFloat(product.penjual_lat), 
            parseFloat(product.penjual_lon)
          );
          setRealDistance(d);
          setDistance(Math.max(d, 0.5));
        } else {
          console.log("Tidak ada koordinat untuk hitung jarak");
          setRealDistance(1);
        }
      } else {
        console.log("No user data found for ID:", userId);
        setErrorLoad("Data profil tidak ditemukan");
      }
    } catch (err) {
      console.error("Gagal ambil data user:", err);
      setErrorLoad(err.message);
    } finally {
      setIsLoadingUserData(false);
    }
  };

  const maskPhoneNumber = (phone) => {
  if (!phone) return '-';
  const str = phone.toString();
  if (str.length <= 6) return str;
  
  // Tampilkan 4 digit awal dan 3 digit akhir
  const start = str.slice(0, 4);
  const end = str.slice(-3);
  const starsCount = str.length - 7;
  const stars = '*'.repeat(Math.min(starsCount, 6));
  
  return `${start}${stars}${end}`;
};

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 1;
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  // Simpan perubahan ke database
  const saveChanges = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          alamat: orderForm.alamat_pengiriman,
          full_name: orderForm.recipient_name,
          phone: orderForm.recipient_phone
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      alert('✅ Data berhasil disimpan');
      setIsEditing(false);
      
      // Refresh data
      await fetchUserData();
    } catch (err) {
      alert('❌ Gagal simpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserData();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (shippingMethod === 'ojek') {
      setOngkirOjek(Math.max(distance * 2500, 5000));
    } else { 
      setOngkirOjek(0); 
    }
  }, [distance, shippingMethod]);

  const handleSubmitOrder = async () => {
    if (!userId) return alert('Login dulu, Cak!');
    if (shippingMethod === 'ojek' && !orderForm.alamat_pengiriman) return alert('Alamat harus diisi!');

    setLoading(true);
    try {
      const totalBayar = (product.harga * orderForm.jumlah) + ongkirOjek;
      
      const { error } = await supabase.from('pesanan').insert({
        produk_id: product.id,
        pembeli_id: userId,
        penjual_id: product.user_id,
        jumlah: orderForm.jumlah,
        total_harga: totalBayar,
        ongkir: ongkirOjek,
        catatan: orderForm.catatan,
        status: 'menunggu',
        alamat_pengiriman: shippingMethod === 'ojek' ? orderForm.alamat_pengiriman : 'Ambil di tempat',
        penerima_nama: orderForm.recipient_name,
        penerima_hp: orderForm.recipient_phone,
        jarak_tempuh: shippingMethod === 'ojek' ? distance : null,
      });

      if (error) throw error;
      
      alert('✅ Pesanan berhasil dikirim!');
      onOrderSuccess?.();
      onClose();
      onCloseParent?.();
    } catch (err) {
      alert('❌ Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatRupiah = (h) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(h || 0);

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[420px] max-h-[95vh] overflow-y-auto rounded-t-[32px]">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 pt-3 pb-2 border-b border-stone-50">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-2" />
          <div className="flex justify-between items-center px-6">
            <button onClick={onClose} className="p-1 text-stone-400"><ArrowLeft size={22} /></button>
            <span className="font-black text-[10px] uppercase tracking-widest text-stone-400">Checkout</span>
            <div className="w-8" />
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Ringkasan Produk */}
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <img src={product.foto_url?.[0]} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt="" />
            <div className="flex-1 min-w-0 text-stone-800">
              <p className="font-bold text-xs truncate">{product.nama_barang}</p>
              <p className="text-[11px] font-black text-orange-600">{formatRupiah(product.harga)}</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-stone-200">
              <button onClick={() => setOrderForm(p => ({...p, jumlah: Math.max(1, p.jumlah - 1)}))}><Minus size={14} /></button>
              <span className="font-black text-sm">{orderForm.jumlah}</span>
              <button onClick={() => setOrderForm(p => ({...p, jumlah: p.jumlah + 1}))} className="text-orange-600"><Plus size={14} /></button>
            </div>
          </div>

          {/* Metode Pengiriman */}
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShippingMethod('pickup')} 
              className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${
                shippingMethod === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-stone-100'
              }`}
            >
              <MapPin size={16} className={shippingMethod === 'pickup' ? 'text-orange-500' : 'text-stone-300'} />
              <span className={`text-[10px] font-black uppercase ${shippingMethod === 'pickup' ? 'text-orange-900' : 'text-stone-500'}`}>
                Ambil di Tempat
              </span>
            </button>
            <button 
              onClick={() => setShippingMethod('ojek')} 
              className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${
                shippingMethod === 'ojek' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-100'
              }`}
            >
              <Truck size={16} className={shippingMethod === 'ojek' ? 'text-emerald-500' : 'text-stone-300'} />
              <span className={`text-[10px] font-black uppercase ${shippingMethod === 'ojek' ? 'text-emerald-900' : 'text-stone-500'}`}>
                Antar Ojek
              </span>
            </button>
          </div>

          {/* Detail Pengiriman untuk Ojek */}
          {shippingMethod === 'ojek' && (
            <div className="space-y-3">
              {/* Kartu Data Pengiriman */}
              <div className="p-4 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-[28px] text-white shadow-lg">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Navigation size={14} className="opacity-80" />
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-80">
                      Data Pengiriman
                    </label>
                  </div>
                  <button 
                    onClick={() => setIsEditing(!isEditing)} 
                    className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition"
                    disabled={isLoadingUserData}
                  >
                    {isEditing ? <CheckCircle size={12} /> : <Edit2 size={12} />}
                  </button>
                </div>

                {isLoadingUserData ? (
                  <div className="flex items-center justify-center gap-2 p-4">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-xs">Memuat data profil...</span>
                  </div>
                ) : errorLoad ? (
                  <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-xl">
                    <AlertCircle size={14} className="shrink-0" />
                    <p className="text-[10px]">Gagal memuat data: {errorLoad}</p>
                  </div>
                ) : isEditing ? (
                  // Mode Edit
                  <div className="space-y-3">
                    <div>
                      <label className="text-[8px] opacity-70 block mb-1">ALAMAT LENGKAP</label>
                      <textarea 
                        className="w-full p-2 bg-white/10 rounded-xl text-xs border border-white/20 outline-none focus:border-white/40"
                        rows={3} 
                        value={orderForm.alamat_pengiriman}
                        onChange={(e) => setOrderForm(p => ({...p, alamat_pengiriman: e.target.value}))}
                        placeholder="Jalan, gang, nomor rumah, RT/RW, kelurahan, kecamatan, kota"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] opacity-70 block mb-1">NAMA PENERIMA</label>
                      <input 
                        type="text"
                        className="w-full p-2 bg-white/10 rounded-xl text-xs border border-white/20 outline-none focus:border-white/40"
                        value={orderForm.recipient_name}
                        onChange={(e) => setOrderForm(p => ({...p, recipient_name: e.target.value}))}
                        placeholder="Nama lengkap penerima"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] opacity-70 block mb-1">NO. HP PENERIMA</label>
                      <input 
                        type="tel"
                        className="w-full p-2 bg-white/10 rounded-xl text-xs border border-white/20 outline-none focus:border-white/40"
                        value={orderForm.recipient_phone}
                        onChange={(e) => setOrderForm(p => ({...p, recipient_phone: e.target.value}))}
                        placeholder="Nomor WhatsApp/telepon aktif"
                      />
                    </div>
                    <button 
                      onClick={saveChanges}
                      disabled={loading}
                      className="w-full mt-2 p-2 bg-emerald-500 rounded-xl text-xs font-bold hover:bg-emerald-400 transition disabled:opacity-50"
                    >
                      {loading ? <RefreshCw size={12} className="animate-spin inline" /> : 'SIMPAN PERUBAHAN'}
                    </button>
                  </div>
                ) : (
                  // Mode Tampil
                  <div className="space-y-2">
                    <div className="p-2 bg-black/20 rounded-xl">
                      <div className="flex items-start gap-2">
                        <MapPin size={12} className="text-emerald-300 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-medium leading-relaxed">
                          {orderForm.alamat_pengiriman || "Belum ada alamat"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 px-1">
                      <div className="flex-1 flex items-center gap-1">
                        <User size={10} className="opacity-60" />
                        <span className="text-[10px] font-medium">{orderForm.recipient_name || "-"}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <Phone size={10} className="opacity-60" />
                         <span className="text-[10px] font-medium">{maskPhoneNumber(orderForm.recipient_phone) || "-"}</span>
                      </div>
                    </div>
                    <div className="text-[8px] opacity-50 text-center pt-1">
                      Klik pojok kanan atas untuk mengubah alamat pengiriman
                    </div>
                  </div>
                )}

                {/* Informasi Jarak */}
                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1">
                      <Compass size={10} className="opacity-70" />
                      <span className="text-[9px] font-bold opacity-70">JARAK TEMPUH</span>
                    </div>
                    <span className="text-xs font-bold">{distance} KM</span>
                  </div>
                  <input 
                    type="range" 
                    min={realDistance || 0.5} 
                    max="15" 
                    step="0.5" 
                    value={distance} 
                    onChange={(e) => setDistance(parseFloat(e.target.value))} 
                    className="w-full h-1 accent-white rounded-full"
                    disabled={!realDistance}
                  />
                  <p className="text-[8px] opacity-50 mt-1 text-center">
                    Ongkos Kirim: {formatRupiah(ongkirOjek)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Catatan Umum */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package size={12} className="text-stone-400" />
              <span className="text-[9px] font-black text-stone-500 uppercase">Catatan untuk Penjual</span>
            </div>
            <textarea 
              className="w-full p-3 bg-stone-50 rounded-xl text-xs border border-stone-200 outline-none focus:border-orange-400" 
              rows={2} 
              placeholder="Contoh: Tolong dibungkus rapi, warna hitam, dll..."
              value={orderForm.catatan}
              onChange={(e) => setOrderForm(p => ({...p, catatan: e.target.value}))}
            />
          </div>

          {/* Tombol Pesan */}
          <div className="sticky bottom-4">
            <div className="p-4 bg-stone-900 rounded-[28px] text-white shadow-xl">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-bold text-white/40 uppercase">Total Bayar</p>
                  <p className="text-xl font-black text-orange-500">
                    {formatRupiah((product.harga * orderForm.jumlah) + ongkirOjek)}
                  </p>
                  <div className="flex gap-3 text-[8px] text-white/30 mt-1">
                    <span>Subtotal: {formatRupiah(product.harga * orderForm.jumlah)}</span>
                    {shippingMethod === 'ojek' && <span>+ Ongkir: {formatRupiah(ongkirOjek)}</span>}
                  </div>
                </div>
                <button 
                  onClick={handleSubmitOrder}
                  disabled={loading || isLoadingUserData || (shippingMethod === 'ojek' && !orderForm.alamat_pengiriman)}
                  className={`bg-orange-600 h-12 px-8 rounded-2xl font-black text-sm active:scale-95 flex items-center gap-2 transition-all ${
                    (loading || isLoadingUserData || (shippingMethod === 'ojek' && !orderForm.alamat_pengiriman))
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-orange-500'
                  }`}
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShoppingBag size={18} fill="currentColor" />}
                  {loading ? 'Memproses...' : 'PESAN SEKARANG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}