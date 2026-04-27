'use client';

import React, { useState } from 'react';
import { X, Truck, ShieldCheck, Phone, CheckCircle2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function FormOjek({ isOpen, onClose, user, profile }) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    motor: '',
    plat_nomor: '',
    phone: profile?.phone || '',
    alamat: profile?.alamat || ''
  });

  // Nomor WhatsApp Admin (ganti dengan nomor admin setempat)
  const ADMIN_PHONE = "6281234567890"; // Ganti dengan nomor admin yang sebenarnya

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi
    if (!formData.motor || !formData.plat_nomor) {
      alert("Info motor dan plat nomor wajib diisi, Cak!");
      return;
    }
    if (!formData.phone) {
      alert("Nomor WhatsApp wajib diisi!");
      return;
    }

    setLoading(true);

    try {
      // Gabungkan motor dan plat nomor
      const motorInfo = `${formData.motor} • ${formData.plat_nomor}`;

      // 1. Update profile user menjadi driver (tanpa verifikasi dulu)
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          alamat: formData.alamat,
          is_driver: true,
          driver_status: 'pending', // pending sampai diverifikasi
          motor_info: motorInfo,
          driver_rating: 0
        })
        .eq('id', user?.id);

      if (error) throw error;

      // 2. Simpan ke tabel pendaftar_ojek
      const { error: insertError } = await supabase
        .from("pendaftar_ojek")
        .insert({
          user_id: user?.id,
          motor_info: motorInfo,
          plat_nomor: formData.plat_nomor,
          deskripsi: `Driver Ojek dengan motor ${formData.motor}`,
          tarif: "5000",
          jam: "08.00 - 17.00",
          status: "menunggu_verifikasi"
        });

      if (insertError) throw insertError;

      // 3. Buka WhatsApp untuk kirim data ke Admin
      const message = `*🛵 PENDAFTARAN OJEK WARGA BARU* 🛵\n\n` +
        `*Nama:* ${formData.full_name}\n` +
        `*Username:* @${profile?.username || user?.email?.split('@')[0]}\n` +
        `*Email:* ${user?.email}\n` +
        `*WhatsApp:* ${formData.phone}\n\n` +
        `*🏍️ Detail Kendaraan:*\n` +
        `▸ Motor: ${formData.motor}\n` +
        `▸ Plat Nomor: ${formData.plat_nomor}\n` +
        `▸ Alamat: ${formData.alamat || '-'}\n\n` +
        `*🔐 Verifikasi:*\n` +
        `Silakan minta foto KTP & STNK via chat untuk verifikasi.\n` +
        `Setelah diverifikasi, update driver_status menjadi 'standby'.\n\n` +
        `_Dikirim dari aplikasi Setempat.id_`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${ADMIN_PHONE}?text=${encodedMessage}`, '_blank');
      
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
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Pendaftaran Terkirim!</h3>
          <p className="text-[11px] text-slate-500 mt-3 font-medium leading-relaxed">
            Data Sampeyan sudah kami terima. Untuk keamanan warga, silakan kirim foto <span className="font-bold">KTP & STNK</span> ke WhatsApp Admin untuk verifikasi akhir.
          </p>
          <p className="text-[9px] text-emerald-600 mt-2 font-medium">
            Admin akan menghubungi Anda setelah data diverifikasi.
          </p>
          <button 
            onClick={() => { setSubmitted(false); onClose(); window.location.reload(); }}
            className="w-full mt-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100"
          >
            Siap, Paham!
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
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Truck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Daftar Ojek Warga</h3>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">Gabung jadi Rider Lokal</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Info Keamanan & Verifikasi via WA */}
        <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-6">
          <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
          <div>
            <p className="text-[10px] text-emerald-700 font-bold leading-relaxed">
              Verifikasi via WhatsApp
            </p>
            <p className="text-[9px] text-emerald-600/80 mt-0.5">
              Foto KTP & STNK akan dikirim via WhatsApp ke Petinggi Setempat untuk verifikasi.
              Data Anda aman & terenkripsi.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
            <input 
              name="full_name"
              required
              type="text" 
              value={formData.full_name}
              onChange={handleInputChange}
              className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Sesuai KTP"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motor</label>
              <input 
                name="motor"
                required
                type="text" 
                value={formData.motor}
                onChange={handleInputChange}
                className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Vario / Supra"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plat Nomor</label>
              <input 
                name="plat_nomor"
                required
                type="text" 
                value={formData.plat_nomor}
                onChange={handleInputChange}
                className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                placeholder="N 1234 XX"
              />
            </div>
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
                className="w-full mt-1.5 pl-12 pr-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
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
              className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Desa / Kecamatan"
              rows={2}
            />
          </div>

          {/* Info Kirim WA */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2">
              <Send size={14} className="text-blue-500" />
              <p className="text-[9px] font-medium text-blue-700">
                Setelah mendaftar, Anda akan diarahkan ke WhatsApp untuk mengirim foto KTP & STNK ke Admin.
              </p>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
            {loading ? "Memproses..." : "Kirim & Daftar"}
          </button>
        </form>
      </div>
    </div>
  );
}