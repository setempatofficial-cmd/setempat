"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, Loader2, 
  Eye, Banknote, User, Calendar 
} from "lucide-react";

export default function AdminWithdrawPage() {
  const router = useRouter();
  const { user, isSuperAdmin, loading } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isSuperAdmin, router]);

  useEffect(() => {
    const fetchRequests = async () => {
      setLoadingData(true);
      const { data } = await supabase
        .from("withdraw_requests")
        .select(`
          *,
          profiles:user_id (full_name, username, email, phone)
        `)
        .order("created_at", { ascending: false });

      setRequests(data || []);
      setLoadingData(false);
    };

    fetchRequests();
  }, []);

  const handleProcess = async (request, action) => {
    setProcessing(true);
    
    const status = action === "approve" ? "processing" : "rejected";
    
    // 1. Update status withdraw request
    const { error: updateError } = await supabase
      .from("withdraw_requests")
      .update({
        status: status,
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        admin_note: adminNote || (action === "reject" ? "Ditolak oleh admin" : null)
      })
      .eq("id", request.id);

    if (!updateError && action === "approve") {
      // 2. Kurangi saldo user
      const { data: profile } = await supabase
        .from("profiles")
        .select("saldo")
        .eq("id", request.user_id)
        .single();

      await supabase
        .from("profiles")
        .update({ saldo: (profile?.saldo || 0) - request.amount })
        .eq("id", request.user_id);
      
      // 3. Update status jadi completed
      await supabase
        .from("withdraw_requests")
        .update({ status: "completed" })
        .eq("id", request.id);
    }

    alert(`✅ Penarikan ${action === "approve" ? "diproses" : "ditolak"}`);
    setSelectedRequest(null);
    setAdminNote("");
    window.location.reload();
    
    setProcessing(false);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processingRequests = requests.filter(r => r.status === "processing");
  const completedRequests = requests.filter(r => r.status === "completed");
  const rejectedRequests = requests.filter(r => r.status === "rejected");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-[1200px] mx-auto p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/admin/dashboard")} className="p-2 rounded-full bg-slate-800/50">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Penarikan Saldo</h1>
            <p className="text-slate-400 text-sm">Verifikasi dan proses permintaan tarik saldo warga</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingRequests.length}</p>
            <p className="text-[10px] text-slate-400">Menunggu</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{processingRequests.length}</p>
            <p className="text-[10px] text-slate-400">Diproses</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{completedRequests.length}</p>
            <p className="text-[10px] text-slate-400">Selesai</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-rose-400">{rejectedRequests.length}</p>
            <p className="text-[10px] text-slate-400">Ditolak</p>
          </div>
        </div>

        {/* Tabel Permintaan */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700">
                <tr>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">Warga</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">Bank</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">No. Rekening</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">Jumlah</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">Tgl Request</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">Status</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30">
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-medium text-white">{req.profiles?.full_name || "Warga"}</p>
                        <p className="text-xs text-slate-500">@{req.profiles?.username}</p>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">{req.bank_name || "-"}</td>
                    <td className="p-4 text-sm text-slate-300">{req.account_number || "-"}</td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-emerald-400">Rp{req.amount?.toLocaleString()}</p>
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                      {new Date(req.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-4">
                      {req.status === "pending" && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">Menunggu</span>}
                      {req.status === "processing" && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">Diproses</span>}
                      {req.status === "completed" && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Selesai</span>}
                      {req.status === "rejected" && <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded-full">Ditolak</span>}
                    </td>
                    <td className="p-4">
                      {req.status === "pending" && (
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="px-3 py-1.5 bg-emerald-600 rounded-lg text-white text-xs font-bold"
                        >
                          Proses
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Proses */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl max-w-[500px] w-full">
              <div className="p-4 border-b border-slate-800 flex justify-between">
                <h3 className="font-bold text-white">Proses Penarikan</h3>
                <button onClick={() => setSelectedRequest(null)} className="text-slate-400">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Warga</p>
                  <p className="text-sm font-bold text-white">{selectedRequest.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500">@{selectedRequest.profiles?.username}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/30 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Bank</p>
                    <p className="text-sm font-bold text-white">{selectedRequest.bank_name}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl p-3">
                    <p className="text-xs text-slate-400">No. Rekening</p>
                    <p className="text-sm font-bold text-white">{selectedRequest.account_number}</p>
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Jumlah Penarikan</p>
                  <p className="text-2xl font-bold text-emerald-400">Rp{selectedRequest.amount?.toLocaleString()}</p>
                </div>
                <textarea
                  placeholder="Catatan (opsional)"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                  rows={2}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleProcess(selectedRequest, "approve")}
                    disabled={processing}
                    className="flex-1 py-2 bg-emerald-600 rounded-xl text-white font-bold"
                  >
                    {processing ? "Memproses..." : "Setujui & Transfer"}
                  </button>
                  <button
                    onClick={() => handleProcess(selectedRequest, "reject")}
                    disabled={processing}
                    className="flex-1 py-2 bg-rose-600 rounded-xl text-white font-bold"
                  >
                    Tolak
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