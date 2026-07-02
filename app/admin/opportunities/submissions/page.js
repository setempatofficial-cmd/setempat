"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft, Eye, CheckCircle, XCircle, Clock,
  Loader2, Download, ExternalLink, Users, Filter
} from "lucide-react";

export default function SubmissionsPage() {
  const router = useRouter();
  const { user, isSuperAdmin, loading } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Cek akses (hanya SuperAdmin)
  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isSuperAdmin, router]);

  // Ambil semua submission
  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoadingData(true);

      // Ambil dari bounty_submissions
      const { data: bountyData, error: bountyError } = await supabase
        .from("bounty_submissions")
        .select(`
          *,
          profiles:user_id (full_name, username, avatar_url),
          opportunities:opportunity_id (title, icon, reward_text, reward_type, reward_value)
        `)
        .order("submitted_at", { ascending: false });

      // Ambil dari user_opportunities (program pendaftaran)
      const { data: programData, error: programError } = await supabase
        .from("user_opportunities")
        .select(`
          *,
          profiles:user_id (full_name, username, avatar_url),
          opportunities:opportunity_id (title, icon, reward_text, reward_type, reward_value)
        `)
        .order("created_at", { ascending: false });

      if (!bountyError && bountyData) {
        const formattedBounty = bountyData.map(s => ({
          ...s,
          submission_type: "bounty",
          user_name: s.profiles?.full_name,
          user_username: s.profiles?.username,
          user_avatar: s.profiles?.avatar_url,
          opportunity_title: s.opportunities?.title,
          opportunity_icon: s.opportunities?.icon,
          reward_text: s.opportunities?.reward_text,
          reward_type: s.opportunities?.reward_type || s.reward_type,
          reward_value: s.opportunities?.reward_value || s.reward_value,
          submitted_at: s.submitted_at,
          media_url: s.media_url,
          media_type: s.media_type,
          description: s.description
        }));

        const formattedProgram = (programData || []).map(s => ({
          ...s,
          submission_type: "program",
          user_name: s.profiles?.full_name,
          user_username: s.profiles?.username,
          user_avatar: s.profiles?.avatar_url,
          opportunity_title: s.opportunities?.title,
          opportunity_icon: s.opportunities?.icon,
          reward_text: s.opportunities?.reward_text,
          reward_type: s.opportunities?.reward_type,
          reward_value: s.opportunities?.reward_value,
          submitted_at: s.created_at,
          media_url: null,
          media_type: null,
          description: null
        }));

        setSubmissions([...formattedBounty, ...formattedProgram]);
      } else {
        setSubmissions([]);
      }

      setLoadingData(false);
    };

    fetchSubmissions();
  }, []);

  // ✅ PERBAIKAN: Hanya update status, biarkan trigger yang handle reward
  const handleApprove = async (submission) => {
    setProcessing(true);

    if (submission.submission_type === "bounty") {
      // CUKUP UPDATE STATUS SAJA!
      // Trigger database akan otomatis memberikan reward (baik point maupun money)
      const { error } = await supabase
        .from("bounty_submissions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          admin_note: "Disetujui oleh SuperAdmin"
        })
        .eq("id", submission.id);

      if (!error) {
        // ❌ HAPUS SEMUA KODE MANUAL UPDATE REWARD DI SINI!
        // Biarkan trigger database yang handle sesuai reward_type

        const rewardText = submission.reward_type === "money"
          ? `Rp${submission.reward_value?.toLocaleString()} akan masuk ke Dompet Warga`
          : `${submission.reward_value} Poin akan ditambahkan`;

        alert(`✅ Submission disetujui! ${rewardText}`);
        window.location.reload();
      } else {
        alert("Gagal menyetujui: " + error.message);
      }
    } else {
      // Untuk program, update status user_opportunities
      const { error } = await supabase
        .from("user_opportunities")
        .update({
          status: "approved",
          completed_at: new Date().toISOString()
        })
        .eq("id", submission.id);

      if (!error) {
        alert("✅ Program disetujui!");
        window.location.reload();
      } else {
        alert("Gagal menyetujui: " + error.message);
      }
    }

    setProcessing(false);
  };

  const handleReject = async (submission) => {
    setProcessing(true);

    const table = submission.submission_type === "bounty"
      ? "bounty_submissions"
      : "user_opportunities";

    const { error } = await supabase
      .from(table)
      .update({
        status: "rejected",
        admin_note: "Ditolak oleh SuperAdmin"
      })
      .eq("id", submission.id);

    if (!error) {
      alert("❌ Submission ditolak.");
      window.location.reload();
    } else {
      alert("Gagal menolak: " + error.message);
    }

    setProcessing(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <span className="text-[8px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={8} /> Disetujui</span>;
      case "rejected":
        return <span className="text-[8px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle size={8} /> Ditolak</span>;
      default:
        return <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={8} /> Menunggu</span>;
    }
  };

  // ✅ Tambahkan badge reward type
  const getRewardBadge = (type) => {
    if (type === "money") {
      return <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">💰</span>;
    } else if (type === "point") {
      return <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">⭐</span>;
    }
    return null;
  };

  const filteredSubmissions = submissions.filter(s => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-[1200px] mx-auto p-5">
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
              <h1 className="text-2xl font-bold text-white">Submission Kesempatan</h1>
              <p className="text-slate-400 text-sm">Lihat dan verifikasi kiriman warga</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="all">Semua</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{submissions.length}</p>
            <p className="text-[10px] text-slate-400">Total Submission</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">
              {submissions.filter(s => s.status === "pending").length}
            </p>
            <p className="text-[10px] text-slate-400">Menunggu</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {submissions.filter(s => s.status === "approved").length}
            </p>
            <p className="text-[10px] text-slate-400">Disetujui</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-rose-400">
              {submissions.filter(s => s.status === "rejected").length}
            </p>
            <p className="text-[10px] text-slate-400">Ditolak</p>
          </div>
        </div>

        {/* Tabel Submission */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700">
                <tr>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">User</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Kesempatan</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Jenis</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Reward</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Tgl Kirim</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {sub.user_avatar ? (
                          <img src={sub.user_avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                            <Users size={14} className="text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{sub.user_name || "Warga"}</p>
                          <p className="text-xs text-slate-500">@{sub.user_username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{sub.opportunity_icon || "🎯"}</span>
                        <p className="text-sm text-slate-200 line-clamp-1">{sub.opportunity_title}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${sub.submission_type === "bounty"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-blue-500/20 text-blue-400"
                        }`}>
                        {sub.submission_type === "bounty" ? "Bounty" : "Program"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-emerald-400">{sub.reward_text}</p>
                        {getRewardBadge(sub.reward_type)}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-slate-400">
                        {new Date(sub.submitted_at).toLocaleDateString('id-ID')}
                      </p>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(sub.status)}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye size={14} className="text-slate-400" />
                        </button>
                        {sub.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(sub)}
                              disabled={processing}
                              className="p-1.5 bg-emerald-500/20 rounded-lg hover:bg-emerald-500/30 transition-colors"
                              title="Setujui"
                            >
                              <CheckCircle size={14} className="text-emerald-400" />
                            </button>
                            <button
                              onClick={() => handleReject(sub)}
                              disabled={processing}
                              className="p-1.5 bg-rose-500/20 rounded-lg hover:bg-rose-500/30 transition-colors"
                              title="Tolak"
                            >
                              <XCircle size={14} className="text-rose-400" />
                            </button>
                          </>
                        )}
                        {sub.media_url && (
                          <a
                            href={sub.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Lihat Media"
                          >
                            <ExternalLink size={14} className="text-slate-400" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedSubmission && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDetailModal(false)}>
            <div className="bg-slate-900 rounded-2xl max-w-[500px] w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center">
                <h3 className="font-bold text-white">Detail Submission</h3>
                <button onClick={() => setShowDetailModal(false)} className="p-1 rounded-full bg-slate-800">
                  <ArrowLeft size={16} className="text-slate-400" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedSubmission.opportunity_icon}</span>
                  <div>
                    <p className="font-bold text-white">{selectedSubmission.opportunity_title}</p>
                    <p className="text-xs text-slate-400">Oleh: {selectedSubmission.user_name}</p>
                  </div>
                </div>

                <div className="bg-slate-800/30 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Deskripsi</p>
                  <p className="text-sm text-slate-300">{selectedSubmission.description || "Tidak ada deskripsi"}</p>
                </div>

                {selectedSubmission.media_url && (
                  <div className="bg-slate-800/30 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">Media</p>
                    {selectedSubmission.media_type === "image" ? (
                      <img src={selectedSubmission.media_url} className="rounded-lg max-h-[300px] w-auto mx-auto" alt="submission" />
                    ) : (
                      <video src={selectedSubmission.media_url} controls className="rounded-lg max-h-[300px] w-full" />
                    )}
                    <a href={selectedSubmission.media_url} target="_blank" className="text-xs text-emerald-400 mt-2 inline-flex items-center gap-1">
                      <Download size={12} /> Download file
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/30 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Reward</p>
                    <p className="text-lg font-bold text-emerald-400">{selectedSubmission.reward_text}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {selectedSubmission.reward_type === "money" ? "💰 Dompet Warga" : "⭐ Poin"}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Status</p>
                    {getStatusBadge(selectedSubmission.status)}
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  {selectedSubmission.status === "pending" && (
                    <>
                      <button
                        onClick={() => {
                          handleApprove(selectedSubmission);
                          setShowDetailModal(false);
                        }}
                        className="flex-1 py-2 bg-emerald-600 rounded-xl text-white font-bold"
                      >
                        Setujui & Beri Reward
                      </button>
                      <button
                        onClick={() => {
                          handleReject(selectedSubmission);
                          setShowDetailModal(false);
                        }}
                        className="flex-1 py-2 bg-rose-600 rounded-xl text-white font-bold"
                      >
                        Tolak
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="flex-1 py-2 bg-slate-800 rounded-xl text-slate-300 font-bold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}