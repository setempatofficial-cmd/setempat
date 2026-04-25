'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, Search, Heart, Gift, 
  Info, MapPin, ChevronRight, X, Clock
} from 'lucide-react';

const DONASI_URGENT = [
  { 
    id: 1, 
    judul: 'Bantuan Operasi Mbah Darmo', 
    target: 5000000, 
    terkumpul: 2450000, 
    deadline: '5 Hari Lagi',
    kategori: 'Medis',
    image: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?q=80&w=200&auto=format&fit=crop'
  },
];

const DONASI_BARANG = [
  { 
    id: 1, 
    nama: 'Seragam SD Layak Pakai', 
    pemberi: 'Bu RT 02', 
    lokasi: 'Krajan', 
    kondisi: '80% Bagus',
    kategori: 'Pakaian'
  },
  { 
    id: 2, 
    nama: 'Kursi Roda Bekas', 
    pemberi: 'Mas Agus', 
    lokasi: 'Pakijangan', 
    kondisi: 'Masih Fungsi',
    kategori: 'Alat Medis'
  },
];

export default function DonasiSection({ locationName, onBack }) {
  const [activeSubTab, setActiveSubTab] = useState('darurat'); // darurat | barang

  return (
    <div className="min-h-screen bg-[#FBFBFE] animate-in fade-in duration-500 pb-32">
      
      {/* HEADER DNA (Rose Theme) */}
      <div className="fixed top-0 left-0 right-0 z-[110] bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-[420px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 -ml-2 text-slate-600 active:scale-90">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h3 className="font-black text-slate-900 text-sm italic tracking-tighter leading-none uppercase">DONASI WARGA</h3>
              <p className="text-[8px] text-rose-500 font-bold uppercase tracking-[0.2em] mt-0.5">Saling Jaga Bolo Tonggo</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-full">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-rose-700 uppercase tracking-tight">{locationName}</span>
          </div>
        </div>

        {/* SUB-TAB NAV (Uang vs Barang) */}
        <div className="max-w-[420px] mx-auto px-6 pb-4 flex gap-2">
          <button 
            onClick={() => setActiveSubTab('darurat')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'darurat' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-slate-100 text-slate-400'
            }`}
          >
            Darurat (Uang)
          </button>
          <button 
            onClick={() => setActiveSubTab('barang')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'barang' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-slate-100 text-slate-400'
            }`}
          >
            Barang (Gratis)
          </button>
        </div>
      </div>

      <div className="pt-36 px-6 space-y-6">
        
        {/* VIEW 1: DARURAT (CROWDFUNDING) */}
        {activeSubTab === 'darurat' && (
          <div className="space-y-4">
            {DONASI_URGENT.map(item => (
              <div key={item.id} className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                <div className="h-32 bg-slate-200 relative">
                  <img src={item.image} className="w-full h-full object-cover opacity-80" alt={item.judul} />
                  <div className="absolute top-4 left-4 bg-rose-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                    {item.kategori}
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="font-black text-slate-900 text-sm uppercase leading-tight mb-4">{item.judul}</h4>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className="text-slate-400 font-bold tracking-tighter">Terkumpul: Rp {item.terkumpul.toLocaleString()}</span>
                      <span className="text-rose-600 font-bold">{Math.round((item.terkumpul/item.target)*100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full" 
                        style={{ width: `${(item.terkumpul/item.target)*100}%` }} 
                      />
                    </div>
                  </div>

                  <button className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">
                    Donasi Sekarang
                  </button>
                </div>
              </div>
            ))}
            
            <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
              <Info size={18} className="text-blue-500 shrink-0" />
              <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">
                Semua donasi uang diverifikasi oleh Petinggi Setempat dan disalurkan langsung melalui pengurus RT setempat.
              </p>
            </div>
          </div>
        )}

        {/* VIEW 2: BARANG GRATIS */}
        {activeSubTab === 'barang' && (
          <div className="grid grid-cols-1 gap-3">
            {DONASI_BARANG.map(item => (
              <div key={item.id} className="p-4 bg-white border border-slate-100 rounded-[24px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 rounded-2xl text-rose-500">
                    <Gift size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight">{item.nama}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Oleh: {item.pemberi}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">{item.kondisi}</span>
                    </div>
                  </div>
                </div>
                <button className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                  <ChevronRight size={18} />
                </button>
              </div>
            ))}
            
            <button className="w-full mt-4 py-4 border-2 border-dashed border-slate-200 rounded-[28px] text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
              + Berbagi Barang Bekas
            </button>
          </div>
        )}

      </div>
    </div>
  );
}