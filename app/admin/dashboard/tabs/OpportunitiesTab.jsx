"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit, Trash2, Eye } from "lucide-react";

export default function OpportunitiesTab() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*")
        .order("created_at", { ascending: false });
      setOpportunities(data || []);
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Kesempatan Untuk Anda</h2>
        <button
          onClick={() => router.push("/admin/opportunities/create")}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 rounded-lg text-white text-sm"
        >
          <Plus size={14} /> Buat Baru
        </button>
      </div>
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700">
            <tr><th className="p-3 text-left text-xs text-slate-400">Judul</th><th className="p-3 text-left text-xs text-slate-400">Reward</th><th className="p-3 text-left text-xs text-slate-400">Status</th><th className="p-3 text-left text-xs text-slate-400">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {opportunities.map((opp) => (
              <tr key={opp.id}>
                <td className="p-3 text-sm text-white">{opp.title}</td>
                <td className="p-3 text-sm text-emerald-400">{opp.reward_text}</td>
                <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${opp.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{opp.is_active ? "Aktif" : "Nonaktif"}</span></td>
                <td className="p-3"><button onClick={() => router.push(`/admin/opportunities/${opp.id}/submissions`)} className="p-1 bg-slate-700 rounded"><Eye size={14} className="text-slate-300" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}