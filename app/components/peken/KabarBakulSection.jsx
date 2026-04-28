'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import {
  Megaphone, Loader2, Send, MapPin, ChevronDown,
  Camera, X, Trash2, Edit, Bell, Package,
  TrendingUp, Calendar, ArrowRight, Info
} from "lucide-react";

function formatTime(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}j`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function KabarBakulSection({ locationName, onNavigateToProduct }) {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [kabarList, setKabarList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const debounceRef = useRef(null);

  // --- SMART HEADER LOGIC ---
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const controlHeader = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY < 50) {
          setShowHeader(true);
        } else if (window.scrollY > lastScrollY) {
          setShowHeader(false); // Scroll Down
        } else {
          setShowHeader(true); // Scroll Up
        }
        setLastScrollY(window.scrollY);
      }
    };
    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  // States for CRUD
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [formData, setFormData] = useState({
    judul: "", konten: "", tag: "PENGUMUMAN", tag_color: "orange", is_pinned: false, target_lokasi: "Semua",
  });

  const canSendKabar = isSuperAdmin || isAdmin;

  const tagOptions = [
    { value: "PRODUK BARU", label: "📦 Produk", color: "emerald" },
    { value: "INFO HARGA", label: "📈 Harga", color: "red" },
    { value: "EVENT", label: "🎉 Event", color: "purple" },
    { value: "PENGUMUMAN", label: "📢 Info", color: "orange" },
  ];

  const getIcon = (tag) => {
    const iconProps = { size: 16 };
    if (tag === "PRODUK BARU") return <Package {...iconProps} />;
    if (tag === "INFO HARGA") return <TrendingUp {...iconProps} />;
    if (tag === "EVENT") return <Calendar {...iconProps} />;
    return <Megaphone {...iconProps} />;
  };

  const fetchKabar = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("kabar_bakul")
        .select("*")
        .eq('is_active', true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30);

      if (!canSendKabar && locationName && locationName !== 'Semua') {
        query = query.or(`target_lokasi.eq.${locationName},target_lokasi.eq.Semua,is_global.eq.true`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setKabarList(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [canSendKabar, locationName]);

  useEffect(() => {
    fetchKabar();
  }, [fetchKabar]);

  return (
    <div className="relative min-h-screen">
      
      {/* ========== SMART HEADER (FIXED) ========== */}
      <div className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-500 ease-in-out ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-[420px] mx-auto bg-[#FBFBFE]/90 backdrop-blur-lg border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
              <Bell size={20} className="animate-swing" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-tighter italic leading-none">KABAR BAKUL</h3>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{locationName || 'Pasuruan'}</span>
              </div>
            </div>
          </div>
          
          {canSendKabar && (
            <button 
              onClick={() => setShowForm(!showForm)}
              className={`p-2.5 rounded-xl transition-all active:scale-90 ${showForm ? 'bg-orange-500 text-white shadow-orange-200' : 'bg-slate-100 text-slate-600'}`}
            >
              {showForm ? <X size={18} /> : <Edit size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Spacing Awal biar tidak tertutup header */}
      <div className="h-6" />

      <div className="px-1 pb-24">
        {/* ========== FORM INPUT (KHUSUS ADMIN) ========== */}
        <AnimatePresence>
          {showForm && canSendKabar && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white rounded-[32px] border-2 border-orange-100 p-6 shadow-xl shadow-orange-500/5 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Siaran Baru</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {tagOptions.map((tag) => (
                      <button
                        key={tag.value}
                        onClick={() => setFormData({ ...formData, tag: tag.value, tag_color: tag.color })}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${
                          formData.tag === tag.value ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-500'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Judul Berita..."
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-orange-200 outline-none"
                    value={formData.judul}
                    onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  />

                  <textarea
                    placeholder="Opo sing kate dikabarno, Bos?..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-orange-200 outline-none leading-relaxed"
                    value={formData.konten}
                    onChange={(e) => setFormData({ ...formData, konten: e.target.value })}
                  />

                  <button
                    disabled={sending}
                    className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    SIARKAN SEKARANG
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========== DAFTAR KABAR (FEED) ========== */}
        <div className="space-y-4 mt-4">
          {loading ? (
             <div className="flex justify-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
          ) : (
            kabarList.map((item, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={item.id}
                className={`relative group bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.98] ${
                  item.is_pinned ? 'ring-2 ring-amber-400/30' : ''
                }`}
              >
                {item.is_pinned && (
                  <div className="absolute -top-2 -right-1 bg-amber-400 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-sm">
                    PINNED
                  </div>
                )}

                <div className="flex gap-4">
                  <div className={`w-12 h-12 shrink-0 rounded-[20px] flex items-center justify-center ${
                    item.tag_color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    item.tag_color === 'red' ? 'bg-red-50 text-red-600' :
                    item.tag_color === 'purple' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {getIcon(item.tag)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.tag}</span>
                      <span className="text-[9px] text-slate-300 font-bold">{formatTime(item.created_at)}</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm leading-tight mb-2 tracking-tight group-hover:text-orange-600 transition-colors">
                      {item.judul}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-4 font-medium">
                      {item.konten}
                    </p>

                    <div className="flex items-center justify-between">
                       <div className="flex -space-x-1.5">
                         <div className="w-5 h-5 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-black">A</div>
                         <div className="w-5 h-5 rounded-full bg-orange-500 border border-white flex items-center justify-center text-[8px] font-black text-white tracking-tighter">S.id</div>
                       </div>
                       
                       <button className="flex items-center gap-1.5 text-orange-600 font-black text-[10px] uppercase italic tracking-tighter">
                         Woco Selanjute <ArrowRight size={12} />
                       </button>
                    </div>
                  </div>
                </div>

                {canSendKabar && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                    <button className="flex-1 py-2.5 bg-slate-50 rounded-xl text-[9px] font-black text-slate-500 uppercase flex items-center justify-center gap-1 active:bg-slate-100">
                      <Edit size={10} /> Edit
                    </button>
                    <button className="flex-1 py-2.5 bg-red-50 rounded-xl text-[9px] font-black text-red-400 uppercase flex items-center justify-center gap-1 active:bg-red-100">
                      <Trash2 size={10} /> Hapus
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
          
          {kabarList.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="text-slate-200" size={32} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum ada kabar hari ini</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}