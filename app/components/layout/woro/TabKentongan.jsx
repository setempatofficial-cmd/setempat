"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import AIModal from "@/app/components/ai/AIModal";
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
  Trash2,
  Edit,
} from "lucide-react";

function formatTime(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}j`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// 🔥 FUNGSI COMPRESS IMAGE
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    if (file.size < 1024 * 1024) {
      resolve(file);
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxWidth = 1024;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.8);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

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

  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedForAI, setSelectedForAI] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    is_urgent: false,
    is_pinned: false,
  });
  const [editImageFile, setEditImageFile] = useState(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState(null);
  const [updating, setUpdating] = useState(false);

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

  // 🔥 UPLOAD KE CLOUDINARY DENGAN TIMEOUT
  const uploadToCloudinary = async (file) => {
    // Validasi ukuran file (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Ukuran file maksimal 2MB. Silakan kompres gambar terlebih dahulu.");
    }

    const CLOUD_NAME = "dlluhhe83";
    const UPLOAD_PRESET = "setempat_preset";
    const API_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    // 🔥 Tambahkan timeout 15 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Gagal upload ke Cloudinary");
      }

      const data = await response.json();
      return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
      
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error("Upload timeout, coba dengan file yang lebih kecil");
      }
      console.error("Cloudinary Upload Error:", err);
      throw err;
    }
  };

  // Fetch Profile
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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // 🔥 Kompres file sebelum preview
        const compressed = await compressImage(file);
        setImageFile(compressed);
        setPreviewUrl(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Compress error:", err);
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const openEditModal = (item, e) => {
    e.stopPropagation();
    setEditingItem(item);
    setEditFormData({
      title: item.title,
      content: item.content,
      is_urgent: item.is_urgent,
      is_pinned: item.is_pinned,
    });
    if (item.image_url) {
      setEditPreviewUrl(item.image_url);
    }
    setEditImageFile(null);
  };

  const handleEditFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setEditImageFile(compressed);
        setEditPreviewUrl(URL.createObjectURL(compressed));
      } catch (err) {
        setEditImageFile(file);
        setEditPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleUpdateAnnouncement = async (e) => {
    e.preventDefault();
    if (!editFormData.title.trim() || !editFormData.content.trim()) return;
    if (!editingItem) return;

    setUpdating(true);
    try {
      let finalImageUrl = editingItem.image_url;

      if (editImageFile) {
        finalImageUrl = await uploadToCloudinary(editImageFile);
      }

      const { error } = await supabase
        .from("kentongan")
        .update({
          title: editFormData.title,
          content: editFormData.content,
          image_url: finalImageUrl,
          is_urgent: editFormData.is_urgent,
          is_pinned: editFormData.is_pinned,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      setEditingItem(null);
      setEditFormData({ title: "", content: "", is_urgent: false, is_pinned: false });
      setEditImageFile(null);
      setEditPreviewUrl(null);
      // 🔥 Tidak perlu panggil fetchAnnouncements, subscription akan update
    } catch (err) {
      console.error("Update Error:", err);
      alert("Gagal update pengumuman: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("kentongan")
        .delete()
        .eq("id", selectedAnnouncement.id);
      
      if (error) throw error;
      
      setShowDeleteConfirm(false);
      setSelectedAnnouncement(null);
      // 🔥 Tidak perlu panggil fetchAnnouncements, subscription akan update
      
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Gagal menghapus pengumuman: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (item, e) => {
    e.stopPropagation();
    setSelectedAnnouncement(item);
    setShowDeleteConfirm(true);
  };

  // 🔥 HANDLE SEND YANG DIPERBAIKI
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

      console.log("📤 Sending payload:", payload);

      const { data, error } = await supabase
        .from("kentongan")
        .insert(payload)
        .select();

      if (error) {
        console.error("Supabase Error:", error);
        throw new Error(error.message);
      }

      console.log("✅ Berhasil tersimpan:", data);

      // Reset form
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
      
      // 🔥 HAPUS fetchAnnouncements() - subscription akan update otomatis
      
    } catch (err) {
      console.error("Error:", err);
      let errorMessage = err.message;
      if (err.message.includes("JWT")) {
        errorMessage = "Sesi login Anda habis, silakan refresh halaman dan login ulang.";
      } else if (err.message.includes("timeout")) {
        errorMessage = "Upload terlalu lama, coba dengan ukuran gambar yang lebih kecil.";
      }
      alert(`Gagal mengirim: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  // 🔥 SATU HANDLER UNTUK MODAL AI
  const handleOpenAIModal = (item, e) => {
    if (e) e.stopPropagation();
    setSelectedForAI(item);
    setShowAIModal(true);
  };

  return (
    <div className={`pb-20 max-w-2xl mx-auto px-4 sm:px-0 transition-colors duration-300`}>
      {/* FORM KIRIM PENGUMUMAN */}
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
                    Foto Berita (Opsional, max 2MB)
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
              onClick={(e) => handleOpenAIModal(item, e)}
              className={`group relative rounded-2xl p-5 border transition-all cursor-pointer ${
                isMalam
                  ? "bg-slate-900/40 border-white/5 hover:bg-slate-900/60 hover:border-orange-500/30"
                  : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-orange-200"
              }`}
            >
              {/* Tombol Edit & Delete */}
              {isSuperAdmin && (
                <div className="absolute top-4 left-4 flex gap-2 z-10">
                  <button
                    onClick={(e) => openEditModal(item, e)}
                    className="p-1.5 rounded-full bg-blue-500/80 text-white hover:bg-blue-600 transition-all backdrop-blur-sm shadow-md"
                    title="Edit pengumuman"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => openDeleteConfirm(item, e)}
                    className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-all backdrop-blur-sm shadow-md"
                    title="Hapus pengumuman"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Label DARURAT */}
              {item.is_urgent && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse shadow-lg">
                    DARURAT
                  </span>
                </div>
              )}

              <div className="mt-6">
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
                    
                    <h3 className={`font-black text-[16px] break-words flex-1 ${
                      isMalam ? "text-white" : "text-slate-900"
                    }`}>
                      {item.title}
                      {item.is_pinned && <span className="ml-2 text-amber-500 inline-block">📌</span>}
                    </h3>
                  </div>
                  
                  <span className={`text-[10px] font-bold flex-shrink-0 whitespace-nowrap ${
                    isMalam ? "text-white/40" : "text-slate-500"
                  }`}>
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

                <p className={`text-[14px] leading-relaxed font-medium line-clamp-3 mt-1 ${
                  isMalam ? "text-slate-300" : "text-slate-800"
                }`}>
                  {item.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL KONFIRMASI DELETE */}
      {showDeleteConfirm && selectedAnnouncement && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className={`max-w-sm w-full rounded-2xl p-6 shadow-2xl ${isMalam ? "bg-slate-900" : "bg-white"}`}>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h3 className={`text-xl font-black mb-2 ${isMalam ? "text-white" : "text-slate-900"}`}>
                Hapus Pengumuman?
              </h3>
              <p className={`text-sm mb-6 ${isMalam ? "text-slate-300" : "text-slate-600"}`}>
                Apakah Anda yakin ingin menghapus pengumuman<br />
                <span className="font-bold">"{selectedAnnouncement.title}"</span>?
                <br />
                <span className="text-xs opacity-60 mt-1 block">Tindakan ini tidak dapat dibatalkan.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedAnnouncement(null);
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    isMalam 
                      ? "bg-slate-800 text-white hover:bg-slate-700" 
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteAnnouncement}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 size={18} className="animate-spin" /> : "Hapus"}
                  {deleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT */}
      {editingItem && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/70 animate-in fade-in overflow-y-auto">
          <div className={`max-w-md w-full rounded-2xl p-6 shadow-2xl ${isMalam ? "bg-slate-900" : "bg-white"}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-black ${isMalam ? "text-white" : "text-slate-900"}`}>
                Edit Pengumuman
              </h3>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setEditPreviewUrl(null);
                  setEditImageFile(null);
                }}
                className="p-1 rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateAnnouncement} className="space-y-4">
              <input
                type="text"
                placeholder="Judul Berita..."
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
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
                  {editPreviewUrl ? (
                    <>
                      <img src={editPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditImageFile(null);
                          setEditPreviewUrl(null);
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white shadow-lg focus:scale-95"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center opacity-40 group-hover:opacity-100">
                      <Camera size={24} className={isMalam ? "text-white" : "text-slate-900"} />
                      <span className="text-[10px] font-bold mt-1">Klik untuk ganti foto</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleEditFileChange} />
                </label>
              </div>

              <textarea
                placeholder="Ceritakan kejadiannya secara lengkap..."
                rows={4}
                value={editFormData.content}
                onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl text-[14px] leading-relaxed outline-none border transition-all ${
                  isMalam
                    ? "bg-slate-800 border-white/10 text-white focus:border-orange-500/50"
                    : "bg-slate-50 border-slate-300 focus:border-orange-400"
                }`}
                required
              />

              <div className="flex gap-6 px-1">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editFormData.is_urgent}
                    onChange={(e) => setEditFormData({ ...editFormData, is_urgent: e.target.checked })}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className={`text-[13px] font-bold ${editFormData.is_urgent ? "text-red-500" : "opacity-50"}`}>
                    🚨 Darurat
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editFormData.is_pinned}
                    onChange={(e) => setEditFormData({ ...editFormData, is_pinned: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className={`text-[13px] font-bold ${editFormData.is_pinned ? "text-amber-500" : "opacity-50"}`}>
                    📌 Pin
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[15px] font-black shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {updating ? "MENYIMPAN..." : "SIMPAN PERUBAHAN"}
              </button>
            </form>
          </div>
        </div>
      )}

      <AIModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        kentongan={selectedForAI}
        theme={{ 
          isMalam,
          card: isMalam ? "bg-slate-900" : "bg-white",
          border: isMalam ? "border-white/10" : "border-gray-100",
          text: isMalam ? "text-white" : "text-gray-900"
        }}
      />
    </div>
  );
}