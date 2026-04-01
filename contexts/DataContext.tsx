"use client";

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface LaporanData {
  id: number;
  tempat_id: number;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  tipe: string; // 'Sepi', 'Ramai', 'Antri', 'Lalu Lintas'
  deskripsi: string;
  content?: string;
  photo_url?: string;
  video_url?: string;
  media_type: string;
  time_tag: string; // 'Pagi', 'Siang', 'Sore', 'Malam'
  created_at: string;
  status: string;
  // FIELD BARU untuk estimasi
  estimated_people?: number;
  estimated_wait_time?: number;
  // FIELD untuk lalu lintas
  traffic_condition?: string; // 'Lancar', 'Ramai', 'Macet'
}

// Interface untuk statistik yang lebih detail
interface TodayStats {
  ramai: number;
  sepi: number;        // 🔥 ubah dari tenang ke sepi
  antri: number;
  total: number;
  // Statistik tambahan untuk estimasi
  totalEstimatedPeople: number;
  avgEstimatedPeople: number;
  maxEstimatedPeople: number;
  // Statistik antrian
  antrianPendek: number;   // < 5 menit
  antrianSedang: number;   // 5-15 menit
  antrianPanjang: number;  // > 15 menit
  // Statistik lalu lintas
  laluLintas: {
    lancar: number;
    ramai: number;
    macet: number;
  };
}

// Interface untuk laporan terbaru dengan informasi estimasi
interface RecentReport extends LaporanData {
  isRecent: boolean;
  isFromWarga: boolean;
  estimasiDisplay?: string;
}

interface DataContextType {
  feedData: LaporanData[];
  setFeedData: (data: LaporanData[]) => void;
  viewedItems: Map<number, { timestamp: string; interaction: string }>;
  markAsViewed: (itemId: number, interaction?: string) => void;
  getAIContext: (tempatId?: number) => {
    recentReports: RecentReport[];
    todayStats: TodayStats;
    trendingCondition: string;
    lastUpdate: string;
    userViewedReports: LaporanData[];
    allReports: LaporanData[];
    // DATA BARU untuk estimasi
    latestEstimasi: {
      people: number | null;
      waitTime: number | null;
      condition: string | null;
      timestamp: string | null;
      isRecent: boolean;
    };
    // Laporan dengan estimasi
    reportsWithEstimasi: LaporanData[];
    // Ringkasan kondisi terkini
    currentCondition: {
      status: string;
      estimatedPeople: number | null;
      estimatedWaitTime: number | null;
      lastUpdate: string | null;
      badge: string;
      icon: string;
    };
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children, initialData = [] }: { children: React.ReactNode; initialData?: LaporanData[] }) {
  const [feedData, setFeedData] = useState<LaporanData[]>(initialData);
  const [viewedItems, setViewedItems] = useState<Map<number, { timestamp: string; interaction: string }>>(new Map());

  const markAsViewed = useCallback((itemId: number, interaction: string = 'view') => {
    setViewedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, {
        timestamp: new Date().toISOString(),
        interaction
      });
      return newMap;
    });
  }, []);

  const getUserViewedReports = useCallback(() => {
    const viewedIds = Array.from(viewedItems.keys());
    return feedData.filter(item => viewedIds.includes(item.id));
  }, [feedData, viewedItems]);

  const getAIContext = useCallback((tempatId?: number) => {
    const filteredData = tempatId 
      ? feedData.filter(item => item.tempat_id === tempatId)
      : feedData;
    
    const sortedData = [...filteredData].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayReports = filteredData.filter(item => 
      new Date(item.created_at) >= today
    );
    
    // ============================================
    // STATISTIK HARI INI
    // ============================================
    const reportsWithEstimasi = todayReports.filter(r => r.estimated_people !== undefined && r.estimated_people !== null);
    
    const totalEstimatedPeople = reportsWithEstimasi.reduce((sum, r) => sum + (r.estimated_people || 0), 0);
    const avgEstimatedPeople = reportsWithEstimasi.length > 0 
      ? Math.round(totalEstimatedPeople / reportsWithEstimasi.length) 
      : 0;
    const maxEstimatedPeople = reportsWithEstimasi.length > 0 
      ? Math.max(...reportsWithEstimasi.map(r => r.estimated_people || 0)) 
      : 0;
    
    const antrianReports = todayReports.filter(r => r.tipe === 'Antri');
    const antrianPendek = antrianReports.filter(r => (r.estimated_wait_time || 0) <= 5).length;
    const antrianSedang = antrianReports.filter(r => (r.estimated_wait_time || 0) > 5 && (r.estimated_wait_time || 0) <= 15).length;
    const antrianPanjang = antrianReports.filter(r => (r.estimated_wait_time || 0) > 15).length;
    
    // 🔥 Statistik lalu lintas
    const laluLintasReports = todayReports.filter(r => r.traffic_condition);
    const laluLintas = {
      lancar: laluLintasReports.filter(r => r.traffic_condition === 'Lancar').length,
      ramai: laluLintasReports.filter(r => r.traffic_condition === 'Ramai').length,
      macet: laluLintasReports.filter(r => r.traffic_condition === 'Macet').length
    };
    
    const stats: TodayStats = {
      ramai: todayReports.filter(r => r.tipe === 'Ramai').length,
      sepi: todayReports.filter(r => r.tipe === 'Sepi').length,  // 🔥 ubah dari tenang
      antri: antrianReports.length,
      total: todayReports.length,
      totalEstimatedPeople,
      avgEstimatedPeople,
      maxEstimatedPeople,
      antrianPendek,
      antrianSedang,
      antrianPanjang,
      laluLintas
    };
    
    // ============================================
    // TRENDING CONDITION
    // ============================================
    let trendingCondition = 'normal';
    if (stats.total > 0) {
      if (stats.antri > 0 && (stats.antri >= stats.ramai || stats.antri >= stats.sepi)) {
        trendingCondition = 'antri';
      } else if (stats.laluLintas.macet > 0) {
        trendingCondition = 'macet';
      } else {
        const max = Math.max(stats.ramai, stats.sepi, stats.antri);
        if (max === stats.ramai) trendingCondition = 'ramai';
        else if (max === stats.antri) trendingCondition = 'antri';
        else if (max === stats.sepi) trendingCondition = 'sepi';
      }
    }
    
    // ============================================
    // LAPORAN TERBARU
    // ============================================
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const recentReports: RecentReport[] = sortedData.slice(0, 10).map(report => {
      const createdDate = new Date(report.created_at);
      const isRecent = createdDate >= twoHoursAgo;
      const isFromWarga = !!report.user_id;
      
      let estimasiDisplay = '';
      if (report.estimated_people) {
        if (report.tipe === 'Antri' && report.estimated_wait_time) {
          estimasiDisplay = `Antri ${report.estimated_wait_time}m • ~${report.estimated_people} org`;
        } else if (report.tipe === 'Ramai') {
          estimasiDisplay = `~${report.estimated_people} org • Ramai`;
        } else if (report.tipe === 'Sepi') {
          estimasiDisplay = `~${report.estimated_people} org • Sepi`;
        } else {
          estimasiDisplay = `~${report.estimated_people} org`;
        }
      }
      
      return {
        ...report,
        isRecent,
        isFromWarga,
        estimasiDisplay
      };
    });
    
    // ============================================
    // DATA ESTIMASI TERBARU
    // ============================================
    const latestReportWithEstimasi = sortedData.find(r => r.estimated_people !== undefined && r.estimated_people !== null);
    const latestEstimasi = {
      people: latestReportWithEstimasi?.estimated_people || null,
      waitTime: latestReportWithEstimasi?.estimated_wait_time || null,
      condition: latestReportWithEstimasi?.tipe || null,
      timestamp: latestReportWithEstimasi?.created_at || null,
      isRecent: latestReportWithEstimasi ? new Date(latestReportWithEstimasi.created_at) >= twoHoursAgo : false
    };
    
    // ============================================
    // KONDISI TERKINI
    // ============================================
    const getCurrentConditionBadge = () => {
      if (!latestEstimasi.condition) {
        return { status: 'Normal', badge: '📍 Normal', icon: '📍' };
      }
      
      const condition = latestEstimasi.condition;
      const people = latestEstimasi.people;
      const waitTime = latestEstimasi.waitTime;
      
      if (condition === 'Antri') {
        if (waitTime && waitTime > 15) {
          return { status: 'Antri Panjang', badge: `🐢 Antri ${waitTime}m`, icon: '🐢' };
        } else if (waitTime && waitTime > 5) {
          return { status: 'Antri Sedang', badge: `⏱️ Antri ${waitTime}m`, icon: '⏱️' };
        } else if (waitTime) {
          return { status: 'Antri Pendek', badge: `⚡ Antri ${waitTime}m`, icon: '⚡' };
        }
        return { status: 'Ada Antrian', badge: '⏳ Ada Antrian', icon: '⏳' };
      }
      
      if (condition === 'Ramai') {
        if (people && people > 25) {
          return { status: 'Sangat Ramai', badge: '🔥 Sangat Ramai', icon: '🔥' };
        } else if (people && people > 12) {
          return { status: 'Ramai', badge: '👥 Ramai', icon: '👥' };
        }
        return { status: 'Ramai', badge: '🏃 Ramai', icon: '🏃' };
      }
      
      if (condition === 'Sepi') {
        return { status: 'Sepi', badge: '🍃 Sepi', icon: '🍃' };
      }
      
      return { status: 'Normal', badge: '📍 Normal', icon: '📍' };
    };
    
    const currentCondition = getCurrentConditionBadge();
    
    // ============================================
    // LAPORAN DENGAN ESTIMASI
    // ============================================
    const reportsWithEstimasiList = filteredData.filter(r => r.estimated_people !== undefined && r.estimated_people !== null);
    
    return {
      recentReports,
      todayStats: stats,
      trendingCondition,
      lastUpdate: sortedData[0]?.created_at || new Date().toISOString(),
      userViewedReports: getUserViewedReports(),
      allReports: filteredData,
      latestEstimasi,
      reportsWithEstimasi: reportsWithEstimasiList,
      currentCondition
    };
  }, [feedData, getUserViewedReports]);

  return (
    <DataContext.Provider value={{
      feedData,
      setFeedData,
      viewedItems,
      markAsViewed,
      getAIContext
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useDataContext must be used within DataProvider');
  return context;
}