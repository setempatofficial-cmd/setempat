import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getIndonesianTimeLabel, getTimeInfo } from '@/utils/timeUtils';

// ============================================
// MODULAR STORY BUILDERS (Wajib di atas hook)
// ============================================
const STORY_STYLES = [
  {
    id: 'laporan',
    name: '📢 Hasil Laporan Warga',
    build: (ctx, tempatName, formatTimeAgo, userName) => {
      let story = `📢 **Cerita Laporan Warga ${tempatName}**\n`;
      story += `Dari pantauan terbaru warga setempat:\n\n`;

      if (ctx.laporanWarga?.length > 0) {
        const recentReports = ctx.laporanWarga.slice(0, 3);
        const conditions = recentReports.map(l => l.deskripsi?.toLowerCase() || '');
        const hasMacet = conditions.some(c => c.includes('macet') || c.includes('padat'));
        const hasLancar = conditions.some(c => c.includes('lancar'));
        const hasPengamen = conditions.some(c => c.includes('pengamen'));

        let summary = `Dari laporan warga dalam ${recentReports.length} hari terakhir, `;
        if (hasMacet && hasLancar) summary += `kondisi lalu lintas berfluktuasi antara macet dan lancar. `;
        else if (hasMacet) summary += `kondisi cenderung padat/macet. `;
        else if (hasLancar) summary += `kondisi cenderung lancar. `;
        if (hasPengamen) summary += `Pengamen mulai terlihat mangkal di area. `;

        story += summary + `\n\n📋 **Detail laporan:**\n`;
        recentReports.forEach(l => {
          const pelapor = l.profiles?.username ? `@${l.profiles.username}` : 'Warga';
          story += `   • "${l.deskripsi?.substring(0, 100)}" (${formatTimeAgo(l.created_at)}) oleh ${pelapor}\n`;
        });
      } else {
        story += `Belum ada laporan warga untuk ${tempatName}. Ayo **${userName}** Kamu yang pertama! 📝\n\n`;
      }

      return story + `\n✨ Refresh untuk cerita lain atau Tanya klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'konteks',
    name: '🔗 Kondisi Sekitar Lokasi',
    build: (ctx, tempatName) => {
      let story = `🔗 **${tempatName} & Sekitarnya**\n\n`;
      const tempatPengaruh = ctx.tempatTerhubung?.filter(t => t.tempat_terkait?.latest_condition === 'MACET' || t.tempat_terkait?.latest_condition === 'RAMAI');

      if (tempatPengaruh?.length > 0) {
        tempatPengaruh.forEach(t => {
          story += `📍 ${t.tempat_terkait?.name} (${t.jarak_km}km) sedang ${t.tempat_terkait?.latest_condition?.toLowerCase() || 'padat'}.\n   Ini berpengaruh ke ${tempatName}.\n\n`;
        });
      } else {
        story += `Tempat-tempat di sekitar ${tempatName} terpantau normal semua.\n\n`;
      }
      return story + `✨ Refresh untuk cerita lain atau klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'layanan',
    name: '🤝 Pantauan Layanan & UMKM',
    build: (ctx, tempatName) => {
      let story = `🤝 **Layanan di ${tempatName}**\n\n`;
      const rewang = ctx.layananWarga?.find(l => l.kategori_layanan === 'rewang');
      const ojek = ctx.layananWarga?.find(l => l.kategori_layanan === 'ojek_warga');

      if (rewang) story += `🫱 **Rewang tersedia!**\n   Respon ${rewang.estimasi_waktu_respon_menit || 'cepat'} menit.\n\n`;
      if (ojek) story += `🛵 **Ojek warga aktif!**\n   ${ojek.jumlah_provider_aktif || 'Beberapa'} pengemudi siap antar.\n\n`;

      if (ctx.umkmProduk?.length > 0) {
        story += `🛍️ **UMKM buka sekarang:**\n`;
        ctx.umkmProduk.slice(0, 3).forEach(u => { story += `   • ${u.nama_produk} — ${u.nama_toko}\n`; });
        story += `\n`;
      }
      if (!rewang && !ojek && !ctx.umkmProduk?.length) story += `Belum ada layanan warga atau UMKM tercatat.\n\n`;
      return story + `✨ Refresh untuk cerita lain! 🔄`;
    }
  },
  {
    id: 'prediksi',
    name: '🔮 Hasil Prediksi AI AKAMSI',
    build: (ctx, tempatName) => {
      let story = `🔮 **Ramalan Kondisi ${tempatName}**\n\n`;
      if (ctx.prediksi?.length > 0) {
        const nowHour = new Date().getHours();
        const prediksiSekarang = ctx.prediksi.find(p => {
          const jamPrediksi = parseInt(p.jam_prediksi?.split(':')[0] || '0');
          return Math.abs(nowHour - jamPrediksi) <= 2;
        });
        if (prediksiSekarang) {
          story += `Sekitar jam ${prediksiSekarang.jam_prediksi?.substring(0, 5)}:\n📊 ${prediksiSekarang.prediksi_kondisi}\n🎯 Akurasi ${Math.round((prediksiSekarang.prediksi_skor || 0.5) * 100)}%\n\n`;
        } else if (ctx.prediksi[0]) {
          story += `Prediksi terdekat jam ${ctx.prediksi[0].jam_prediksi?.substring(0, 5)}:\n📊 ${ctx.prediksi[0].prediksi_kondisi}\n\n`;
        }
      } else {
        story += `Belum ada data prediksi untuk tempat ini.\n\n`;
      }
      return story + `✨ Refresh untuk cerita lain atau Tanya klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'riwayat',
    name: '📜 Hasil Riwayat & Kejadian',
    build: (ctx, tempatName) => {
      let story = `📜 **Yang Pernah Terjadi di ${tempatName}**\n\n`;
      if (ctx.insidenHistoris?.length > 0) {
        ctx.insidenHistoris.slice(0, 3).forEach(i => {
          const tanggal = i.tanggal_mulai ? new Date(i.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : 'Waktu lalu';
          story += `📌 ${tanggal}: ${i.judul}\n${i.deskripsi ? `   ${i.deskripsi.substring(0, 80)}...\n` : ''}\n`;
        });
      } else {
        story += `Belum ada catatan riwayat untuk tempat ini.\n\n`;
      }
      return story + `✨ Refresh untuk cerita lain atau Tanya klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'aktivitas',
    name: '👥 Pantauan Aktivitas Warga',
    build: (ctx, tempatName) => {
      let story = `👥 **Kegiatan Warga di ${tempatName}**\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];
      const aktivitasHariIni = ctx.aktivitasWarga?.filter(a => a.tanggal_mulai === todayStr);

      if (aktivitasHariIni?.length > 0) {
        story += `📅 **Hari ini:**\n`;
        aktivitasHariIni.forEach(a => { story += `   • ${a.judul_aktivitas}${a.estimasi_peserta ? ` (${a.estimasi_peserta} orang)` : ''}\n`; });
        story += `\n`;
      }
      const nowHour = new Date().getHours();
      const currentDay = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
      const aktivitasRutin = ctx.aktivitasBerkala?.find(a => a.hari === currentDay && parseInt(a.jam_mulai?.split(':')[0] || '0') <= nowHour && parseInt(a.jam_selesai?.split(':')[0] || '23') >= nowHour);
      if (aktivitasRutin) story += `⏰ **Sedang berlangsung:**\n   ${aktivitasRutin.nama_aktivitas}\n\n`;
      if (!aktivitasHariIni?.length && !aktivitasRutin) story += `Tidak ada kegiatan warga terjadwal hari ini.\n\n`;
      return story + `✨ Refresh untuk cerita lain atau Tanya klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'karakter',
    name: '📍 Hasil Pengamatan Karakter Tempat',
    build: (ctx, tempatName) => {
      let story = `📍 **Mengenal ${tempatName}**\n\n`;

      if (ctx.metadata) {
        const tipeMap = {
          masjid: '🕌 Tempat Ibadah',
          industri: '🏭 Kawasan Industri',
          sekolah: '🏫 Lembaga Pendidikan',
          rs: '🏥 Fasilitas Kesehatan',
          mall: '🛍️ Pusat Perbelanjaan',
          wisata: '🏖️ Destinasi Wisata',
          kantor: '🏢 Kantor Pemerintahan',
          pom_bensin: '⛽ Stasiun Pengisian BBM',
          pasar: '🛒 Pasar Tradisional',
          umum: '📍 Tempat Umum'
        };

        story += `${tipeMap[ctx.metadata.tipe_utama] || '📍'} ${tempatName}\n`;

        if (ctx.metadata.kapasitas_normal) {
          story += `📏 Kapasitas normal: ~${ctx.metadata.kapasitas_normal.toLocaleString()} orang\n`;
        }

        if (ctx.metadata.jam_buka && ctx.metadata.jam_tutup) {
          story += `⏰ Jam operasional: ${ctx.metadata.jam_buka} - ${ctx.metadata.jam_tutup}`;
          if (ctx.metadata.is_24_jam) story += ` (24 Jam)`;
          story += `\n`;
        }

        if (ctx.metadata.deskripsi) {
          story += `\n📌 **Informasi:**\n${ctx.metadata.deskripsi}\n`;
        }

        story += `\n`;
      }

      if (ctx.layananTersedia?.length > 0) {
        story += `🏢 **Fasilitas tersedia:**\n`;
        ctx.layananTersedia.slice(0, 4).forEach(l => {
          story += `   • ${l.sub_layanan || l.layanan}\n`;
        });
        story += `\n`;
      }

      return story + `✨ Refresh untuk cerita lain atau Tanya klik pojok kanan bawah! 🔄`;
    }
  }
];

export function useAIInsight(activeTempat) {
  const [greeting, setGreeting] = useState('');
  const [story, setStory] = useState('');
  const [insightStats, setInsightStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelUsed, setModelUsed] = useState('local');
  const [storyVersion, setStoryVersion] = useState(0);

  const [user, setUser] = useState({ loading: true, namaDepan: null });

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

  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const realtimeChannelRef = useRef(null);

  // ============================================
  // AMBIL DATA USER & NAMA DEPAN
  // ============================================
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const namaDepan = authUser.user_metadata?.full_name?.split(' ')[0] ||
            authUser.user_metadata?.name?.split(' ')[0] ||
            authUser.email?.split('@')[0] ||
            'Warga';
          setUser({ ...authUser, namaDepan, loading: false });
        } else {
          setUser({ loading: false, namaDepan: 'Warga' });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        setUser({ loading: false, namaDepan: 'Warga' });
      }
    };
    getUser();
  }, []);

  // ============================================
  // UTILS & FORMATTERS
  // ============================================
  const getTimeGreeting = useCallback(() => {
    const timeLabel = getIndonesianTimeLabel();
    const timeInfo = getTimeInfo();
    const greetingMap = { Pagi: 'Selamat pagi', Siang: 'Selamat siang', Sore: 'Selamat sore', Malam: 'Selamat malam' };
    return { text: greetingMap[timeLabel] || 'Selamat siang', icon: timeInfo.icon, isMalam: timeLabel === 'Malam' };
  }, []);

  const formatTimeAgo = useCallback((dateString) => {
    if (!dateString) return 'beberapa waktu lalu';
    const now = new Date();
    const past = new Date(dateString);
    const diffMins = Math.floor((now - past) / 60000);
    const diffHours = Math.floor((now - past) / 3600000);
    const diffDays = Math.floor((now - past) / 86400000);

    if (diffMins < 1) return 'baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays === 1) return 'kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }, []);

  const isEmergency = useCallback((context) => {
    const { laporanWarga, externalSignals } = context;
    const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir bandang', 'kebakaran', 'peringatan'];
    const allTexts = [
      ...(laporanWarga || []).map(l => l.deskripsi || l.content || ''),
      ...(externalSignals || []).map(s => s.content || '')
    ].join(' ').toLowerCase();
    return emergencyKeywords.some(kw => allTexts.includes(kw));
  }, []);

  // ============================================
  // FETCH RICH CONTEXT (PARALEL PROMISE)
  // 🔥 PERBAIKAN: Ganti laporan_warga → laporan_with_location
  // ============================================
  const fetchRichContext = useCallback(async (tempatId) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toISOString();

    const [
      metadataRes, aktivitasBerkalaRes, insidenHistorisRes, tempatTerhubungRes,
      layananTersediaRes, prediksiRes, laporanWargaRes, externalSignalsRes,
      layananWargaRes, bantuanTersediaRes, umkmProdukRes, aktivitasWargaRes
    ] = await Promise.all([
      supabase.from('tempat_metadata').select('*').eq('tempat_id', tempatId).maybeSingle(),
      supabase.from('tempat_aktivitas_berkala').select('*').eq('tempat_id', tempatId).eq('is_active', true),
      supabase.from('tempat_insiden_historis').select('*').eq('tempat_id', tempatId).order('tanggal_mulai', { ascending: false }).limit(10),
      supabase.from('tempat_koneksi').select('*, tempat_terkait:tempat_id_2 (id, name, latest_condition)').eq('tempat_id_1', tempatId),
      supabase.from('tempat_layanan_terkait').select('*').eq('tempat_id', tempatId).eq('is_tersedia', true),
      supabase.from('tempat_prediksi').select('*').eq('tempat_id', tempatId).eq('hari_prediksi', todayStr).gte('expires_at', nowStr).order('jam_prediksi', { ascending: true }),
      // 🔥 PERUBAHAN: dari 'laporan_warga' → 'laporan_with_location'
      supabase.from('laporan_with_location').select('*, profiles(username)').eq('tempat_id', tempatId).eq('status', 'approved').order('created_at', { ascending: false }).limit(30),
      supabase.from('external_signals').select('*').eq('tempat_id', tempatId).eq('verified', true).order('created_at', { ascending: false }).limit(20),
      supabase.from('tempat_layanan_warga').select('*').eq('tempat_id', tempatId).eq('is_active', true),
      supabase.from('tempat_bantuan_tersedia').select('*').eq('tempat_id', tempatId).eq('is_aktif', true).gte('kadaluarsa', nowStr),
      supabase.from('tempat_umkm_produk').select('*, profiles(username, avatar_url)').eq('tempat_id', tempatId).eq('is_active', true).order('rating_avg', { ascending: false }).limit(10),
      supabase.from('tempat_aktivitas_warga').select('*').eq('tempat_id', tempatId).in('status', ['direncanakan', 'berlangsung']).gte('tanggal_mulai', todayStr).limit(5)
    ]);

    return {
      metadata: metadataRes.data || null,
      aktivitasBerkala: aktivitasBerkalaRes.data || [],
      insidenHistoris: insidenHistorisRes.data || [],
      tempatTerhubung: tempatTerhubungRes.data || [],
      layananTersedia: layananTersediaRes.data || [],
      prediksi: prediksiRes.data || [],
      laporanWarga: laporanWargaRes.data || [],
      externalSignals: externalSignalsRes.data || [],
      layananWarga: layananWargaRes.data || [],
      bantuanTersedia: bantuanTersediaRes.data || [],
      umkmProduk: umkmProdukRes.data || [],
      aktivitasWarga: aktivitasWargaRes.data || []
    };
  }, []);

  // ============================================
  // GENERATE SMART INSIGHT
  // ============================================
  const generateSmartInsight = useCallback((context, version = 0, userName = 'Warga') => {
    const tempatName = activeTempat?.name || 'tempat ini';
    const emergency = isEmergency(context);
    let fullStory = '';
    let selectedStyle = null;

    if (emergency) {
      fullStory = `🚨 **PERINGATAN DARURAT!** 🚨\n\n`;
      const emergencyReports = [...(context.laporanWarga || []), ...(context.externalSignals || [])].filter(item => {
        const text = `${item.deskripsi || ''} ${item.content || ''}`.toLowerCase();
        return ['kecelakaan', 'korban', 'luka', 'darurat'].some(kw => text.includes(kw));
      });

      if (emergencyReports.length > 0) {
        fullStory += `📢 **Kejadian:**\n`;
        emergencyReports.slice(0, 2).forEach(r => {
          const pelapor = r.profiles?.username ? `@${r.profiles.username}` : 'sumber';
          fullStory += `   "${r.deskripsi || r.content?.substring(0, 150)}"\n`;
          fullStory += `   — ${pelapor}\n\n`;
        });
      }
      fullStory += `⚠️ **Hati-hati lur ${userName}!** Prioritas bantuan untuk korban.\n🚧 Hindari area jika tidak perlu.\n📞 Darurat hubungi 112.\n\n✨ Tetap waspada dan semoga cepet pulih! 🙏`;
      selectedStyle = { name: '🚨 DARURAT' };
    } else {
      const styleIndex = version % STORY_STYLES.length;
      selectedStyle = STORY_STYLES[styleIndex];
      fullStory = selectedStyle.build(context, tempatName, formatTimeAgo, userName);
    }

    const { text: timeGreeting, icon: timeIcon } = getTimeGreeting();

    const finalGreeting = emergency
      ? `🚨 ${timeGreeting} ${userName}! Kejadian serius di ${tempatName}!`
      : `${timeGreeting} ${userName}! ${timeIcon} ${selectedStyle.name} — ${tempatName}`;

    const totalLaporan = (context.laporanWarga?.length || 0) + (context.externalSignals?.length || 0);
    const finalStats = {
      total_laporan: totalLaporan,
      last_update: new Date().toISOString(),
      avg_confidence: 0.7,
      is_emergency: emergency,
      story_style: selectedStyle?.name
    };

    return { finalGreeting, fullStory, finalStats };
  }, [activeTempat?.name, getTimeGreeting, isEmergency, formatTimeAgo]);

  // ============================================
  // CORE FETCH INSIGHT
  // ============================================
  const fetchInsight = useCallback(async (currentUserName) => {
    if (fetchingRef.current || !activeTempat?.id) return;

    const userName = currentUserName || 'Warga';
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const richData = await fetchRichContext(activeTempat.id);
      if (!isMountedRef.current) return;

      const { finalGreeting, fullStory, finalStats } = generateSmartInsight(richData, storyVersion, userName);

      setGreeting(finalGreeting);
      setStory(fullStory);
      setRichContext(richData);
      setModelUsed('local');
      setInsightStats(finalStats);

    } catch (err) {
      console.error('Error fetching insight:', err);
      if (isMountedRef.current) {
        setStory(`Maaf lur, Mbah AI lagi sibuk. Coba refresh lagi ya! 🙏\n\n✨ Klik 🔄 untuk coba lagi.`);
        setGreeting(`Selamat ${getIndonesianTimeLabel()} ${userName}! 🌙`);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [activeTempat?.id, storyVersion, fetchRichContext, generateSmartInsight]);

  const refresh = useCallback(() => {
    setStoryVersion(prev => prev + 1);
  }, []);

  // ============================================
  // 🔥 REALTIME SUBSCRIPTION (BARU!)
  // Mendengar laporan baru dari laporan_with_location
  // ============================================
  useEffect(() => {
    if (!activeTempat?.id) return;

    // Bersihkan channel lama jika ada
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    console.log(`🔄 AI Insight subscribe ke tempat: ${activeTempat.id}`);

    // Buat channel baru
    realtimeChannelRef.current = supabase
      .channel(`ai_insight_${activeTempat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'laporan_with_location',  // ← Pakai VIEW!
          filter: `tempat_id=eq.${activeTempat.id}`
        },
        (payload) => {
          console.log("🆕 AI Insight mendengar laporan baru:", payload.new);
          // Refresh otomatis saat ada laporan baru
          refresh();
        }
      )
      .subscribe();

    return () => {
      if (realtimeChannelRef.current) {
        console.log(`🔌 AI Insight unsubscribe dari tempat: ${activeTempat.id}`);
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [activeTempat?.id, refresh]);

  // ============================================
  // EFFECT UTAMA (KUNCI SINKRONISASI USER)
  // ============================================
  useEffect(() => {
    isMountedRef.current = true;

    if (activeTempat?.id && !user.loading && user.namaDepan !== null) {
      fetchInsight(user.namaDepan);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [activeTempat?.id, storyVersion, fetchInsight, user.loading, user.namaDepan]);

  return { greeting, story, insightStats, isLoading, modelUsed, richContext, refresh };
}