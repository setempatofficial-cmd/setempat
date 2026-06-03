"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export default function WithdrawTab() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("withdraw_requests")
        .select(`*, profiles:user_id (full_name, username)`)
        .order("created_at", { ascending: false });
      setRequests(data || []);
    };
    fetchData();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved": return <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Selesai</span>;
      case "processing": return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">Diproses</span>;
      case "rejected": return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">Ditolak</span>;
      default: return <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">Menunggu</span>;
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Penarikan Saldo</h2>
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700">
            <tr><th className="p-3 text-left text-xs text-slate-400">Warga</th><th className="p-3 text-left text-xs text-slate-400">Jumlah</th><th className="p-3 text-left text-xs text-slate-400">Bank</th><th className="p-3 text-left text-xs text-slate-400">Status</th><th className="p-3 text-left text-xs text-slate-400">Tgl</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {requests.map((req) => (
              <tr key={req.id}>
                <td className="p-3"><p className="text-sm text-white">{req.profiles?.full_name}</p><p className="text-xs text-slate-500">@{req.profiles?.username}</p></td>
                <td className="p-3 text-sm text-emerald-400">Rp{req.amount?.toLocaleString()}</td>
                <td className="p-3 text-sm text-slate-300">{req.bank_name} - {req.account_number}</td>
                <td className="p-3">{getStatusBadge(req.status)}</td>
                <td className="p-3 text-sm text-slate-400">{new Date(req.created_at).toLocaleDateString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}