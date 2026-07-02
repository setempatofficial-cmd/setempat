"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Clock, Users, Eye, MousePointer, CheckCircle, ArrowRight } from "lucide-react";

export default function PromoHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromo, setSelectedPromo] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("promo_notifications")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);
      
      setHistory(data || []);
      setLoading(false);
    };
    fetchHistory();
  }, []);

  const fetchStats = async (promoId: string) => {
    const { data } = await supabase
      .from("promo_recipients")
      .select("*")
      .eq("promo_id", promoId);

    const total = data?.length || 0;
    const read = data?.filter(d => d.is_read).length || 0;
    const clicked = data?.filter(d => d.clicked_at).length || 0;
    const converted = data?.filter(d => d.converted_at).length || 0;

    setStats({
      total,
      read,
      clicked,
      converted,
      readRate: total > 0 ? (read / total * 100).toFixed(1) : 0,
      clickRate: total > 0 ? (clicked / total * 100).toFixed(1) : 0,
      conversionRate: total > 0 ? (converted / total * 100).toFixed(1) : 0
    });
  };

  const handleSelect = (promoId: string) => {
    if (selectedPromo === promoId) {
      setSelectedPromo(null);
      setStats(null);
    } else {
      setSelectedPromo(promoId);
      fetchStats(promoId);
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Memuat riwayat...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
          <Clock size={24} className="text-slate-600" />
        </div>
        <p className="text-slate-400 text-sm">Belum ada promo yang dikirim</p>
        <p className="text-slate-500 text-xs">Mulai kirim promo pertama Anda!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((promo) => (
        <div
          key={promo.id}
          className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden"
        >
          <button
            onClick={() => handleSelect(promo.id)}
            className="w-full p-4 text-left hover:bg-slate-800/30 transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-bold text-sm">{promo.title}</p>
                <p className="text-slate-400 text-xs line-clamp-1">{promo.message}</p>
              </div>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock size={12} />
                {new Date(promo.sent_at).toLocaleDateString('id-ID')}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                ${promo.promo_type === 'live' ? 'bg-red-500/20 text-red-400' :
                  promo.promo_type === 'video' ? 'bg-blue-500/20 text-blue-400' :
                  promo.promo_type === 'product' ? 'bg-amber-500/20 text-amber-400' :
                  promo.promo_type === 'voucher' ? 'bg-emerald-500/20 text-emerald-400' :
                  promo.promo_type === 'subscription' ? 'bg-purple-500/20 text-purple-400' :
                  promo.promo_type === 'discount' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-slate-500/20 text-slate-400'}`}
              >
                {promo.promo_type.toUpperCase()}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Users size={12} />
                {promo.target_type}
              </span>
              {promo.target_city && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <MapPin size={12} />
                  {promo.target_city}
                </span>
              )}
            </div>
          </button>

          {/* Stats Detail (Expanded) */}
          {selectedPromo === promo.id && stats && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-700">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">Dibaca</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {stats.read} <span className="text-xs">({stats.readRate}%)</span>
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">Diklik</p>
                  <p className="text-lg font-bold text-blue-400">
                    {stats.clicked} <span className="text-xs">({stats.clickRate}%)</span>
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">Konversi</p>
                  <p className="text-lg font-bold text-purple-400">
                    {stats.converted} <span className="text-xs">({stats.conversionRate}%)</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Tambahkan MapPin import
import { MapPin } from "lucide-react";