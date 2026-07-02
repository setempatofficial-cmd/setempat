"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit, Trash2, Eye, Calendar, Users, Award, MapPin, Search, Filter } from "lucide-react";

export default function AdminOpportunitiesPage() {
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    pendingSubmissions: 0,
    totalRewardGiven: 0
  });

  // Cek akses (hanya admin atau superadmin)
  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isAdmin, isSuperAdmin, router]);

  // Fetch opportunities
  useEffect(() => {
    const fetchOpportunities = async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*")
        .order("created_at", { ascending: false });

      setOpportunities(data || []);
      setLoadingData(false);
    };

    fetchOpportunities();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      // Total submission dari bounty_submissions
      const { count: bountyCount } = await supabase
        .from("bounty_submissions")
        .select("*", { count: 'exact', head: true });

      // Total submission dari user_opportunities (program)
      const { count: programCount } = await supabase
        .from("user_opportunities")
        .select("*", { count: 'exact', head: true });

      // Pending submissions (bounty)
      const { count: pendingBounty } = await supabase
        .from("bounty_submissions")
        .select("*", { count: 'exact', head: true })
        .eq("status", "pending");

      // Total reward yang sudah diberikan (dari bounty yang approved)
      const { data: approvedBounties } = await supabase
        .from("bounty_submissions")
        .select("reward_value, reward_type")
        .eq("status", "approved");

      let totalReward = 0;
      approvedBounties?.forEach(b => {
        if (b.reward_type === 'money') {
          totalReward += b.reward_value || 0;
        }
      });

      setStats({
        totalSubmissions: (bountyCount || 0) + (programCount || 0),
        pendingSubmissions: pendingBounty || 0,
        totalRewardGiven: totalReward
      });
    };

    fetchStats();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus kesempatan ini?")) {
      await supabase.from("opportunities").delete().eq("id", id);
      setOpportunities(opportunities.filter(o => o.id !== id));
    }
  };

  // Filter opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    const matchSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === "all" || opp.category === filterType;
    return matchSearch && matchType;
  });

  if (loading || loadingData) {
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
      <div className="max-w-[1200px] mx-auto p-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Kesempatan Untuk Anda</h1>
            <p className="text-slate-400 text-sm mt-1">
              Kelola bounty, program, dan kesempatan khusus untuk warga
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Cari kesempatan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-[200px]"
              />
            </div>

            {/* Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Jenis</option>
              <option value="bounty_konten">🎬 Bounty Konten</option>
              <option value="bounty_laporan">📢 Bounty Laporan</option>
              <option value="program">📋 Program</option>
            </select>

            <button
              onClick={() => router.push("/admin/opportunities/submissions")}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold transition-all"
            >
              <Users size={18} />
              Lihat Submission
            </button>

            <button
              onClick={() => router.push("/admin/opportunities/create")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-all"
            >
              <Plus size={18} />
              Buat Kesempatan Baru
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Total Kesempatan</p>
            <p className="text-2xl font-bold text-white">{opportunities.length}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Aktif</p>
            <p className="text-2xl font-bold text-emerald-400">
              {opportunities.filter(o => o.is_active).length}
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 relative">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Total Submission</p>
            <p className="text-2xl font-bold text-blue-400">{stats.totalSubmissions}</p>
            {stats.pendingSubmissions > 0 && (
              <button
                onClick={() => router.push("/admin/opportunities/submissions?filter=pending")}
                className="absolute top-3 right-3 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                {stats.pendingSubmissions} menunggu →
              </button>
            )}
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Reward Dibagikan</p>
            <p className="text-2xl font-bold text-amber-400">
              Rp{stats.totalRewardGiven.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Daftar Kesempatan */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Tidak ada kesempatan ditemukan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Icon</th>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Judul</th>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Jenis</th>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Reward</th>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Deadline</th>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                    <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredOpportunities.map((opp) => (
                    <tr key={opp.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-2xl">{opp.icon || "🎯"}</td>
                      <td className="p-4">
                        <p className="text-sm font-bold text-slate-200">{opp.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{opp.description}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${opp.category === "bounty_laporan" ? "bg-emerald-500/20 text-emerald-400" :
                            opp.category === "bounty_konten" ? "bg-purple-500/20 text-purple-400" :
                              opp.title?.includes("Bakul") ? "bg-blue-500/20 text-blue-400" :
                                "bg-amber-500/20 text-amber-400"
                          }`}>
                          {opp.category === "bounty_laporan" ? "📢 Bounty Laporan" :
                            opp.category === "bounty_konten" ? "🎬 Bounty Konten" :
                              opp.title?.includes("Bakul") ? "🛍 Program Bakul" :
                                opp.title?.includes("Ojek") ? "🛵 Program Ojek" :
                                  opp.title?.includes("Rewang") ? "🤝 Program Rewang" :
                                    "🎁 Kesempatan"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-emerald-400">{opp.reward_text}</p>
                          {opp.reward_type === "money" && (
                            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">💰</span>
                          )}
                          {opp.reward_type === "point" && (
                            <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">⭐</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-xs text-slate-400">
                          {new Date(opp.deadline).toLocaleDateString('id-ID')}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${opp.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                          {opp.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/admin/opportunities/${opp.id}/submissions`)}
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Lihat Submission"
                          >
                            <Eye size={16} className="text-slate-400" />
                          </button>
                          <button
                            onClick={() => router.push(`/admin/opportunities/${opp.id}/edit`)}
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} className="text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(opp.id)}
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-red-500/20 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-xs text-slate-500 text-center">
          Menampilkan {filteredOpportunities.length} dari {opportunities.length} kesempatan
        </div>
      </div>
    </div>
  );
}