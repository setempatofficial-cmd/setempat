"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Crown,
  Loader2,
  Send,
  MapPin,
  ChevronDown,
  Camera,
  X,
} from "lucide-react";

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

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

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

  // --- FUNGSI CLOUDINARY ---
  const uploadToCloudinary = async (file) => {
    const cloudName = "dlluhhe83";
    const uploadPreset = "setempat_preset";

    const formDataCloud = new FormData();
    formDataCloud.append("file", file);
    formDataCloud.append("upload_preset", uploadPreset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formDataCloud }
      );

      if (!res.ok) throw new Error("Gagal upload ke server Cloudinary");

      const data = await res.json();
      return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
    } catch (err) {
      console.error("Cloudinary Error:", err);
      throw new Error("Gagal upload gambar: " + err.message);
    }
  };

  // Fetch Profile & Data
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

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kentongan")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel("kentongan_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kentongan" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(fetchAnnouncements, 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchAnnouncements]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSendKentongan = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSending(true);
    try {
      let finalImageUrl = null;

      if (imageFile) {
        finalImageUrl = await uploadToCloudinary(imageFile);
      }

      const payload = {
        title: formData.title,
        content: formData.content,
        image_url: finalImageUrl,
        is_urgent: formData.is_urgent,
        is_pinned: formData.is_pinned,
        created_by: user?.id,
        is_global: isSuperAdmin ? formData.target_type === "semua" : false,
        target_desa: isSuperAdmin
          ? formData.target_type === "semua"
            ? null
            : formData.target_desa
          : profile?.desa,
        target_kecamatan: isSuperAdmin
          ? formData.target_type === "semua"
            ? null
            : formData.target_kecamatan
          : profile?.kecamatan,
      };

      const { error } = await supabase.from("kentongan").insert(payload);
      if (error) throw error;

      setFormData({
        title: "",
        content: "",
        is_urgent: false,
        is_pinned: false,
        target_type: "wilayah_saya",
        target_desa: profile?.desa || "",
        target_kecamatan: profile?.kecamatan || "",
      });
      setImageFile(null);
      setPreviewUrl(null);
      setShowForm(false);
      fetchAnnouncements();
    } catch (err) {
      console.error("Error:", err);
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKentonganClick = (kentongan) => {
    sessionStorage.setItem("selected_kentongan", JSON.stringify(kentongan));
    router.push("/");
  };

  return (
    <div className={`pb-20 max-w-2xl mx-auto px-4 sm:px-0 transition-colors duration-300`}>
      {canSendKentongan && (
        <div
          className={`mb-8 rounded-2xl border shadow-sm overflow-hidden transition-all duration-300
          ${isMalam ? "bg-slate-900 border-orange-500/20" : "bg-white border-orange-200"}`}
        >
          <button
            onClick={() => setShowForm(!showForm)}
            className={`w-full flex items-center justify-between p-5 transition-colors ${
              isMalam ? "hover:bg-orange-500/5" : "hover:bg-orange-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isMalam
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-orange-100 text-orange-600"
                }`}
              >
                <Megaphone size={20} />
              </div>
              <div className="text-left">
                <h4 className={`font-bold tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
                  Kirim Berita / Info
                </h4>
                <p className={`text-[11px] font-semibold ${isMalam ? "text-orange-300/60" : "text-slate-500"}`}>
                  Bagikan kejadian penting ke warga
                </p>
              </div>
            </div>
            <ChevronDown
              size={20}
              className={`transition-transform duration-300 ${showForm ? "rotate-180" : "opacity-40"}`}
            />
          </button>

          {showForm && (
            <form onSubmit={handleSendKentongan} className="p-5 pt-0 space-y-5">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Judul Berita..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl text-[15px] font-bold outline-none border transition-all ${
                    isMalam
                      ? "bg-slate-800 border-white/10 text-white focus:border-orange-500/50"
                      : "bg-slate-50 border-slate-300 focus:border-orange-400"
                  }`}
                  required
                />

                <div className="space-y-2">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isMalam ? "text-white/40" : "text-slate-500"}`}>
                    Foto Berita (Opsional)
                  </p>
                  <label
                    className={`relative group flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden
                    ${
                      isMalam
                        ? "border-white/10 bg-white/5 hover:border-orange-500/40"
                        : "border-slate-200 bg-slate-50 hover:border-orange-300"
                    }`}
                  >
                    {previewUrl ? (
                      <>
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setImageFile(null);
                            setPreviewUrl(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white shadow-lg focus:scale-95"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center opacity-40 group-hover:opacity-100">
                        <Camera size={24} className={isMalam ? "text-white" : "text-slate-900"} />
                        <span className="text-[10px] font-bold mt-1">Klik untuk tambah foto</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>

                <textarea
                  placeholder="Ceritakan kejadiannya secara lengkap..."
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl text-[14px] leading-relaxed outline-none border transition-all ${
                    isMalam
                      ? "bg-slate-800 border-white/10 text-white focus:border-orange-500/50"
                      : "bg-slate-50 border-slate-300 focus:border-orange-400"
                  }`}
                  required
                />
              </div>

              {isSuperAdmin && (
                <div className={`p-4 rounded-xl space-y-3 ${isMalam ? "bg-white/5" : "bg-slate-100 border border-slate-200"}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isMalam ? "text-white/40" : "text-slate-500"}`}>
                    Target Distribusi
                  </p>
                  <div className="flex gap-4">
                    {["semua", "wilayah_saya"].map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          checked={formData.target_type === type}
                          onChange={() => setFormData({ ...formData, target_type: type })}
                          className="accent-orange-500 h-4 w-4"
                        />
                        <span className={`text-sm font-bold ${isMalam ? "text-white/70" : "text-slate-700"}`}>
                          {type === "semua" ? "📢 Semua Wilayah" : "📍 Wilayah Tertentu"}
                        </span>
                      </label>
                    ))}
                  </div>

                  {formData.target_type === "wilayah_saya" && (
                    <div className="space-y-3 mt-4 pt-3 border-t border-white/10">
                      <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest ${isMalam ? "text-white/40" : "text-slate-500"}`}>
                          Desa
                        </label>
                        <input
                          type="text"
                          placeholder="Nama Desa"
                          value={formData.target_desa}
                          onChange={(e) => setFormData({ ...formData, target_desa: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-xl text-[14px] outline-none border transition-all mt-1 ${
                            isMalam
                              ? "bg-slate-800 border-white/10 text-white focus:border-orange-500/50"
                              : "bg-slate-50 border-slate-300 focus:border-orange-400"
                          }`}
                          required={formData.target_type === "wilayah_saya"}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest ${isMalam ? "text-white/40" : "text-slate-500"}`}>
                          Kecamatan
                        </label>
                        <input
                          type="text"
                          placeholder="Nama Kecamatan"
                          value={formData.target_kecamatan}
                          onChange={(e) => setFormData({ ...formData, target_kecamatan: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-xl text-[14px] outline-none border transition-all mt-1 ${
                            isMalam
                              ? "bg-slate-800 border-white/10 text-white focus:border-orange-500/50"
                              : "bg-slate-50 border-slate-300 focus:border-orange-400"
                          }`}
                          required={formData.target_type === "wilayah_saya"}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-6 px-1">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_urgent}
                    onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className={`text-[13px] font-bold ${formData.is_urgent ? "text-red-500" : "opacity-50"}`}>
                    🚨 Darurat
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className={`text-[13px] font-bold ${formData.is_pinned ? "text-amber-500" : "opacity-50"}`}>
                    📌 Pin
                  </span>
                </label>
              </div>

              {!isSuperAdmin && isAdmin && profile && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 ${
                    isMalam
                      ? "bg-orange-500/5 border-orange-500/20"
                      : "bg-orange-50 border-orange-100"
                  }`}
                >
                  <MapPin size={14} className="text-orange-500" />
                  <span className={`text-[11px] font-bold ${isMalam ? "text-orange-300" : "text-orange-700"}`}>
                    Target: Desa {profile.desa}, Kec. {profile.kecamatan}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[15px] font-black shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {sending ? "MENGIRIM BERITA..." : "SEBARKAN SEKARANG"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* FEED LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-20 opacity-50">
            <Loader2 className="animate-spin text-orange-500" size={32} />
            <p className={`text-sm mt-2 ${isMalam ? "text-slate-400" : "text-slate-500"}`}>
              Memuat berita...
            </p>
          </div>
        ) : announcements.length === 0 ? (
          <div className={`text-center py-20 ${isMalam ? "text-slate-400" : "text-slate-500"}`}>
            <Megaphone size={48} className="mx-auto opacity-30 mb-3" />
            <p className="text-sm font-medium">Belum ada berita</p>
            <p className="text-xs opacity-50 mt-1">Jadilah yang pertama berbagi info</p>
          </div>
        ) : (
          announcements.map((item) => (
            <div
              key={item.id}
              onClick={() => handleKentonganClick(item)}
              className={`group relative rounded-2xl p-5 border transition-all cursor-pointer ${
                isMalam
                  ? "bg-slate-900/40 border-white/5 hover:bg-slate-900/60 hover:border-orange-500/30"
                  : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-orange-200"
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      item.is_urgent
                        ? "bg-red-500/10 text-red-500"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {item.is_urgent ? <Megaphone size={18} /> : <Crown size={18} />}
                  </div>
                  <h3 className={`font-black text-[16px] break-words flex-1 ${isMalam ? "text-white" : "text-slate-900"}`}>
                    {item.title}
                    {item.is_pinned && <span className="ml-2 text-amber-500 inline-block">📌</span>}
                  </h3>
                </div>
                <span className="text-[10px] opacity-40 font-bold flex-shrink-0 whitespace-nowrap">
                  {formatTime(item.created_at)}
                </span>
              </div>

              {item.image_url && (
                <div className="relative w-full h-48 mt-3 mb-3 rounded-xl overflow-hidden border border-black/5 bg-slate-100">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              )}

              <p className={`text-[14px] leading-relaxed font-medium line-clamp-3 mt-1 ${isMalam ? "text-slate-300" : "text-slate-700"}`}>
                {item.content}
              </p>

              {item.is_urgent && (
                <div className="absolute top-5 right-5">
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                    DARURAT
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}