'use client';

import React, { useState } from 'react';
import { X, Heart, Gift, AlertCircle, Camera, Send } from 'lucide-react';

export default function FormDonasi({ isOpen, onClose, user }) {
  const [type, setType] = useState('barang'); // 'barang' atau 'darurat'
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleKirimDarurat = () => {
    // Arahkan langsung ke WhatsApp Admin/RT untuk verifikasi cepat
    const pesan = encodeURIComponent(`Halo Admin Setempat.id, saya ingin mengajukan bantuan darurat/uang untuk warga...`);
    window.open(`https://wa.me/628123456789?text=${pesan}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-t-[40px] w-full max-w-[420px] p-8 animate-in slide-in-from-bottom-full duration-500 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <Heart size={24} fill="currentColor" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Berbagi Bantuan</h3>
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-0.5">Saling Jaga Bolo Tonggo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Toggle Tipe Donasi */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button 
            onClick={() => setType('barang')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              type === 'barang' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'
            }`}
          >
            Barang Gratis
          </button>
          <button 
            onClick={() => setType('darurat')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              type === 'darurat' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'
            }`}
          >
            Darurat / Uang
          </button>
        </div>

        {/* Content: BARANG */}
        {type === 'barang' && (
          <form className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Barang</label>
              <input 
                type="text" 
                className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20"
                placeholder="Misal: Seragam SD, Kursi Roda, dll"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kondisi Barang</label>
                <select className="w-full mt-1.5 px-5 py-3.5 bg-slate-100 border-none rounded-2xl text-sm font-bold text-slate-700">
                  <option>Masih Bagus / Layak</option>
                  <option>Baru / Belum Dipakai</option>
                  <option>Ada Minus Sedikit</option>
                </select>
              </div>
            </div>

            <button className="w-full h-32 mt-2 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 gap-2 hover:bg-slate-50 transition-all">
              <Camera size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Foto Barang</span>
            </button>

            <button 
              type="button" 
              className="w-full mt-6 py-4 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              Tayangkan Barang
            </button>
          </form>
        )}

        {/* Content: DARURAT */}
        {type === 'darurat' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="p-6 bg-rose-50 border border-rose-100 rounded-[32px] mb-6">
              <AlertCircle size={32} className="text-rose-500 mb-4" />
              <h4 className="font-black text-slate-900 text-sm uppercase mb-2">Penting untuk Diketahui</h4>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                Untuk penggalangan dana atau bantuan darurat, tim Setempat.id perlu melakukan <span className="font-bold text-rose-600">Verifikasi Lapangan</span> terlebih dahulu agar bantuan tepat sasaran dan aman dari penipuan.
              </p>
            </div>

            <button 
              onClick={handleKirimDarurat}
              className="w-full py-4 bg-emerald-500 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Send size={16} /> Hubungi Admin (WA)
            </button>
            <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-4">
              Laporan Sampeyan akan segera kami respon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}