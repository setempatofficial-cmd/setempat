'use client';

import React, { useState, useEffect } from 'react';
import { X, Store, ShieldCheck, Phone, MapPin, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function FormDaftarBakul({ isOpen, onClose, user, profile, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    alamat: profile?.alamat || '',
    desa: profile?.desa || '',
    kecamatan: profile?.kecamatan || '',
    kabupaten: profile?.kabupaten || '',
    toko_name: '',
    toko_desc: ''
  });

  // Nomor WhatsApp Admin (ganti dengan nomor admin setempat)
  const ADMIN_PHONE = "6281234567890";

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
      }));
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.toko_name) {
      alert("Nama toko/warung wajib diisi, Cak!");
      return;
    }
    if (!formData.phone) {
      alert("Nomor WhatsApp wajib diisi!");
      return;
    }

    setLoading(true);

    try {
      // 1. Update profile user menjadi penjual (is_seller = true)
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          alamat: formData.alamat,
          desa: formData.desa,
          kecamatan: formData.kecamatan,
          kabupaten: formData.kabupaten,
          is_seller: true,
          business_type: 'panyangan',
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      // 2. Simpan ke tabel pendaftar_bakul (opsional, untuk tracking)
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

      if (insertError) console.error('Insert error:', insertError);

      setSubmitted(true);
      
    } catch (err) {
      console.error('Error:', err);
      alert('❌ Gagal mendaftar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-[40px] w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Pendaftaran Berhasil!</h3>
          <p className="text-[11px] text-slate-500 mt-3 font-medium leading-relaxed">
            Selamat! Akun Bakul sampeyan sudah aktif.
          </p>
          <p className="text-[10px] text-emerald-600 mt-2 font-medium">
            🛒 Sampeyan sekarang bisa mulai jualan di Panyangan!
          </p>
          <button 
            onClick={() => { setSubmitted(false); onClose(); }}
            className="w-full mt-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100"
          >
            Mulai Jualan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-t-[40px] w-full max-w-[420px] p-8 animate-in slide-in-from-bottom-full duration-500 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Header Form */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
              <Store size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Daftar Bakul</h3>
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mt-0.5">Jadi Penjual di Panyangan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Info Keuntungan */}
        <div className="flex gap-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl mb-6">
          <Store size={18} className="text-orange-500 shrink-0" />
          <div>
            <p className="text-[10px] text-orange-700 font-bold leading-relaxed">
              Jadi Bakul di Panyangan
            </p>
            <p className="text-[9px] text-orange-600/80 mt-0.5">
              Jual hasil bumi, kerajinan, atau produk lokal ke sesama warga.
              Gratis! Tidak ada biaya pendaftaran.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Toko/Warung *</label>
            <input 
              name="toko_name"
              required
              type="text" 
              value={formData.toko_name}
              onChange={handleInputChange}
              className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
              placeholder="Contoh: Warung Mak Endang, Toko Tani Jaya"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Toko (opsional)</label>
            <textarea 
              name="toko_desc"
              value={formData.toko_desc}
              onChange={handleInputChange}
              className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
              placeholder="Ceritakan tentang toko sampeyan..."
              rows={2}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Data Diri</p>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <input 
                  name="full_name"
                  required
                  type="text" 
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                  placeholder="Sesuai KTP"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    name="phone"
                    required
                    type="tel" 
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full mt-1.5 pl-12 pr-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                    placeholder="08123xxx"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat (opsional)</label>
                <textarea 
                  name="alamat"
                  value={formData.alamat}
                  onChange={handleInputChange}
                  className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                  placeholder="Alamat lengkap / patokan"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desa</label>
                  <input 
                    name="desa"
                    type="text" 
                    value={formData.desa}
                    onChange={handleInputChange}
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold"
                    placeholder="Desa"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kecamatan</label>
                  <input 
                    name="kecamatan"
                    type="text" 
                    value={formData.kecamatan}
                    onChange={handleInputChange}
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold"
                    placeholder="Kecamatan"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kabupaten</label>
                <input 
                  name="kabupaten"
                  type="text" 
                  value={formData.kabupaten}
                  onChange={handleInputChange}
                  className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold"
                  placeholder="Kabupaten"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 py-4 bg-orange-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Store size={16} />}
            {loading ? "Memproses..." : "Daftar Jadi Bakul"}
          </button>
        </form>

        <p className="text-[7px] text-slate-400 text-center mt-4">
          Dengan mendaftar, sampeyan setuju dengan aturan berjualan di Panyangan.
        </p>
      </div>
    </div>
  );
}