'use client';

import React, { useState, useEffect } from 'react';
import { X, Store, Phone, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function FormDaftarBakul({ isOpen, onClose, user, profile, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    alamat: profile?.alamat || '',
    desa: profile?.desa || '',
    kecamatan: profile?.kecamatan || '',
    kabupaten: profile?.kabupaten || '',
    toko_name: '',
    toko_desc: '',
    latitude: profile?.latitude || null, // Tambahkan ini
    longitude: profile?.longitude || null // Tambahkan ini
  });

  useEffect(() => {
    if (isOpen && profile) {
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        alamat: profile.alamat || '',
        desa: profile.desa || '',
        kecamatan: profile.kecamatan || '',
        kabupaten: profile.kabupaten || '',
        latitude: profile.latitude || null,
        longitude: profile.longitude || null,
      }));
    }
  }, [isOpen, profile]);

  // FUNGSI AMBIL LOKASI (GPS)
  const getLocation = () => {
    setDetectingLocation(true);
    if (!navigator.geolocation) {
      alert("Browser sampeyan gak dukung GPS, Cak.");
      setDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setDetectingLocation(false);
      },
      (error) => {
        alert("Gagal ambil lokasi. Pastikan izin lokasi aktif.");
        setDetectingLocation(false);
      }
    );
  };

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.toko_name) { alert("Nama toko wajib diisi!"); return; }
    if (!formData.latitude) { alert("Titik lokasi wajib diambil supaya fitur jarak muncul!"); return; }

    setLoading(true);
    try {
      // 1. Update Profiles (Termasuk Koordinat)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          alamat: formData.alamat,
          desa: formData.desa,
          kecamatan: formData.kecamatan,
          kabupaten: formData.kabupaten,
          latitude: formData.latitude, // WAJIB MASUK
          longitude: formData.longitude, // WAJIB MASUK
          is_seller: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // 2. Insert ke Pendaftar Bakul
      const { error: insertError } = await supabase
        .from("pendaftar_bakul")
        .insert({
          user_id: user?.id,
          toko_name: formData.toko_name,
          toko_desc: formData.toko_desc,
          alamat: formData.alamat,
          desa: formData.desa,
          kecamatan: formData.kecamatan,
          kabupaten: formData.kabupaten,
          status: "aktif"
        });

      if (insertError) throw insertError;

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert('Gagal mendaftar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- UI RENDER (SUBMITTED) ---
  if (submitted) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-[40px] w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Berhasil Jadi Bakul!</h3>
          <p className="text-[11px] text-slate-500 mt-3 font-medium">Sekarang fitur jarak otomatis aktif di setiap jualan sampeyan.</p>
          <button onClick={() => { setSubmitted(false); onClose(); }} className="w-full mt-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100">Mulai Jualan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-t-[40px] w-full max-w-[420px] p-8 animate-in slide-in-from-bottom-full duration-500 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><Store size={24} /></div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Daftar Bakul</h3>
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mt-0.5 text-left">Aktifkan Lokasi Jualan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Nama Toko */}
          <div className="text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Toko/Warung *</label>
            <input name="toko_name" required type="text" value={formData.toko_name} onChange={handleInputChange} className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20" placeholder="Contoh: Warung Barokah" />
          </div>

          {/* BOX AMBIL LOKASI (KUNCI UTAMA) */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className={formData.latitude ? "text-emerald-500" : "text-slate-400"} />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Titik Lokasi (GPS)</span>
              </div>
              {formData.latitude && <span className="text-[8px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full">TERKUNCI</span>}
            </div>

            <button
              type="button"
              onClick={getLocation}
              disabled={detectingLocation}
              className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                formData.latitude 
                ? "bg-white text-emerald-600 border border-emerald-200 shadow-sm" 
                : "bg-orange-600 text-white shadow-lg active:scale-95"
              }`}
            >
              {detectingLocation ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              {formData.latitude ? "Update Lokasi Saya" : "Ambil Lokasi Otomatis"}
            </button>
            <p className="text-[8px] text-slate-400 mt-2 leading-tight">* Wajib klik tombol ini supaya pembeli tahu jarak ke warung sampeyan.</p>
          </div>

          {/* Sisa Input Data Diri */}
          <div className="space-y-3 text-left">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
              <input name="full_name" required type="text" value={formData.full_name} onChange={handleInputChange} className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
              <input name="phone" required type="tel" value={formData.phone} onChange={handleInputChange} className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
            </div>
            {/* Grid Desa & Kec */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desa</label>
                <input name="desa" type="text" value={formData.desa} onChange={handleInputChange} className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kecamatan</label>
                <input name="kecamatan" type="text" value={formData.kecamatan} onChange={handleInputChange} className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full mt-4 py-4 bg-orange-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
            Daftar Jadi Bakul
          </button>
        </form>
      </div>
    </div>
  );
}