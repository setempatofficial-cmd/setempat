'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, Search, Phone, MessageSquare, 
  MapPin, Navigation, Star, Clock, ShieldCheck 
} from 'lucide-react';

const RIDERS = [
  { id: 1, nama: 'Cak Met', motor: 'Vario Hitam', plat: 'N 1234 AB', status: 'Standby', lokasi: 'Pojok Pasar', rating: 4.9, tarif: 'Mulai 5rb' },
  { id: 2, nama: 'Bang Dul', motor: 'Supra Bapak', plat: 'N 5678 CD', status: 'Lagi Narik', lokasi: 'Depan Balai Desa', rating: 4.8, tarif: 'Mulai 5rb' },
  { id: 3, nama: 'Mas Agus', motor: 'NMAX Biru', plat: 'N 9012 EF', status: 'Standby', lokasi: 'Pertigaan Pakijangan', rating: 5.0, tarif: 'Mulai 7rb' },
];

export default function OjekSection({ locationName, onBack }) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {/* HEADER (Sesuai DNA Panyangan/Rewang) */}
      <div className="fixed top-0 left-0 right-0 z-[110] bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-[420px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 -ml-2 text-slate-600 active:scale-90">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h3 className="font-black text-slate-900 text-sm italic tracking-tighter leading-none uppercase">OJEK WARGA</h3>
              <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-[0.2em] mt-0.5">Antar Jemput & Kirim</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tight">{locationName}</span>
          </div>
        </div>
        
        {/* SEARCH BOX */}
        <div className="max-w-[420px] mx-auto px-6 pb-4">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Golek ojek nang ndi?"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-100/80 rounded-xl text-[11px] focus:bg-white focus:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="pt-32 px-6 space-y-4">
        
        {/* INFO BANNER */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-[24px] text-white shadow-lg shadow-emerald-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Navigation size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">Status Driver</p>
              <p className="text-xs font-bold mt-1">Ada {RIDERS.filter(r => r.status === 'Standby').length} Driver lagi standby di sekitar Sampeyan.</p>
            </div>
          </div>
        </div>

        {/* LIST RIDERS */}
        <div className="space-y-3">
          {RIDERS.map((rider) => (
            <div key={rider.id} className="p-4 bg-white border border-slate-100 rounded-[28px] shadow-sm hover:border-emerald-200 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.nama}`} alt="avatar" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{rider.nama}</h4>
                      <div className="flex items-center gap-0.5 text-[10px] font-black text-orange-500">
                        <Star size={10} fill="currentColor" /> {rider.rating}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{rider.motor} • {rider.plat}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                  rider.status === 'Standby' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  {rider.status}
                </div>
              </div>

              <div className="flex items-center gap-4 py-3 border-t border-dashed border-slate-100">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-600">{rider.lokasi}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-600">{rider.tarif}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <button className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <MessageSquare size={14} /> Chat
                </button>
                <button className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-100">
                  <Phone size={14} /> Hubungi
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER NOTE */}
        <div className="p-6 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed uppercase">
            "Tarif disepakati lewat chat/telpon.<br/>Utamakan keselamatan nggih, Lur!"
          </p>
        </div>
      </div>
    </div>
  );
}