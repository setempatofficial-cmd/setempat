// hooks/useBreakCardGenerator.js

import { useCallback, useRef } from "react";

export const useBreakCardGenerator = ({
  kentonganForFeed,
  onOpenAIModal,
  onOpenLaporanForm
}) => {
  const previousConditionsRef = useRef({});
  const lastBreakTimeRef = useRef(Date.now());

  const generateBreakCard = useCallback((scrollIndex, displayedPlaces, allPlaces) => {
    // Urgent Kentongan
    const urgentKentongan = kentonganForFeed.filter(k => k.is_urgent === true);
    if (urgentKentongan.length > 0 && scrollIndex >= 1) {
      const k = urgentKentongan[0];
      return {
        type: "kentongan",
        level: "A",
        data: {
          title: k.title,
          text: `🚨 ${k.title}`,
          is_urgent: true,
          target_desa: k.target_desa,
          is_global: k.is_global,
          content: k.content,
          image_url: k.image_url,
        },
        onClick: () => onOpenAIModal(k),
      };
    }

    // Normal Kentongan
    const normalKentongan = kentonganForFeed.filter(k => !k.is_urgent);
    if (normalKentongan.length > 0 && scrollIndex >= 2) {
      const idx = Math.floor(scrollIndex / 5) % normalKentongan.length;
      const k = normalKentongan[idx];
      return {
        type: "kentongan",
        level: "B",
        data: {
          title: k.title,
          text: k.title,
          is_urgent: false,
          target_desa: k.target_desa,
          is_global: k.is_global,
          content: k.content,
          image_url: k.image_url,
          created_at: k.created_at,
        },
        onClick: () => onOpenAIModal(k),
      };
    }

    // Recent reports statistic
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = allPlaces.reduce((acc, p) => {
      const reports = (p.laporan_terbaru || []).filter(l => new Date(l.created_at) > oneHourAgo);
      return acc + reports.length;
    }, 0);

    if (recentReports > 5) {
      return {
        type: "statistic",
        level: "B",
        data: { text: `👥 Banyak laporan masuk dalam 1 jam terakhir (${recentReports} laporan)` },
      };
    }

    // Activity change detection
    let hasSignificantChange = false;
    let changeText = "";
    for (const place of displayedPlaces) {
      const prev = previousConditionsRef.current[place.id];
      const curr = place.isRamai ? "ramai" : (place.isViral ? "viral" : "normal");
      if (prev === "sepi" && curr === "ramai") {
        hasSignificantChange = true;
        changeText = `🔥 Aktivitas mulai meningkat di ${place.name}`;
        break;
      }
      previousConditionsRef.current[place.id] = curr;
    }

    if (hasSignificantChange) {
      return {
        type: "area-summary",
        level: "B",
        data: { text: changeText },
      };
    }

    // Silent places
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const silentPlaces = displayedPlaces.filter(p => {
      const latest = p.laporan_terbaru?.[0];
      return !latest || new Date(latest.created_at) < threeHoursAgo;
    });

    if (silentPlaces.length > 2) {
      return {
        type: "trigger-action",
        level: "A",
        data: { text: "😶 Belum ada update terbaru di sekitar, kamu bisa jadi yang pertama" },
        onClick: onOpenLaporanForm,
      };
    }

    // Scroll-based break
    if (scrollIndex >= 8) {
      return {
        type: "heatmap-text",
        level: "B",
        data: { text: "📍 Kamu sudah melihat beberapa lokasi, cek area lain?" },
      };
    }

    // Time divider
    const now = Date.now();
    if (now - lastBreakTimeRef.current > 15 * 60 * 1000) {
      lastBreakTimeRef.current = now;
      const hours = new Date().getHours();
      const minutes = new Date().getMinutes();
      return {
        type: "time-divider",
        level: "C",
        data: { label: `Update ${hours}:${minutes.toString().padStart(2, '0')}` },
      };
    }

    // Daily statistics
    const totalLaporanHariIni = allPlaces.reduce((acc, p) => {
      const todayReports = (p.laporan_terbaru || []).filter(l => {
        const lDate = new Date(l.created_at);
        return lDate.toDateString() === new Date().toDateString();
      }).length;
      return acc + todayReports;
    }, 0);

    return {
      type: "statistic",
      level: "B",
      data: { text: `📊 ${allPlaces.length} lokasi aktif · ${totalLaporanHariIni} laporan hari ini` },
    };
  }, [kentonganForFeed, onOpenAIModal, onOpenLaporanForm]);

  return {
    generateBreakCard,
    openAIModalWithKentongan: onOpenAIModal,
  };
};