"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

// ============ HELPER FUNCTIONS ============
function calculateLevel(totalReports) {
  if (totalReports >= 500) return { level: 10, progress: 100, nextReq: 500, reportsLeft: 0 };
  if (totalReports >= 100) return { level: 5, progress: ((totalReports - 100) / 400) * 100, nextReq: 500, reportsLeft: 500 - totalReports };
  if (totalReports >= 50) return { level: 4, progress: ((totalReports - 50) / 50) * 100, nextReq: 100, reportsLeft: 100 - totalReports };
  if (totalReports >= 20) return { level: 3, progress: ((totalReports - 20) / 30) * 100, nextReq: 50, reportsLeft: 50 - totalReports };
  if (totalReports >= 5) return { level: 2, progress: ((totalReports - 5) / 15) * 100, nextReq: 20, reportsLeft: 20 - totalReports };
  return { level: 1, progress: (totalReports / 5) * 100, nextReq: 5, reportsLeft: 5 - totalReports };
}

function getGelarAkamsi(level) {
  if (level >= 10) return { title: "🏆 Akamsi Teladan", color: "text-rose-400", bg: "bg-rose-500/10" };
  if (level >= 5) return { title: "🌳 Akamsi Andal", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (level >= 3) return { title: "🌿 Akamsi Aktif", color: "text-sky-400", bg: "bg-sky-500/10" };
  return { title: "🌱 Akamsi Pemula", color: "text-amber-400", bg: "bg-amber-500/10" };
}

function formatTanggal(tanggal) {
  if (!tanggal) return "Baru saja";
  const date = new Date(tanggal);
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function useRumahWargaData(userId) {
  const [laporanTerbaru, setLaporanTerbaru] = useState([]);
  const [kontribusi, setKontribusi] = useState({
    totalLaporan: 0,
    totalLikes: 0,
    totalViews: 0,
    featuredCount: 0,
    laporanRamai: 0,
    laporanBerdampak: 0,
    levelInfo: { level: 1, progress: 0, nextReq: 5, reportsLeft: 5 },
    gelar: { title: "🌱 Akamsi Pemula", color: "text-amber-400", bg: "bg-amber-500/10" },
    badges: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // ========== 1. AMBIL SEMUA LAPORAN USER ==========
      const { data: laporan, error } = await supabase
        .from("laporan_warga")
        .select(`
          id, 
          created_at, 
          deskripsi, 
          status, 
          is_featured, 
          image_url, 
          photo_url, 
          traffic_condition, 
          lokasi_name,
          lokasi_custom,
          tempat_id,
          user_name,
          user_avatar,
          video_url,
          vibe_count,
          tempat:tempat_id (id, name, alamat, category)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const fetchedLaporan = laporan || [];
      const laporanIds = fetchedLaporan.map(l => l.id).filter(Boolean);

      // ========== 2. HITUNG TOTAL LIKE & VIEWS DALAM 1 QUERY ==========
      let totalLikes = 0;
      let totalViews = 0;

      if (laporanIds.length > 0) {
        // Ambil semua likes sekaligus
        const { count: likesCount } = await supabase
          .from("likes_laporan")
          .select("id", { count: "exact", head: true })
          .in("laporan_id", laporanIds);
        totalLikes = likesCount || 0;

        // Ambil semua views sekaligus
        const { count: viewsCount } = await supabase
          .from("story_views")
          .select("id", { count: "exact", head: true })
          .in("laporan_id", laporanIds);
        totalViews = viewsCount || 0;
      }

      // ========== 3. HITUNG LAPORAN BERDAMPAK (AGGREGATE QUERY) ==========
      // Query untuk mendapat likes dan views per laporan sekaligus
      let laporanBerdampak = 0;

      if (laporanIds.length > 0) {
        // Ambil likes per laporan
        const { data: likesPerLaporan } = await supabase
          .from("likes_laporan")
          .select("laporan_id", { count: "exact" })
          .in("laporan_id", laporanIds);

        // Ambil views per laporan
        const { data: viewsPerLaporan } = await supabase
          .from("story_views")
          .select("laporan_id", { count: "exact" })
          .in("laporan_id", laporanIds);

        // Hitung likes dan views per laporan
        const likesMap = {};
        const viewsMap = {};

        (likesPerLaporan || []).forEach(like => {
          likesMap[like.laporan_id] = (likesMap[like.laporan_id] || 0) + 1;
        });

        (viewsPerLaporan || []).forEach(view => {
          viewsMap[view.laporan_id] = (viewsMap[view.laporan_id] || 0) + 1;
        });

        // Hitung laporan berdampak
        for (const lap of fetchedLaporan) {
          const likes = likesMap[lap.id] || 0;
          const views = viewsMap[lap.id] || 0;
          if (views >= 100 || likes >= 10 || lap.is_featured === true) {
            laporanBerdampak++;
          }
        }
      }

      // ========== 4. METRIK LAINNYA ==========
      const totalLaporan = fetchedLaporan.length;
      const featuredCount = fetchedLaporan.filter(l => l.is_featured === true).length;
      const laporanRamai = fetchedLaporan.filter(l => (l.vibe_count || 0) >= 50).length;

      // ========== 5. FORMAT LAPORAN ==========
      const formattedLaporan = fetchedLaporan.slice(0, 6).map(lap => ({
        ...lap,
        lokasi_display: lap.tempat?.name || lap.lokasi_name || lap.lokasi_custom || "Lokasi Setempat"
      }));
      setLaporanTerbaru(formattedLaporan);

      // ========== 6. LEVEL & GELAR ==========
      const levelInfo = calculateLevel(totalLaporan);
      const gelar = getGelarAkamsi(levelInfo.level);

      // ========== 7. BADGES ==========
      const badges = [];
      if (totalLikes >= 10) badges.push({ id: "diapresiasi", icon: "❤️", title: "Diapresiasi Warga", desc: `${totalLikes} like` });
      if (totalViews >= 100) badges.push({ id: "dikenal", icon: "👁", title: "Dikenal Warga", desc: `${totalViews} views` });
      if (featuredCount >= 1) badges.push({ id: "sorotan", icon: "⭐", title: "Sorotan Setempat", desc: `${featuredCount} laporan` });
      if (laporanRamai >= 1) badges.push({ id: "ramai", icon: "🔥", title: "Laporan Ramai", desc: `${laporanRamai} laporan` });
      if (laporanBerdampak >= 1) badges.push({ id: "berdampak", icon: "🏆", title: "Laporan Berdampak", desc: `${laporanBerdampak} laporan` });

      // Role badges
      const [sellerData, driverData, rewangData] = await Promise.all([
        supabase.from("seller_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("driver_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("rewang_profiles").select("user_id").eq("user_id", userId).maybeSingle()
      ]);

      if (sellerData.data) badges.push({ id: "bakul", icon: "🛍", title: "Bakul Setempat", desc: "Aktif berdagang" });
      if (driverData.data) badges.push({ id: "driver", icon: "🛵", title: "Ojek Setempat", desc: "Aktif mengantar" });
      if (rewangData.data) badges.push({ id: "rewang", icon: "🤝", title: "Rewang Setempat", desc: "Aktif membantu" });

      setKontribusi({
        totalLaporan,
        totalLikes,
        totalViews,
        featuredCount,
        laporanRamai,
        laporanBerdampak,
        levelInfo,
        gelar,
        badges
      });

    } catch (err) {
      console.error("❌ Error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    laporanTerbaru,
    kontribusi,
    loading,
    refetch: fetchData,
    formatTanggal
  };
}