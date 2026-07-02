"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Calendar, Users, Award, MapPin, HelpCircle, Lock, Unlock } from "lucide-react";
import PilihLokasi from "@/components/PilihLokasi";

export default function CreateOpportunityPage() {
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [targetAudience, setTargetAudience] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchUser, setSearchUser] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);

  // ✅ STATE UNTUK LOKASI TERKUNCI
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

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

  // Cek akses
  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isAdmin, isSuperAdmin, router]);

  // Cari user untuk target spesifik
  useEffect(() => {
    const searchUsers = async () => {
      if (searchUser.length < 2) {
        setUserSearchResults([]);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .ilike("full_name", `%${searchUser}%`)
        .limit(5);

      setUserSearchResults(data || []);
    };

    const delay = setTimeout(searchUsers, 300);
    return () => clearTimeout(delay);
  }, [searchUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

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
      created_by: user.id,
      created_at: new Date().toISOString(),
      // ✅ TAMBAHKAN LOKASI TERKUNCI
      is_location_locked: isLocationLocked,
      locked_location: isLocationLocked && selectedLocation ? selectedLocation : null
    };

    if (targetAudience !== "all") {
      opportunityData.target_audience = targetAudience;
      if (targetAudience === "specific_user" && selectedUser) {
        opportunityData.target_user_id = selectedUser.id;
      }
      if (targetAudience === "by_role") {
        opportunityData.target_role = "seller";
      }
    }

    const { error } = await supabase
      .from("opportunities")
      .insert([opportunityData]);

    if (!error) {
      alert("✅ Kesempatan berhasil dibuat!");
      router.push("/admin/opportunities");
    } else {
      alert("Gagal membuat kesempatan: " + error.message);
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-[600px] mx-auto p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Buat Kesempatan Baru</h1>
            <p className="text-slate-400 text-sm">Tambahkan bounty atau program untuk warga</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Target Audience */}
          <div className="bg-slate-800/30 rounded-xl p-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              🎯 Target Pengirim
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="all"
                  checked={targetAudience === "all"}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-sm text-slate-300">Semua Warga</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="by_role"
                  checked={targetAudience === "by_role"}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-sm text-slate-300">Berdasarkan Role (Bakul/Ojek/Rewang)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="specific_user"
                  checked={targetAudience === "specific_user"}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-sm text-slate-300">User Tertentu</span>
              </label>
            </div>

            {targetAudience === "specific_user" && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Cari nama user..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
                />
                {userSearchResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {userSearchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchUser(user.full_name);
                        }}
                        className="w-full p-2 text-left rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        <p className="text-sm text-slate-200">{user.full_name}</p>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400">✓ Target: {selectedUser.full_name}</p>
                  </div>
                )}
              </div>
            )}

            {targetAudience === "by_role" && (
              <div className="mt-3">
                <select className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm">
                  <option value="seller">Bakul (Seller)</option>
                  <option value="driver">Ojek (Driver)</option>
                  <option value="rewang">Rewang</option>
                  <option value="akamsi">Akamsi</option>
                </select>
              </div>
            )}
          </div>

          {/* Judul */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Judul Kesempatan <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Contoh: Dibutuhkan Video Kecelakaan di Bangil"
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
              placeholder="Jelaskan detail apa yang dibutuhkan..."
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
              placeholder="🎯"
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
                placeholder={formData.reward_type === "money" ? "50000" : "100"}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                required
              />
            </div>
          </div>

          {/* Reward Text (Opsional) */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Teks Reward (Opsional)
            </label>
            <input
              type="text"
              value={formData.reward_text}
              onChange={(e) => setFormData({ ...formData, reward_text: e.target.value })}
              placeholder="Kosongkan untuk otomatis (contoh: 100 Poin atau Rp50.000)"
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

          {/* ============================================ */}
          {/* ✅ LOKASI TERKUNCI (KHUSUS BOUNTY LAPORAN) */}
          {/* ============================================ */}
          {formData.category === "bounty_laporan" && (
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={14} />
                  Lokasi Terkunci
                </label>
                <button
                  type="button"
                  onClick={() => setIsLocationLocked(!isLocationLocked)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                    ${isLocationLocked
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                    }`}
                >
                  {isLocationLocked ? (
                    <>
                      <Lock size={12} />
                      Terkunci
                    </>
                  ) : (
                    <>
                      <Unlock size={12} />
                      Bebas
                    </>
                  )}
                </button>
              </div>

              {isLocationLocked ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400">
                    🔒 User akan melihat lokasi ini dan <span className="text-amber-400">tidak bisa mengubahnya</span>
                  </p>

                  {selectedLocation ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="text-emerald-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">{selectedLocation.name}</p>
                          {selectedLocation.alamat && (
                            <p className="text-[10px] text-slate-400 truncate">{selectedLocation.alamat}</p>
                          )}
                          {selectedLocation.latitude && selectedLocation.longitude && (
                            <p className="text-[8px] text-slate-500">
                              📍 {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                            </p>
                          )}
                          <p className="text-[8px] text-slate-500 mt-0.5">
                            {selectedLocation.source === 'nominatim' ? '🗺️ Dari Peta' : '📌 Dari Database'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedLocation(null)}
                          className="text-slate-400 hover:text-rose-400 transition-colors flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PilihLokasi
                      onSelect={(loc) => setSelectedLocation(loc)}
                      placeholder="Cari lokasi untuk dikunci..."
                      className="w-full"
                    />
                  )}

                  {!selectedLocation && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">
                      <p className="text-[8px] text-amber-400 text-center">
                        ⚠️ Pilih lokasi agar user tidak bisa mengubahnya
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-700/30 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 flex items-center gap-2">
                    <Unlock size={12} />
                    User akan bebas memilih lokasi sendiri saat mengirim laporan
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || (formData.category === "bounty_laporan" && isLocationLocked && !selectedLocation)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Menyimpan..." : "Buat Kesempatan →"}
          </button>

          {/* Validasi tambahan */}
          {formData.category === "bounty_laporan" && isLocationLocked && !selectedLocation && (
            <p className="text-[9px] text-amber-400 text-center">
              ⚠️ Pilih lokasi terlebih dahulu sebelum menyimpan
            </p>
          )}
        </form>
      </div>
    </div>
  );
}