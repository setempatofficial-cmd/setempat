// hooks/useAIInsight.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { aiInsightCache } from '@/lib/aiInsightCache';
import { getIndonesianTimeLabel, getTimeInfo } from '@/utils/timeUtils';
import { generateRingkasanMultiUser } from '@/lib/generateRingkasanMultiUser';

export function useAIInsight(activeTempat) {
  const [greeting, setGreeting] = useState('');
  const [story, setStory] = useState('');
  const [insightStats, setInsightStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelUsed, setModelUsed] = useState('local');
  const [storyVersion, setStoryVersion] = useState(0);
  const [richContext, setRichContext] = useState({
    metadata: null,
    aktivitasBerkala: [],
    insidenHistoris: [],
    tempatTerhubung: [],
    layananTersedia: [],
    layananWarga: [],
    bantuanTersedia: [],
    umkmProduk: [],
    aktivitasWarga: [],
    prediksi: [],
    laporanWarga: [],
    externalSignals: []
  });

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const getTimeGreeting = useCallback(() => {
    const timeLabel = getIndonesianTimeLabel();
    const timeInfo = getTimeInfo();
    const greetingMap = { Pagi: 'Selamat pagi', Siang: 'Selamat siang', Sore: 'Selamat sore', Malam: 'Selamat malam' };
    return { text: greetingMap[timeLabel] || 'Selamat siang', icon: timeInfo.icon, isMalam: timeLabel === 'Malam' };
  }, []);

  function formatTimeAgo(dateString) {
    if (!dateString) return 'beberapa waktu lalu';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays === 1) return 'kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function formatTimeAgoDetailed(dateString) {
    if (!dateString) return 'waktu tidak diketahui';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 2) return 'baru saja (kurang dari 2 menit yang lalu)';
    if (diffMins < 5) return 'beberapa menit yang lalu';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) {
      if (diffHours === 1) return 'sekitar 1 jam yang lalu';
      return `${diffHours} jam yang lalu`;
    }
    if (diffDays === 1) return 'kemarin';
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    if (diffDays < 28) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} minggu yang lalu`;
    }
    return `pada ${past.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  // ============================================
  // 1. FUNGSI DETEKSI DARURAT
  // ============================================
  function isEmergency(context) {
    const { laporanWarga, externalSignals } = context;
    const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir bandang', 'kebakaran'];

    const allTexts = [
      ...(laporanWarga || []).map(l => l.deskripsi || l.content || ''),
      ...(externalSignals || []).map(s => s.content || '')
    ].join(' ').toLowerCase();

    return emergencyKeywords.some(kw => allTexts.includes(kw));
  }

  // ============================================
  // 2. FUNGSI BUILD UNTUK SETIAP GAYA (7 FUNGSI)
  // ============================================

  function buildLaporanStory(ctx, tempatName, formatTimeAgo) {
    const { laporanWarga, externalSignals } = ctx;
    let story = '';

    if (laporanWarga?.length > 0) {
      story += `📢 **Cerita dari Warga ${tempatName}**\n\n`;
      laporanWarga.slice(0, 3).forEach(l => {
        const waktu = formatTimeAgo(l.created_at);
        story += `💬 "${l.deskripsi?.substring(0, 120)}"\n`;
        story += `   — @${l.username || 'warga'}, ${waktu}\n\n`;
      });
    } else {
      story += `📢 **Belum ada laporan**\n\n`;
      story += `Ayo jadi yang pertama laporin kondisi di ${tempatName}! 📝\n\n`;
    }

    story += `✨ Mau tahu lebih? Refresh untuk cerita lain! 🔄`;
    return story;
  }

  function buildKonteksStory(ctx, tempatName) {
    const { tempatTerhubung } = ctx;
    let story = '';

    if (tempatTerhubung?.length > 0) {
      const tempatPengaruh = tempatTerhubung.filter(t =>
        t.tempat_terkait?.latest_condition === 'MACET' ||
        t.tempat_terkait?.latest_condition === 'RAMAI'
      );

      if (tempatPengaruh.length > 0) {
        story += `🔗 **${tempatName} & Sekitarnya**\n\n`;
        tempatPengaruh.forEach(t => {
          const kondisi = t.tempat_terkait?.latest_condition === 'MACET' ? 'macet' : 'ramai';
          story += `📍 ${t.tempat_terkait?.name} (${t.jarak_km}km) sedang ${kondisi}.\n`;
          story += `   Ini berpengaruh ke ${tempatName}.\n\n`;
        });
      } else {
        story += `🔗 **${tempatName} & Sekitarnya**\n\n`;
        story += `Tempat-tempat di sekitar ${tempatName} terpantau normal semua.\n\n`;
      }
    } else {
      story += `🔗 **${tempatName} & Sekitarnya**\n\n`;
      story += `Belum ada data tempat terhubung.\n\n`;
    }

    story += `✨ Refresh untuk cerita berbeda! 🔄`;
    return story;
  }

  function buildLayananStory(ctx, tempatName) {
    const { layananWarga, umkmProduk } = ctx;
    let story = `🤝 **Layanan di ${tempatName}**\n\n`;

    const rewang = layananWarga?.find(l => l.kategori_layanan === 'rewang');
    const ojek = layananWarga?.find(l => l.kategori_layanan === 'ojek_warga');

    if (rewang) {
      story += `🫱 **Rewang tersedia!**\n`;
      story += `   Respon ${rewang.estimasi_waktu_respon_menit || 'cepat'} menit.\n\n`;
    }

    if (ojek) {
      story += `🛵 **Ojek warga aktif!**\n`;
      story += `   ${ojek.jumlah_provider_aktif || 'Beberapa'} pengemudi siap antar.\n\n`;
    }

    if (umkmProduk?.length > 0) {
      story += `🛍️ **UMKM buka sekarang:**\n`;
      umkmProduk.slice(0, 3).forEach(u => {
        story += `   • ${u.nama_produk} — ${u.nama_toko}\n`;
      });
      story += `\n`;
    }

    if (!rewang && !ojek && (!umkmProduk || umkmProduk.length === 0)) {
      story += `Belum ada layanan warga atau UMKM tercatat.\n\n`;
    }

    story += `✨ Refresh untuk cerita lain! 🔄`;
    return story;
  }

  function buildPrediksiStory(ctx, tempatName) {
    const { prediksi } = ctx;
    let story = `🔮 **Ramalan Kondisi ${tempatName}**\n\n`;

    if (prediksi?.length > 0) {
      const nowHour = new Date().getHours();
      const prediksiSekarang = prediksi.find(p => {
        const jamPrediksi = parseInt(p.jam_prediksi?.split(':')[0] || '0');
        return Math.abs(nowHour - jamPrediksi) <= 2;
      });

      if (prediksiSekarang) {
        story += `Sekitar jam ${prediksiSekarang.jam_prediksi?.substring(0, 5)}:\n`;
        story += `📊 ${prediksiSekarang.prediksi_kondisi}\n`;
        story += `🎯 Akurasi ${Math.round((prediksiSekarang.prediksi_skor || 0.5) * 100)}%\n\n`;
      }
    } else {
      story += `Belum ada data prediksi untuk tempat ini.\n\n`;
    }

    story += `✨ Refresh dapat prediksi berbeda! 🔄`;
    return story;
  }

  function buildRiwayatStory(ctx, tempatName) {
    const { insidenHistoris } = ctx;
    let story = `📜 **Yang Pernah Terjadi di ${tempatName}**\n\n`;

    if (insidenHistoris?.length > 0) {
      insidenHistoris.slice(0, 3).forEach(i => {
        const tanggal = i.tanggal_mulai ? new Date(i.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : 'Waktu lalu';
        story += `📌 ${tanggal}: ${i.judul}\n`;
        if (i.deskripsi) {
          story += `   ${i.deskripsi.substring(0, 80)}...\n`;
        }
        story += `\n`;
      });
    } else {
      story += `Belum ada catatan riwayat untuk tempat ini.\n\n`;
    }

    story += `✨ Refresh untuk cerita lain! 🔄`;
    return story;
  }

  function buildAktivitasStory(ctx, tempatName) {
    const { aktivitasWarga, aktivitasBerkala } = ctx;
    let story = `👥 **Kegiatan Warga di ${tempatName}**\n\n`;

    const today = new Date().toISOString().split('T')[0];
    const aktivitasHariIni = aktivitasWarga?.filter(a => a.tanggal_mulai === today);

    if (aktivitasHariIni?.length > 0) {
      story += `📅 **Hari ini:**\n`;
      aktivitasHariIni.forEach(a => {
        story += `   • ${a.judul_aktivitas}\n`;
        if (a.estimasi_peserta) story += `     (${a.estimasi_peserta} orang)\n`;
      });
      story += `\n`;
    }

    const nowHour = new Date().getHours();
    const currentDay = new Date().toLocaleDateString('id', { weekday: 'long' });
    const aktivitasRutin = aktivitasBerkala?.find(a =>
      a.hari === currentDay &&
      parseInt(a.jam_mulai?.split(':')[0] || '0') <= nowHour &&
      parseInt(a.jam_selesai?.split(':')[0] || '23') >= nowHour
    );

    if (aktivitasRutin) {
      story += `⏰ **Sedang berlangsung:**\n`;
      story += `   ${aktivitasRutin.nama_aktivitas}\n`;
      story += `\n`;
    }

    if ((!aktivitasHariIni || aktivitasHariIni.length === 0) && !aktivitasRutin) {
      story += `Tidak ada kegiatan warga terjadwal hari ini.\n\n`;
    }

    story += `✨ Refresh untuk cerita lain! 🔄`;
    return story;
  }

  function buildKarakterStory(ctx, tempatName) {
    const { metadata, layananTersedia } = ctx;
    let story = `📍 **Mengenal ${tempatName}**\n\n`;

    if (metadata) {
      const tipeMap = {
        'masjid': '🕌 tempat ibadah', 'industri': '🏭 kawasan industri', 'sekolah': '🏫 lembaga pendidikan',
        'rs': '🏥 fasilitas kesehatan', 'mall': '🛍️ pusat perbelanjaan', 'wisata': '🏖️ destinasi wisata',
        'kantor': '🏢 kantor pemerintahan'
      };
      story += `${tipeMap[metadata.tipe_utama] || '📍'} ${tempatName}`;
      if (metadata.kapasitas_normal) {
        story += `\n📏 Kapasitas normal: ~${metadata.kapasitas_normal} orang`;
      }
      story += `\n\n`;
    }

    if (layananTersedia?.length > 0) {
      story += `🏢 **Fasilitas tersedia:**\n`;
      layananTersedia.slice(0, 4).forEach(l => {
        story += `   • ${l.sub_layanan}\n`;
      });
      story += `\n`;
    }

    story += `✨ Refresh untuk cerita lain! 🔄`;
    return story;
  }

  // ============================================
  // 3. DAFTAR GAYA CERITA (HANYA SEKALI!)
  // ============================================
  const STORY_STYLES = [
    {
      id: 'laporan',
      name: '📢 Fokus Laporan Warga',
      build: (ctx, tempatName, formatTimeAgo) => buildLaporanStory(ctx, tempatName, formatTimeAgo)
    },
    {
      id: 'konteks',
      name: '🔗 Fokus Konteks Sekitar',
      build: (ctx, tempatName) => buildKonteksStory(ctx, tempatName)
    },
    {
      id: 'layanan',
      name: '🤝 Fokus Layanan & UMKM',
      build: (ctx, tempatName) => buildLayananStory(ctx, tempatName)
    },
    {
      id: 'prediksi',
      name: '🔮 Fokus Prediksi AI',
      build: (ctx, tempatName) => buildPrediksiStory(ctx, tempatName)
    },
    {
      id: 'riwayat',
      name: '📜 Fokus Riwayat & Pola',
      build: (ctx, tempatName) => buildRiwayatStory(ctx, tempatName)
    },
    {
      id: 'aktivitas',
      name: '👥 Fokus Aktivitas Warga',
      build: (ctx, tempatName) => buildAktivitasStory(ctx, tempatName)
    },
    {
      id: 'karakter',
      name: '📍 Fokus Karakter Tempat',
      build: (ctx, tempatName) => buildKarakterStory(ctx, tempatName)
    }
  ];

  // ============================================
  // 4. FETCH RICH CONTEXT (AMBIL SEMUA DATA)
  // ============================================
  const fetchRichContext = useCallback(async (tempatId) => {
    // 1. Metadata tempat
    const { data: metadata } = await supabase
      .from('tempat_metadata')
      .select('*')
      .eq('tempat_id', tempatId)
      .single();

    // 2. Aktivitas berkala
    const { data: aktivitasBerkala } = await supabase
      .from('tempat_aktivitas_berkala')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('is_active', true);

    // 3. Insiden historis
    const { data: insidenHistoris } = await supabase
      .from('tempat_insiden_historis')
      .select('*')
      .eq('tempat_id', tempatId)
      .order('tanggal_mulai', { ascending: false })
      .limit(10);

    // 4. Tempat terhubung
    const { data: tempatTerhubung } = await supabase
      .from('tempat_koneksi')
      .select(`
        *,
        tempat_terkait:tempat_id_2 (id, name, latest_condition)
      `)
      .eq('tempat_id_1', tempatId);

    // 5. Layanan terkait
    const { data: layananTersedia } = await supabase
      .from('tempat_layanan_terkait')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('is_tersedia', true);

    // 6. Prediksi AI
    const { data: prediksi } = await supabase
      .from('tempat_prediksi')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('hari_prediksi', new Date().toISOString().split('T')[0])
      .gte('expires_at', new Date().toISOString())
      .order('jam_prediksi', { ascending: true });

    // 7. Laporan warga
    const { data: laporanWarga } = await supabase
      .from('laporan_warga')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(30);

    // 8. External signals
    const { data: externalSignals } = await supabase
      .from('external_signals')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(20);

    // 9. Layanan warga
    const { data: layananWarga } = await supabase
      .from('tempat_layanan_warga')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('is_active', true);

    // 10. Bantuan tersedia
    const { data: bantuanTersedia } = await supabase
      .from('tempat_bantuan_tersedia')
      .select('*')
      .eq('tempat_id', tempatId)
      .eq('is_aktif', true)
      .gte('kadaluarsa', new Date().toISOString());

    // 11. UMKM Produk
    const { data: umkmProduk } = await supabase
      .from('tempat_umkm_produk')
      .select('*, profiles(username, avatar_url)')
      .eq('tempat_id', tempatId)
      .eq('is_active', true)
      .order('rating_avg', { ascending: false })
      .limit(10);

    // 12. Aktivitas warga
    const { data: aktivitasWarga } = await supabase
      .from('tempat_aktivitas_warga')
      .select('*')
      .eq('tempat_id', tempatId)
      .in('status', ['direncanakan', 'berlangsung'])
      .gte('tanggal_mulai', new Date().toISOString().split('T')[0])
      .limit(5);

    return {
      metadata: metadata || null,
      aktivitasBerkala: aktivitasBerkala || [],
      insidenHistoris: insidenHistoris || [],
      tempatTerhubung: tempatTerhubung || [],
      layananTersedia: layananTersedia || [],
      layananWarga: layananWarga || [],
      bantuanTersedia: bantuanTersedia || [],
      umkmProduk: umkmProduk || [],
      aktivitasWarga: aktivitasWarga || [],
      prediksi: prediksi || [],
      laporanWarga: laporanWarga || [],
      externalSignals: externalSignals || []
    };
  }, []);

  // ============================================
  // 4. GENERATE SMART INSIGHT
  // ============================================
  const generateSmartInsight = useCallback((context, version = 0) => {
    const tempatName = activeTempat?.name || 'tempat ini';

    // CEK DARURAT!
    const emergency = isEmergency(context);

    let fullStory = '';
    let selectedStyle = null;

    if (emergency) {
      // DARURAT: Tampilkan cerita serius
      fullStory = `🚨 **PERINGATAN DARURAT!** 🚨\n\n`;

      const emergencyReports = [...(context.laporanWarga || []), ...(context.externalSignals || [])].filter(item => {
        const text = `${item.deskripsi || ''} ${item.content || ''}`.toLowerCase();
        return ['kecelakaan', 'korban', 'luka', 'darurat'].some(kw => text.includes(kw));
      });

      if (emergencyReports.length > 0) {
        fullStory += `📢 **Kejadian:**\n`;
        emergencyReports.slice(0, 2).forEach(r => {
          fullStory += `   "${r.deskripsi || r.content?.substring(0, 150)}"\n`;
          fullStory += `   — @${r.username || 'sumber'}\n\n`;
        });
      }

      fullStory += `⚠️ **Hati-hati lur!** Prioritas bantuan untuk korban.\n`;
      fullStory += `🚧 Hindari area jika tidak perlu.\n`;
      fullStory += `📞 Darurat hubungi 112.\n\n`;
      fullStory += `✨ Tetap waspada dan semoga cepet pulih! 🙏`;

      selectedStyle = { name: '🚨 DARURAT' };
    } else {
      // NORMAL: Pilih gaya cerita berdasarkan versi
      const styleIndex = version % STORY_STYLES.length;
      selectedStyle = STORY_STYLES[styleIndex];
      fullStory = selectedStyle.build(context, tempatName, formatTimeAgo);
    }

    // Set greeting
    const { text: timeGreeting, icon: timeIcon } = getTimeGreeting();
    if (emergency) {
      setGreeting(`🚨 ${timeGreeting} Warga! Kejadian serius di ${tempatName}!`);
    } else {
      setGreeting(`${timeGreeting} Warga! ${timeIcon} ${selectedStyle.name} — ${tempatName}`);
    }

    // Set story
    setStory(fullStory);
    setRichContext(context);
    setModelUsed('local');

    // Set insightStats
    const totalLaporan = (context.laporanWarga?.length || 0) + (context.externalSignals?.length || 0);
    setInsightStats({
      total_laporan: totalLaporan,
      last_update: new Date().toISOString(),
      avg_confidence: 0.7,
      is_emergency: emergency,
      story_style: selectedStyle?.name
    });

  }, [activeTempat, getTimeGreeting]);

  // Fetch utama dengan versi cerita
  const fetchInsight = useCallback(async () => {
    // CEK: jangan fetch lagi kalau sedang berlangsung
    if (fetchingRef.current) {
      console.log('⏳ Skipping, already fetching...');
      return;
    }

    if (!activeTempat?.id) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `insight_rich_${activeTempat.id}_v${storyVersion}`;
    const cached = aiInsightCache.get(cacheKey);
    if (cached && !fetchingRef.current) {
      setGreeting(cached.greeting);
      setStory(cached.story);
      setRichContext(cached.richContext);
      setModelUsed(cached.modelUsed);
      setInsightStats(cached.insightStats);
      setIsLoading(false);
      return;
    }

    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const richData = await fetchRichContext(activeTempat.id);

      if (!isMountedRef.current) return;

      generateSmartInsight(richData, storyVersion);

      aiInsightCache.set(cacheKey, {
        greeting,
        story,
        richContext: richData,
        modelUsed: 'local',
        insightStats
      });
    } catch (err) {
      console.error('Error:', err);
      if (isMountedRef.current) {
        setStory(`Maaf lur, Mbah AI lagi sibuk. Coba refresh lagi ya! 🙏\n\n✨ Klik 🧠 untuk coba lagi.`);
        setGreeting(`Selamat ${getIndonesianTimeLabel()} Warga! 🌙`);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [activeTempat?.id, storyVersion, fetchRichContext, generateSmartInsight, greeting, story, insightStats]);

  // 🔧 REFRESH - hanya increment version, TIDAK panggil fetch langsung
  const refresh = useCallback(() => {
    setStoryVersion(prev => prev + 1);
  }, []);

  // 🔧 PERBAIKI useEffect - panggil fetch hanya saat version berubah
  useEffect(() => {
    isMountedRef.current = true;

    // Panggil fetch saat pertama kali mount ATAU saat storyVersion berubah
    if (activeTempat?.id) {
      fetchInsight();
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeTempat?.id, storyVersion]); // 👈 HANYA 2 dependency ini!

  return {
    greeting,
    story,
    insightStats,
    isLoading,
    modelUsed,
    richContext,
    refresh
  };
}