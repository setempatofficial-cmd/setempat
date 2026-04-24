'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { 
  AlertCircle, HandHelping, PackageSearch, Hammer, 
  Loader2, Search, X, ArrowLeft, ShoppingBag, MapPin 
} from "lucide-react";
import RewangCard from "@/app/components/features/rewang/RewangCard";

export default function RewangSection({ onBack, locationName = "Pakijangan" }) {
  const [selectedCat, setSelectedCat] = useState("Semua");
  const [rewangList, setRewangList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // State untuk Smart Header agar sama dengan Panyangan
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const categories = [
    { id: "Semua", label: "Kabeh", icon: "🌈" },
    { id: "Butuh Bantuan", label: "Sambat", icon: "🆘" },
    { id: "Siap Rewang", label: "Rewang", icon: "🤝" },
    { id: "Tenaga Ahli", label: "Skill", icon: "🛠️" },
    { id: "Pinjam Alat", label: "Alat", icon: "📦" },
  ];

  // --- LOGIKA SMART HEADER (Sama dengan Panyangan) ---
  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 20) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY) {
        setShowHeader(false); 
      } else {
        setShowHeader(true); 
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  const fetchRewangData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: dataRewang } = await supabase
        .from("profiles")
        .select("*")
        .eq('is_rewang', true);

      const { data: dataSambatan } = await supabase
        .from("sambatan")
        .select("*")
        .eq('status', 'aktif');
      
      const combined = [
        ...(dataRewang || []).map(item => ({ 
          ...item, 
          type: 'rewang', 
          display_category: item.kategori || "Tenaga Ahli" 
        })),
        ...(dataSambatan || []).map(item => ({ 
          ...item, 
          type: 'kebutuhan', 
          display_category: "Butuh Bantuan" 
        }))
      ];
      setRewangList(combined);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setIsLoading(false); 
    }
  }, []);

  useEffect(() => { 
    fetchRewangData(); 
  }, [fetchRewangData]);

  const filteredRewang = useMemo(() => {
    let filtered = [...rewangList];
    if (selectedCat !== "Semua") {
      if (selectedCat === "Butuh Bantuan") {
        filtered = filtered.filter(item => item.type === 'kebutuhan');
      } else if (selectedCat === "Siap Rewang") {
        filtered = filtered.filter(item => item.type === 'rewang');
      } else {
        filtered = filtered.filter(item => item.kategori === selectedCat);
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const name = (item.full_name || item.nama_lengkap || '').toLowerCase();
        const description = (item.deskripsi || item.keterangan || '').toLowerCase();
        return name.includes(query) || description.includes(query);
      });
    }
    return filtered;
  }, [rewangList, selectedCat, searchQuery]);

  return (
    <div className="relative min-h-screen bg-[#FBFBFE]">
      
      {/* HEADER & KATEGORI REWANG (OPTIMIZED) */}
<div className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-300 ${
  showHeader ? 'translate-y-0' : '-translate-y-[62px]'
}`}>
  <div className="max-w-[420px] mx-auto bg-white/80 backdrop-blur-md border-b border-slate-100">
    
    {/* Baris 1: Navigasi & Lokasi Aktif */}
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-600 active:scale-90 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="font-black text-slate-900 text-sm italic tracking-tighter leading-none uppercase">REWANG</h3>
          <p className="text-[8px] text-orange-500 font-bold uppercase tracking-[0.2em] mt-0.5">Bantuan Warga</p>
        </div>
      </div>

      {/* LOKASI AKTIF (Pojok Kanan Atas) */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full shadow-sm">
        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
        <span className="text-[9px] font-black text-orange-700 uppercase tracking-tight">
          {locationName}
        </span>
        <MapPin size={10} className="text-orange-500" />
      </div>
    </div>

    {/* Baris 2: Search & Kategori */}
    <div className="px-6 pb-3 space-y-3">
      {/* Search Input */}
      <div className="relative group">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
        <input
          type="text"
          placeholder="Golek tulung opo hari ini?"
          className="w-full pl-9 pr-10 py-2 bg-slate-100/80 border border-transparent rounded-xl text-[11px] focus:bg-white focus:border-orange-200 focus:outline-none transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
      
      {/* Horizontal Scroll Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all border ${
              selectedCat === cat.id 
              ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200 scale-95' 
              : 'bg-white border-slate-100 text-slate-500 hover:border-orange-200 shadow-sm'
            }`}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  </div>
</div>

      {/* CONTENT AREA */}
      <div className="pt-52 px-6 pb-20">
        {isLoading ? (
          <div className="flex flex-col items-center py-20 opacity-30">
            <Loader2 size={32} className="animate-spin text-slate-400 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ngunduh Data...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredRewang.length > 0 ? (
              <div className="space-y-4">
                {filteredRewang.map((data, index) => (
                  <motion.div 
                    key={`${data.type}_${data.id}`} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  >
                    <RewangCard profile={data} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-orange-50 rounded-[32px] flex items-center justify-center mb-6 rotate-3">
                  <HandHelping size={40} className="text-orange-400" />
                </div>
                <h4 className="text-slate-900 font-black text-lg uppercase tracking-tight">Kosong Lur</h4>
                <p className="text-slate-400 text-xs mt-2 max-w-[200px] leading-relaxed">
                  {searchQuery ? `Hasil "${searchQuery}" ora ketemu.` : `Durung ono sambatan utawa rewang ing kene.`}
                </p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}