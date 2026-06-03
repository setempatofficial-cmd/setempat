"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Calendar, Users, Award, MapPin, HelpCircle, Trash2 } from "lucide-react";

export default function EditOpportunityPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user, isSuperAdmin, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon: "🎯",
    reward_type: "points",
    reward_value: 0,
    reward_text: "",
    quota: 0,
    deadline: "",
    is_active: true,
    category: "general"
  });

  // Cek akses (hanya SuperAdmin)
  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isSuperAdmin, router]);

  // Ambil data opportunity
  useEffect(() => {
    const fetchOpportunity = async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        router.push("/admin/opportunities");
        return;
      }

      if (data) {
        setFormData({
          title: data.title || "",
          description: data.description || "",
          icon: data.icon || "🎯",
          reward_type: data.reward_type || "points",
          reward_value: data.reward_value || 0,
          reward_text: data.reward_text || "",
          quota: data.quota || 0,
          deadline: data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : "",
          is_active: data.is_active !== false,
          category: data.category || "general"
        });
      }
      setLoadingData(false);
    };

    if (id) fetchOpportunity();
  }, [id, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Validasi reward_text otomatis
    let rewardText = formData.reward_text;
    if (!rewardText) {
      if (formData.reward_type === "money") {
        rewardText = `Rp${formData.reward_value.toLocaleString()}`;
      } else {
        rewardText = `${formData.reward_value} Poin`;
      }
    }

    const opportunityData = {
      title: formData.title,
      description: formData.description,
      icon: formData.icon,
      reward_type: formData.reward_type,
      reward_value: formData.reward_value,
      reward_text: rewardText,
      quota: formData.quota || 0,
      deadline: formData.deadline,
      is_active: formData.is_active,
      category: formData.category,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("opportunities")
      .update(opportunityData)
      .eq("id", id);

    if (!error) {
      alert("✅ Kesempatan berhasil diupdate!");
      router.push("/admin/opportunities");
    } else {
      alert("Gagal mengupdate: " + error.message);
    }

    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus kesempatan ini? Tindakan tidak dapat dibatalkan!")) return;

    const { error } = await supabase
      .from("opportunities")
      .delete()
      .eq("id", id);

    if (!error) {
      alert("✅ Kesempatan berhasil dihapus!");
      router.push("/admin/opportunities");
    } else {
      alert("Gagal menghapus: " + error.message);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-[600px] mx-auto p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Edit Kesempatan</h1>
              <p className="text-slate-400 text-sm">Ubah detail bounty atau program</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            className="p-2 rounded-full bg-rose-500/20 hover:bg-rose-500/30 transition-colors"
          >
            <Trash2 size={20} className="text-rose-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Judul */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Judul Kesempatan <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Deskripsi */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 resize-none"
              rows={3}
            />
          </div>

          {/* Icon */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Icon (Emoji)
            </label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-20 p-3 text-center text-2xl rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Kategori
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
            >
              <option value="general">Umum / Kesempatan Biasa</option>
              <option value="bounty_laporan">Bounty Laporan (Tayang di Feed)</option>
              <option value="bounty_konten">Bounty Konten (Marketplace)</option>
              <option value="program">Program Pendaftaran (Bakul/Ojek/Rewang)</option>
            </select>
          </div>

          {/* Reward */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Tipe Reward
              </label>
              <select
                value={formData.reward_type}
                onChange={(e) => setFormData({ ...formData, reward_type: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
              >
                <option value="points">Poin</option>
                <option value="money">Uang (Rp)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nilai Reward
              </label>
              <input
                type="number"
                value={formData.reward_value}
                onChange={(e) => setFormData({ ...formData, reward_value: parseInt(e.target.value) || 0 })}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                required
              />
            </div>
          </div>

          {/* Reward Text */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Teks Reward (Opsional)
            </label>
            <input
              type="text"
              value={formData.reward_text}
              onChange={(e) => setFormData({ ...formData, reward_text: e.target.value })}
              placeholder="Kosongkan untuk otomatis"
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm"
            />
          </div>

          {/* Quota & Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Kuota (0 = unlimited)
              </label>
              <input
                type="number"
                value={formData.quota}
                onChange={(e) => setFormData({ ...formData, quota: parseInt(e.target.value) || 0 })}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Deadline <span className="text-rose-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                required
              />
            </div>
          </div>

          {/* Status Aktif */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 accent-emerald-500"
            />
            <label htmlFor="is_active" className="text-sm text-slate-300">
              Aktifkan kesempatan ini (akan muncul di Rumah Warga)
            </label>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-all disabled:opacity-50"
            >
              {submitting ? "Menyimpan..." : "Simpan Perubahan →"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/opportunities")}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-bold transition-all"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}