"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import PromoForm from "./components/PromoForm";
import PromoHistory from "./components/PromoHistory";
import { Shield, Megaphone, History, BarChart3 } from "lucide-react";

export default function AdminPromoPage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        setUser(user);
        setIsAdmin(profile?.role === 'superadmin' || profile?.role === 'petinggi');
      }
      setLoading(false);
    };
    checkAdmin();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">Akses terbatas untuk admin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-5">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Megaphone size={24} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">📢 Manajemen Promo</h1>
            <p className="text-sm text-slate-400">Kirim promo tepat sasaran berdasarkan wilayah & segmentasi</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${
              activeTab === "create"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Megaphone size={16} />
            Buat Promo
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${
              activeTab === "history"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <History size={16} />
            Riwayat
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${
              activeTab === "analytics"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <BarChart3 size={16} />
            Analitik
          </button>
        </div>

        {/* Content */}
        {activeTab === "create" && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <PromoForm userId={user.id} isAdmin={isAdmin} />
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <PromoHistory />
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="text-center py-12">
              <BarChart3 size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Analitik promo akan segera hadir</p>
              <p className="text-slate-500 text-sm">Pantau performa setiap promo yang dikirim</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}