'use client';

import React, { useState } from 'react';
import { X, Truck, ShieldCheck, Phone, CheckCircle2 } from 'lucide-react';

export default function FormOjek({ isOpen, onClose, user, profile }) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulasi simpan data ke Supabase/Database
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
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
          <button 
            onClick={() => { setSubmitted(false); onClose(); }}
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

        {/* Info Keamanan */}
        <div className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-6">
          <ShieldCheck size={18} className="text-blue-500 shrink-0" />
          <p className="text-[10px] text-blue-700 font-bold leading-relaxed italic">
            Akun Sampeyan hanya akan tayang setelah diverifikasi oleh Petinggi Setempat. Pastikan data asli.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
            <input 
              required
              type="text" 
              defaultValue={profile?.full_name || ''}
              className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Sesuai KTP"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motor</label>
              <input 
                required
                type="text" 
                className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Vario / Supra"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plat Nomor</label>
              <input 
                required
                type="text" 
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
                required
                type="tel" 
                className="w-full mt-1.5 pl-12 pr-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                placeholder="08123xxx"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Daftar Sekarang"}
          </button>
        </form>
      </div>
    </div>
  );
}