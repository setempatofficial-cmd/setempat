"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

import { calculateReputasi } from "../utils/levelCalculator";
import { calculateImpactStatus, aggregateStats, calculatePoinSetempat } from "../utils/impactCalculator";
import { generateBadges } from "../utils/badgeCalculator";

// ============ HITUNG HARI AKTIF ============
const hitungHariAktif = (laporan) => {
  const uniqueDays = new Set();
  laporan.forEach(lap => {
    if (lap.created_at) {
      const date = new Date(lap.created_at).toDateString();
      uniqueDays.add(date);
    }
  });
  return uniqueDays.size;
};

// ============ HITUNG FOTO & VIDEO ============
const hitungMedia = (laporan) => {
  let foto = 0;
  let video = 0;
  laporan.forEach(lap => {
    if (lap.photo_url || lap.image_url) foto++;
    if (lap.video_url) video++;
  });
  return { foto, video };
};

// ============ FORMAT TANGGAL ============
function formatTanggal(tanggal) {
  if (!tanggal) return "Baru saja";
  const date = new Date(tanggal);
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ============ MAIN HOOK ============
export function useRumahWargaData(userId) {
  const [laporanTerbaru, setLaporanTerbaru] = useState([]);
  const [data, setData] = useState({
    reputasi: {
      skor: 0,
      level: 1,
      gelar: "🌱 Warga Baru",
      color: "text-green-400",
      bg: "bg-green-500/10",
      progress: 0,
      nextLevelSkor: 25
    },
    poinSetempat: 0,
    statistik: {
      totalLaporan: 0,
      totalFoto: 0,
      totalVideo: 0,
      hariAktif: 0,
      totalLikes: 0,
      totalViews: 0,
      featuredCount: 0,
      laporanRamai: 0,
      laporanBerdampak: 0
    },
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

      // ========== HITUNG LAPORAN BERDASARKAN JENIS ==========
      let laporanByTraffic = 0;
      let laporanByWeather = 0;
      let laporanByIncident = {};

      for (const lap of fetchedLaporan) {
        if (lap.traffic_condition) laporanByTraffic++;
        if (lap.incident_type === "cuaca" || lap.report_type === "cuaca") laporanByWeather++;

        // Hitung berdasarkan incident_type
        if (lap.incident_type) {
          laporanByIncident[lap.incident_type] = (laporanByIncident[lap.incident_type] || 0) + 1;
        }
      }

      // ========== 2. HITUNG TOTAL LIKE & VIEWS ==========
      let totalLikes = 0;
      let totalViews = 0;

      if (laporanIds.length > 0) {
        const { count: likesCount } = await supabase
          .from("likes_laporan")
          .select("id", { count: "exact", head: true })
          .in("laporan_id", laporanIds);
        totalLikes = likesCount || 0;

        const { count: viewsCount } = await supabase
          .from("story_views")
          .select("id", { count: "exact", head: true })
          .in("laporan_id", laporanIds);
        totalViews = viewsCount || 0;
      }

      // ========== 3. HITUNG LIKES & VIEWS PER LAPORAN ==========
      const likesMap = {};
      const viewsMap = {};

      if (laporanIds.length > 0) {
        const { data: likesPerLaporan } = await supabase
          .from("likes_laporan")
          .select("laporan_id")
          .in("laporan_id", laporanIds);

        const { data: viewsPerLaporan } = await supabase
          .from("story_views")
          .select("laporan_id")
          .in("laporan_id", laporanIds);

        (likesPerLaporan || []).forEach(like => {
          likesMap[like.laporan_id] = (likesMap[like.laporan_id] || 0) + 1;
        });

        (viewsPerLaporan || []).forEach(view => {
          viewsMap[view.laporan_id] = (viewsMap[view.laporan_id] || 0) + 1;
        });
      }

      // ========== 4. TAMBAHKAN LIKES & VIEWS KE LAPORAN ==========
      const laporanWithDetails = fetchedLaporan.map(lap => ({
        ...lap,
        likes: likesMap[lap.id] || 0,
        views: viewsMap[lap.id] || 0
      }));

      // ========== 5. METRIK DASAR ==========
      const totalLaporan = fetchedLaporan.length;
      const featuredCount = fetchedLaporan.filter(l => l.is_featured === true).length;
      const laporanRamai = fetchedLaporan.filter(l => (l.vibe_count || 0) >= 50).length;
      const { foto: totalFoto, video: totalVideo } = hitungMedia(fetchedLaporan);
      const hariAktif = hitungHariAktif(fetchedLaporan);

      // ========== 6. HITUNG STATISTIK DENGAN UTILS ==========
      const statistikHasil = aggregateStats(laporanWithDetails);

      // Tambahkan data laporan by traffic dan weather ke statistik
      statistikHasil.laporanByTraffic = laporanByTraffic;
      statistikHasil.laporanByWeather = laporanByWeather;

      // ========== 7. HITUNG POIN SETEMPAT ==========
      const poinSetempat = calculatePoinSetempat(
        fetchedLaporan,
        statistikHasil.totalLikes,
        statistikHasil.totalViews,
        statistikHasil.featuredCount
      );

      // ========== 8. HITUNG REPUTASI ==========
      const reputasiHasil = calculateReputasi(statistikHasil);

      // ========== 9. GENERATE BADGES ==========
      const badges = generateBadges(statistikHasil);

      // ========== 10. TAMBAHKAN ROLE BADGES ==========
      const [sellerData, driverData, rewangData] = await Promise.all([
        supabase.from("seller_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("driver_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("rewang_profiles").select("user_id").eq("user_id", userId).maybeSingle()
      ]);

      if (sellerData.data) badges.push({ id: "bakul", icon: "🛍", name: "Bakul Setempat", desc: "Aktif berdagang", category: "role" });
      if (driverData.data) badges.push({ id: "driver", icon: "🛵", name: "Ojek Setempat", desc: "Aktif mengantar", category: "role" });
      if (rewangData.data) badges.push({ id: "rewang", icon: "🤝", name: "Rewang Setempat", desc: "Aktif membantu", category: "role" });

      // ========== 11. FORMAT LAPORAN UNTUK TAMPILAN ==========
      const formattedLaporan = fetchedLaporan.slice(0, 6).map(lap => ({
        ...lap,
        lokasi_display: lap.tempat?.name || lap.lokasi_name || lap.lokasi_custom || "Lokasi Setempat"
      }));
      setLaporanTerbaru(formattedLaporan);

      // ========== 12. SET STATE ==========
      setData({
        reputasi: {
          skor: reputasiHasil.skor,
          level: reputasiHasil.level,
          gelar: reputasiHasil.gelar,
          color: reputasiHasil.color,
          bg: reputasiHasil.bg,
          progress: reputasiHasil.progress,
          nextLevelSkor: reputasiHasil.nextLevelSkor
        },
        poinSetempat: poinSetempat,
        statistik: {
          totalLaporan: statistikHasil.totalLaporan,
          totalFoto: statistikHasil.totalFoto,
          totalVideo: statistikHasil.totalVideo,
          hariAktif: statistikHasil.hariAktif,
          totalLikes: statistikHasil.totalLikes,
          totalViews: statistikHasil.totalViews,
          featuredCount: statistikHasil.featuredCount,
          laporanRamai: statistikHasil.laporanRamai,
          laporanBerdampak: statistikHasil.laporanBerdampak,
          laporanByTraffic: laporanByTraffic,
          laporanByWeather: laporanByWeather
        },
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
    data,
    loading,
    refetch: fetchData,
    formatTanggal
  };
}