"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { Megaphone, Crown, Loader2, Pin, Send, MapPin, ChevronDown } from "lucide-react";

function formatTime(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}j`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function TabKentongan({ theme }) {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const router = useRouter(); 
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [profile, setProfile] = useState(null);
  const debounceRef = useRef(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    is_urgent: false,
    is_pinned: false,
    target_type: "wilayah_saya",
    target_desa: "",
    target_kecamatan: "",
  });

  const isMalam = theme?.isMalam ?? true;
  const canSendKentongan = isSuperAdmin || isAdmin;


  // 1. Fetch Profile
  useEffect(() => {
    if (user?.id) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("desa, kecamatan")
          .eq("id", user.id)
          .single();
        
        if (data) {
          setProfile(data);
          if (isAdmin && !isSuperAdmin) {
            setFormData((prev) => ({
              ...prev,
              target_desa: data.desa || "",
              target_kecamatan: data.kecamatan || "",
            }));
          }
        }
      };
      fetchProfile();
    }
  }, [user?.id, isAdmin, isSuperAdmin]);


  // 2. Fetch Announcements - VERSI SEDERHANA (SEPERTI TAB SEMUA)
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      // Ambil semua data tanpa filter kompleks dulu
      const { data, error } = await supabase
        .from("kentongan")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      console.log("Total kentongan dari DB:", data?.length);
      console.log("Profile user:", profile);
      
      // TAMPILKAN SEMUA DATA (seperti TabSemua)
      // Ini untuk memastikan data bisa muncul dulu
      setAnnouncements(data || []);
      
    } catch (err) {
      console.error("Fetch Error:", err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // 3. Realtime
  useEffect(() => {
    fetchAnnouncements();
    const channel = supabase
      .channel("kentongan_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "kentongan" }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchAnnouncements, 300);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchAnnouncements]);

  // 4. Submit Kentongan
  const handleSendKentongan = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSending(true);
    try {
      let target_desa = null;
      let target_kecamatan = null;
      let is_global = false;
      
      if (isSuperAdmin) {
        if (formData.target_type === "semua") {
          is_global = true;
        } else {
          target_desa = formData.target_desa;
          target_kecamatan = formData.target_kecamatan;
        }
      } else if (isAdmin) {
        // Admin tempat: hanya bisa kirim ke wilayahnya sendiri
        target_desa = profile?.desa;
        target_kecamatan = profile?.kecamatan;
        is_global = false;
      }
      
      const payload = {
        title: formData.title,
        content: formData.content,
        is_urgent: formData.is_urgent,
        is_pinned: formData.is_pinned,
        created_by: user?.id,
        is_global: is_global,
        target_desa: target_desa,
        target_kecamatan: target_kecamatan,
      };

      console.log("Mengirim payload:", payload);

      const { error } = await supabase.from("kentongan").insert(payload);
      if (error) throw error;

      setFormData((prev) => ({ 
        ...prev, 
        title: "", 
        content: "", 
        is_urgent: false, 
        is_pinned: false,
        target_type: "wilayah_saya",
        target_desa: profile?.desa || "",
        target_kecamatan: profile?.kecamatan || "",
      }));
      setShowForm(false);
      
    } catch (err) {
      console.error("Error:", err);
      alert("Gagal mengirim: " + err.message);
    } finally {
      setSending(false);
    }
  };

    const handleKentonganClick = (kentongan) => {
  // Simpan data kentongan ke state global atau localStorage
  sessionStorage.setItem('selected_kentongan', JSON.stringify(kentongan));
  // Arahkan ke halaman utama (feed)
  router.push('/');
};
  

  return (
    <div className="pb-20 max-w-2xl mx-auto px-4 sm:px-0 transition-colors duration-300">
      {/* FORM INPUT SECTION */}
      {canSendKentongan && (
        <div className={`mb-8 rounded-2xl border shadow-sm overflow-hidden transition-all duration-300
          ${isMalam ? "bg-slate-900 border-orange-500/20" : "bg-white border-orange-200"}`}>
          
          <button
            onClick={() => setShowForm(!showForm)}
            className={`w-full flex items-center justify-between p-5 transition-colors
              ${isMalam ? "hover:bg-orange-500/5" : "hover:bg-orange-50"}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center 
                ${isMalam ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-600"}`}>
                <Megaphone size={20} />
              </div>
              <div className="text-left">
                <h4 className={`font-bold tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
                  Kirim Pengumuman
                </h4>
                <p className={`text-[11px] font-semibold ${isMalam ? "text-orange-300/60" : "text-slate-500"}`}>
                  {isSuperAdmin 
                    ? "Target: Seluruh warga atau pilih wilayah" 
                    : `Target: Warga ${profile?.desa || "Desa Anda"} (otomatis)`}
                </p>
              </div>
            </div>
            <ChevronDown size={20} className={`transition-transform duration-300 ${showForm ? "rotate-180" : "opacity-40"}`} />
          </button>

          {showForm && (
            <form onSubmit={handleSendKentongan} className="p-5 pt-0 space-y-5">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Judul Pengumuman..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl text-[15px] font-bold outline-none border transition-all
                    ${isMalam 
                      ? "bg-slate-800 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50" 
                      : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-orange-400"}`}
                  required
                />
                <textarea
                  placeholder="Isi pengumuman..."
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl text-[14px] leading-relaxed outline-none border transition-all resize-none
                    ${isMalam 
                      ? "bg-slate-800 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50" 
                      : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-orange-400"}`}
                  required
                />
              </div>

              {/* SUPERADMIN: Pilih target wilayah */}
              {isSuperAdmin && (
                <div className={`p-4 rounded-xl space-y-3 ${isMalam ? "bg-white/5" : "bg-slate-100 border border-slate-200"}`}>
                   <p className={`text-[10px] font-black uppercase tracking-widest ${isMalam ? "text-white/40" : "text-slate-500"}`}>Target Distribusi</p>
                   <div className="flex gap-4">
                      {["semua", "wilayah_saya"].map((type) => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            checked={formData.target_type === type}
                            onChange={() => setFormData({...formData, target_type: type})}
                            className="accent-orange-500 h-4 w-4"
                          />
                          <span className={`text-sm font-bold ${isMalam ? "text-white/70" : "text-slate-700"}`}>
                            {type === "semua" ? "📢 Semua Wilayah" : "📍 Wilayah Tertentu"}
                          </span>
                        </label>
                      ))}
                   </div>
                   
                   {formData.target_type === "wilayah_saya" && (
                     <div className="grid grid-cols-2 gap-3 pt-2">
                        <input 
                          type="text" 
                          placeholder="Nama Desa" 
                          value={formData.target_desa}
                          onChange={(e) => setFormData({...formData, target_desa: e.target.value})}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold outline-none border
                            ${isMalam ? "bg-slate-900 border-white/5 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                        />
                        <input 
                          type="text" 
                          placeholder="Kecamatan" 
                          value={formData.target_kecamatan}
                          onChange={(e) => setFormData({...formData, target_kecamatan: e.target.value})}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold outline-none border
                            ${isMalam ? "bg-slate-900 border-white/5 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                        />
                     </div>
                   )}
                </div>
              )}

              {/* ADMIN TEMPAT: Informasi target (readonly) */}
              {isAdmin && !isSuperAdmin && (
                <div className={`p-4 rounded-xl ${isMalam ? "bg-white/5" : "bg-slate-100"}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isMalam ? "text-white/40" : "text-slate-500"}`}>
                    Target Pengiriman (Otomatis)
                  </p>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-orange-500" />
                    <span className="text-sm font-medium">
                      Desa {profile?.desa || "Belum diatur"}, Kec. {profile?.kecamatan || "Belum diatur"}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-50 mt-2">
                    ℹ️ Kentongan akan dikirim ke warga di wilayah ini saja
                  </p>
                </div>
              )}

              <div className="flex gap-6 px-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={formData.is_urgent} onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })} className="w-4 h-4 accent-red-500" />
                  <span className={`text-[13px] font-bold ${formData.is_urgent ? "text-red-500" : (isMalam ? "text-white/50" : "text-slate-500")}`}>🚨 Darurat</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={formData.is_pinned} onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  <span className={`text-[13px] font-bold ${formData.is_pinned ? "text-amber-500" : (isMalam ? "text-white/50" : "text-slate-500")}`}>📌 Pin</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[15px] font-black shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {sending ? "MEMPROSES..." : "SEBARKAN KENTONGAN"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* FEED LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
             <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
             <p className={`text-xs font-bold ${isMalam ? "text-white" : "text-slate-900"}`}>Mengetuk pintu informasi...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <Megaphone size={48} className="mx-auto mb-4 opacity-30" />
            <p className={`text-sm font-medium ${isMalam ? "text-white/50" : "text-slate-500"}`}>
              Belum ada pengumuman
            </p>
            {canSendKentongan && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-orange-500/20 text-orange-500 text-xs font-bold"
              >
                + Buat pengumuman pertama
              </button>
            )}
          </div>
        ) : (
          announcements.map((item) => (
            <div key={item.id} onClick={() => handleKentonganClick(item)}className={`group relative rounded-2xl p-5 border transition-all duration-300
                ${isMalam ? "bg-slate-900/40 border-white/5 hover:border-white/10" : "bg-white border-slate-200 shadow-sm hover:border-orange-200 hover:shadow-md"}
                ${item.is_urgent ? "ring-1 ring-red-500/30" : ""}`}>
              <div className="flex gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2
                  ${item.is_urgent 
                    ? (isMalam ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-red-50 border-red-200 text-red-600")
                    : (isMalam ? "bg-slate-800 border-white/10 text-amber-500" : "bg-amber-50 border-amber-100 text-amber-600")}`}>
                  {item.is_urgent ? <Megaphone size={20} /> : <Crown size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        {item.is_pinned && <Pin size={14} className="text-amber-500 fill-amber-500" />}
                        <h3 className={`font-black text-[16px] leading-tight ${isMalam ? "text-white" : "text-slate-900"}`}>{item.title}</h3>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-1 opacity-60 ${isMalam ? "text-orange-400" : "text-orange-600"}`}>
                        <Crown size={10} /> Petinggi Setempat 
                        <MapPin size={10} /> {item.is_global ? "Semua Wilayah" : `${item.target_desa || "Lokal"}`}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold opacity-40 ${isMalam ? "text-white" : "text-slate-900"}`}>{formatTime(item.created_at)}</span>
                  </div>
                  <p className={`text-[14px] leading-relaxed mt-3 font-medium ${isMalam ? "text-slate-300" : "text-slate-700"}`}>{item.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}