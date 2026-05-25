import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { aiInsightCache } from '@/lib/aiInsightCache';
import { getIndonesianTimeLabel, getTimeInfo } from '@/utils/timeUtils';

// ============================================
// HELPER: FORMAT WAKTU REAKTIF
// ============================================
function formatTimeAgo(dateString) {
  if (!dateString) return 'baru saja';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// HELPER AMAN: Menggali teks laporan dari objek
function dapatkanTeksLaporan(obj) {
  if (!obj) return '';
  return obj.deskripsi || obj.content || obj.deskripsi_ai || obj.isi_laporan || '';
}

// HELPER DEDUPLIKASI: Menghapus data ganda berdasarkan ID
function deduplicateByKey(items, key = 'id') {
  if (!items || !items.length) return [];
  const seen = new Set();
  return items.filter(item => {
    const id = item[key];
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function useAIInsight(activeTempat, selectedStory = null) {
  const [greeting, setGreeting] = useState('');
  const [story, setStory] = useState('');
  const [insightStats, setInsightStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelUsed, setModelUsed] = useState('local');
  const [activeStoryId, setActiveStoryId] = useState('laporan');
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

  const [user, setUser] = useState(null);
  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // ============================================
  // AMBIL DATA USER
  // ============================================
  useEffect(() => {
    isMountedRef.current = true;

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMountedRef.current && session?.user) {
          const u = session.user;
          const namaDepan = u.user_metadata?.full_name?.split(' ')[0] ||
            u.user_metadata?.name?.split(' ')[0] ||
            u.email?.split('@')[0] ||
            'Warga';
          setUser({ ...u, namaDepan });
        }
      } catch (err) {
        console.error('Error fetching auth session:', err);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMountedRef.current) {
        if (session?.user) {
          const u = session.user;
          const namaDepan = u.user_metadata?.full_name?.split(' ')[0] ||
            u.user_metadata?.name?.split(' ')[0] ||
            u.email?.split('@')[0] ||
            'Warga';
          setUser({ ...u, namaDepan });
        } else {
          setUser(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Reset tab aktif ke 'laporan' jika tempat berpindah
  useEffect(() => {
    setActiveStoryId('laporan');
    setStoryVersion(prev => prev + 1);
  }, [activeTempat?.id]);

  // ============================================
  // UTILS & FORMATTERS
  // ============================================
  const getTimeGreeting = useCallback(() => {
    const timeLabel = getIndonesianTimeLabel();
    const timeInfo = getTimeInfo();
    const greetingMap = { Pagi: 'Selamat pagi', Siang: 'Selamat siang', Sore: 'Selamat sore', Malam: 'Selamat malam' };
    return { text: greetingMap[timeLabel] || 'Selamat siang', icon: timeInfo.icon, isMalam: timeLabel === 'Malam' };
  }, []);

  // ============================================
  // CEK DARURAT (HANYA HARI INI)
  // ============================================
  function isEmergency(context) {
    const todayStr = new Date().toISOString().split('T')[0];
    const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran', 'pohon tumbang'];

    const allReports = [...(context.laporanWarga || []), ...(context.externalSignals || [])];
    const todayReports = allReports.filter(r => r.created_at?.split('T')[0] === todayStr);
    const allTexts = todayReports.map(item => `${dapatkanTeksLaporan(item)} ${item.content || ''}`.toLowerCase()).join(' ');

    return emergencyKeywords.some(kw => allTexts.includes(kw));
  }

  // ============================================
  // FETCH RICH CONTEXT (DENGAN DEDUPLIKASI)
  // ============================================
  const fetchRichContext = useCallback(async (tempatId) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toISOString();

    const [
      metadataRes,
      aktivitasBerkalaRes,
      insidenHistorisRes,
      tempatTerhubungRes,
      layananTersediaRes,
      prediksiRes,
      laporanWargaRes,
      externalSignalsRes,
      layananWargaRes,
      bantuanTersediaRes,
      umkmProdukRes,
      aktivitasWargaRes
    ] = await Promise.all([
      supabase.from('tempat_metadata').select('*').eq('tempat_id', tempatId).maybeSingle(),
      supabase.from('tempat_aktivitas_berkala').select('*').eq('tempat_id', tempatId).eq('is_active', true),
      supabase.from('tempat_insiden_historis').select('*').eq('tempat_id', tempatId).order('tanggal_mulai', { ascending: false }).limit(10),
      supabase.from('tempat_koneksi').select('*, tempat_terkait:tempat_id_2 (id, name, latest_condition)').eq('tempat_id_1', tempatId),
      supabase.from('tempat_layanan_terkait').select('*').eq('tempat_id', tempatId).eq('is_tersedia', true),
      supabase.from('tempat_prediksi').select('*').eq('tempat_id', tempatId).eq('hari_prediksi', todayStr).gte('expires_at', nowStr).order('jam_prediksi', { ascending: true }),
      supabase.from('laporan_warga').select('*').eq('tempat_id', tempatId).eq('status', 'approved').order('created_at', { ascending: false }).limit(30),
      supabase.from('external_signals').select('*').eq('tempat_id', tempatId).eq('verified', true).order('created_at', { ascending: false }).limit(20),
      supabase.from('tempat_layanan_warga').select('*').eq('tempat_id', tempatId).eq('is_active', true),
      supabase.from('tempat_bantuan_tersedia').select('*').eq('tempat_id', tempatId).eq('is_aktif', true).gte('kadaluarsa', nowStr),
      supabase.from('tempat_umkm_produk').select('*, profiles(username, avatar_url)').eq('tempat_id', tempatId).eq('is_active', true).order('rating_avg', { ascending: false }).limit(10),
      supabase.from('tempat_aktivitas_warga').select('*').eq('tempat_id', tempatId).in('status', ['direncanakan', 'berlangsung']).gte('tanggal_mulai', todayStr).limit(5)
    ]);

    // DEDUPLIKASI: Hapus data ganda antara laporan_warga dan external_signals
    const laporanData = laporanWargaRes.data || [];
    const externalData = externalSignalsRes.data || [];

    const combinedIds = new Set();
    const uniqueLaporan = laporanData.filter(l => {
      if (combinedIds.has(l.id)) return false;
      combinedIds.add(l.id);
      return true;
    });

    const uniqueExternal = externalData.filter(e => {
      if (combinedIds.has(e.id)) return false;
      combinedIds.add(e.id);
      return true;
    });

    return {
      metadata: metadataRes.data || null,
      aktivitasBerkala: aktivitasBerkalaRes.data || [],
      insidenHistoris: insidenHistorisRes.data || [],
      tempatTerhubung: tempatTerhubungRes.data || [],
      layananTersedia: layananTersediaRes.data || [],
      prediksi: prediksiRes.data || [],
      laporanWarga: uniqueLaporan,
      externalSignals: uniqueExternal,
      layananWarga: layananWargaRes.data || [],
      bantuanTersedia: bantuanTersediaRes.data || [],
      umkmProduk: umkmProdukRes.data || [],
      aktivitasWarga: aktivitasWargaRes.data || []
    };
  }, []);

  // ============================================
  // GENERATE SMART INSIGHT (TIDAK MENGULANG LAPORAN)
  // ============================================
  const generateSmartInsight = useCallback((context, storyId = 'laporan', userName = 'Warga') => {
    const tempatName = activeTempat?.name || 'tempat ini';
    const emergency = isEmergency(context);
    let fullStory = '';
    let selectedStyle = null;

    if (emergency) {
      // MODE DARURAT - HANYA RINGKASAN, BUKAN LAPORAN LENGKAP
      fullStory = `🚨 **PERINGATAN DARURAT WILAYAH!** 🚨\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];

      let emergencyReports = [...(context.laporanWarga || []), ...(context.externalSignals || [])];
      emergencyReports = deduplicateByKey(emergencyReports);

      const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran', 'pohon tumbang'];
      const filteredEmergency = emergencyReports.filter(item => {
        const itemDate = item.created_at?.split('T')[0];
        const text = `${dapatkanTeksLaporan(item)} ${item.content || ''}`.toLowerCase();
        return itemDate === todayStr && emergencyKeywords.some(kw => text.includes(kw));
      });

      if (filteredEmergency.length > 0) {
        fullStory += `📢 **Ringkasan Kejadian Hari Ini:**\n`;
        fullStory += `• Terdapat ${filteredEmergency.length} laporan situasi darurat di wilayah\n`;

        // FIX: Ambil jenis darurat yang muncul
        const foundKeywords = emergencyKeywords.filter(kw => {
          return filteredEmergency.some(r => {
            const text = `${dapatkanTeksLaporan(r)} ${r.content || ''}`.toLowerCase();
            return text.includes(kw);
          });
        });
        fullStory += `• Jenis: ${foundKeywords.join(', ')}\n\n`;

        fullStory += `⚠️ **Himbauan:** Tetap waspada dan ikuti arahan petugas. Hindari area jika tidak mendesak.\n`;
      }

      fullStory += `\n✨ Utamakan keselamatan! 🙏`;
      selectedStyle = { name: '🚨 DARURAT' };
    } else {
      selectedStyle = STORY_STYLES.find(s => s.id === storyId) || STORY_STYLES[0];
      fullStory = selectedStyle.build(context, tempatName, selectedStory);
    }

    const { text: timeGreeting, icon: timeIcon } = getTimeGreeting();

    const finalGreeting = emergency
      ? `🚨 ${timeGreeting} ${userName}! Ada situasi darurat di ${tempatName}!`
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
  }, [activeTempat?.name, getTimeGreeting, selectedStory]);

  // ============================================
  // CORE FETCH INSIGHT
  // ============================================
  const fetchInsight = useCallback(async () => {
    if (fetchingRef.current || !activeTempat?.id) return;

    const { data: { session } } = await supabase.auth.getSession();
    const activeUser = session?.user;
    const userName = activeUser?.user_metadata?.full_name?.split(' ')[0] ||
      activeUser?.user_metadata?.name?.split(' ')[0] ||
      activeUser?.email?.split('@')[0] ||
      'Warga';

    const storyToken = selectedStory ? `_story_${selectedStory.id}` : '';
    const cacheKey = `insight_rich_${activeTempat.id}_${activeStoryId}${storyToken}`;
    const cached = aiInsightCache.get(cacheKey);

    if (cached) {
      const { finalGreeting } = generateSmartInsight(cached.richContext, activeStoryId, userName);
      setGreeting(finalGreeting);
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

      let storyTerpilihLengkap = selectedStory;
      if (selectedStory && !dapatkanTeksLaporan(selectedStory) && selectedStory.id) {
        const { data: detailLaporan } = await supabase
          .from('laporan_warga')
          .select('*')
          .eq('id', selectedStory.id)
          .maybeSingle();
        if (detailLaporan) storyTerpilihLengkap = detailLaporan;
      }

      const { finalGreeting, fullStory, finalStats } = generateSmartInsight(richData, activeStoryId, userName);

      let finalStoryRender = fullStory;
      if (storyTerpilihLengkap && activeStoryId === 'laporan') {
        const styleAktif = STORY_STYLES.find(s => s.id === activeStoryId) || STORY_STYLES[0];
        finalStoryRender = styleAktif.build(richData, activeTempat?.name || 'tempat ini', storyTerpilihLengkap);
      }

      setGreeting(finalGreeting);
      setStory(finalStoryRender);
      setRichContext(richData);
      setModelUsed('local');
      setInsightStats(finalStats);

      aiInsightCache.set(cacheKey, {
        greeting: finalGreeting,
        story: finalStoryRender,
        richContext: richData,
        modelUsed: 'local',
        insightStats: finalStats
      });

    } catch (err) {
      console.error('Error fetching insight:', err);
      if (isMountedRef.current) {
        setStory(`Maaf, AI sedang sibuk. Silakan refresh lagi ya! 🙏`);
        setGreeting(`Selamat ${getIndonesianTimeLabel()} ${userName}! 🌙`);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [activeTempat?.id, activeStoryId, fetchRichContext, generateSmartInsight, selectedStory]);

  const refresh = useCallback(() => {
    setStoryVersion(prev => prev + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (activeTempat?.id) fetchInsight();
    return () => { isMountedRef.current = false; };
  }, [activeTempat?.id, storyVersion, fetchInsight, selectedStory?.id]);

  return { greeting, story, insightStats, isLoading, modelUsed, richContext, refresh, setActiveStoryId };
}

// ============================================
// MODULAR STORY BUILDERS (TIDAK MENGULANG LAPORAN)
// ============================================
const STORY_STYLES = [
  {
    id: 'laporan',
    name: '📢 Hasil Laporan',
    build: (ctx, tempatName, selectedStory) => {
      let story = `📢 **AKAMSI AI — Analisa ${tempatName}**\n\n`;

      // JIKA ADA LAPORAN YANG DIKLIK - TAMPILKAN ANALISA PENDUKUNG, BUKAN LAPORAN ASLI
      if (selectedStory) {
        const teksUtama = dapatkanTeksLaporan(selectedStory);

        story += `🎯 **Analisa Pendukung Laporan Terpilih:**\n\n`;

        const teksLower = teksUtama.toLowerCase();
        const analisisTeks = [];

        // Hanya berikan insight pendukung, BUKAN mengulang laporan
        if (['antri', 'antrean', 'panjang', 'ular', 'ramai'].some(k => teksLower.includes(k))) {
          analisisTeks.push("⏳ Terdeteksi antrean - Disarankan mempersiapkan jalur alternatif.");
        }
        if (['habis', 'kosong', 'restock'].some(k => teksLower.includes(k))) {
          analisisTeks.push("📦 Indikasi stok terbatas - Cek ketersediaan sebelum berangkat.");
        }
        if (['lancar', 'aman', 'sepi'].some(k => teksLower.includes(k))) {
          analisisTeks.push("✅ Kondisi terpantau kondusif - Waktu tepat untuk berkunjung.");
        }
        if (['curang', 'pungli', 'mahal'].some(k => teksLower.includes(k))) {
          analisisTeks.push("⚠️ Ada keluhan pelayanan - Disarankan bertransaksi di loket resmi.");
        }

        if (selectedStory.traffic_condition) {
          analisisTeks.push(`🚗 Dampak lalu lintas: **${selectedStory.traffic_condition}** terhadap akses lokasi.`);
        }
        if (selectedStory.estimated_wait_time > 0) {
          analisisTeks.push(`⏱️ Estimasi waktu tunggu: **${selectedStory.estimated_wait_time} menit**.`);
        }

        if (analisisTeks.length > 0) {
          analisisTeks.forEach(ai => { story += `• ${ai}\n`; });
        } else {
          story += `• Tidak ada pola khusus terdeteksi. Kondisi dianggap normal.\n`;
        }

        story += `\n🕒 *Update: ${formatTimeAgo(selectedStory.created_at)}*\n`;
        story += `---\n\n`;
      }

      // RANGKUMAN KOLEKTIF - HANYA KESIMPULAN, BUKAN DAFTAR LAPORAN
      const allReports = ctx.laporanWarga || [];
      const otherReports = selectedStory
        ? allReports.filter(l => l.id !== selectedStory.id)
        : allReports;

      if (otherReports.length > 0) {
        story += `📊 **Kesimpulan dari ${otherReports.length} Laporan Warga:**\n\n`;

        const semuaTeksGabungan = otherReports.map(l => dapatkanTeksLaporan(l).toLowerCase()).join(' ');

        // Hanya KESIMPULAN, BUKAN daftar laporan individual
        if (['macet', 'padat', 'merayap', 'stuck'].some(k => semuaTeksGabungan.includes(k))) {
          story += `• 🚦 Laporan mengindikasikan potensi hambatan arus\n`;
        } else {
          story += `• 🚗 Arus lalu lintas relatif lancar berdasarkan laporan yang masuk\n`;
        }

        if (['solar', 'pertalite', 'pertamax', 'bensin'].some(k => semuaTeksGabungan.includes(k))) {
          story += `• ⛽ Ada laporan terkait ketersediaan BBM\n`;
        }

        if (['hujan', 'banjir', 'genangan'].some(k => semuaTeksGabungan.includes(k))) {
          story += `• 🌧️ Cuaca mempengaruhi kondisi lokasi\n`;
        }

        if (!['macet', 'solar', 'hujan'].some(k => ['macet', 'solar', 'hujan'].some(kw => semuaTeksGabungan.includes(kw)))) {
          story += `• 📌 Kondisi operasional normal tanpa anomali signifikan\n`;
        }

      } else if (!selectedStory) {
        story += `📭 Belum ada laporan masuk dari warga.\n💡 Ayo jadi pelopor informasi akurat di sini! 📝\n\n`;
      }

      story += `\n💡 **Rekomendasi AI:**\n`;
      story += `• Pantau terus update terbaru untuk informasi terkini\n`;
      story += `• Gunakan menu lain untuk melihat prediksi & aktivitas\n`;

      return story;
    }
  },
  {
    id: 'konteks',
    name: '🔗 Kondisi Sekitar',
    build: (ctx, tempatName) => {
      let story = `🔗 **${tempatName} & Sekitarnya**\n\n`;
      const tempatPengaruh = ctx.tempatTerhubung?.filter(t => ['MACET', 'RAMAI'].includes(t.tempat_terkait?.latest_condition));
      if (tempatPengaruh?.length > 0) {
        tempatPengaruh.forEach(t => {
          story += `📍 ${t.tempat_terkait?.name} (${t.jarak_km}km) sedang ${t.tempat_terkait?.latest_condition?.toLowerCase()}.\n   Potensi dampak ke ${tempatName}.\n\n`;
        });
      } else {
        story += `Tempat penyangga di sekitar ${tempatName} terpantau normal.\n\n`;
      }
      return story + `✨ Geser untuk insight lainnya! 🔄`;
    }
  },
  {
    id: 'layanan',
    name: '🤝 Layanan & UMKM',
    build: (ctx, tempatName) => {
      let story = `🤝 **Layanan & Usaha di ${tempatName}**\n\n`;
      const rewang = ctx.layananWarga?.find(l => l.kategori_layanan === 'rewang');
      const ojek = ctx.layananWarga?.find(l => l.kategori_layanan === 'ojek_warga');

      if (rewang) story += `🫱 **Rewang:** Aktif. Respon sekitar ${rewang.estimasi_waktu_respon_menit || 'cepat'} menit.\n\n`;
      if (ojek) story += `🛵 **Ojek Warga:** Ada ${ojek.jumlah_provider_aktif || 'beberapa'} pengemudi siap.\n\n`;

      if (ctx.umkmProduk?.length > 0) {
        story += `🛍️ **UMKM sekitar:** ${ctx.umkmProduk.length} produk tersedia\n`;
      }
      if (!rewang && !ojek && !ctx.umkmProduk?.length) {
        story += `Belum ada data layanan atau UMKM hari ini.\n\n`;
      }
      return story + `✨ Geser untuk insight lainnya! 🔄`;
    }
  },
  {
    id: 'prediksi',
    name: '🔮 Prediksi AI',
    build: (ctx, tempatName) => {
      let story = `🔮 **Prediksi Kondisi ${tempatName}**\n\n`;
      const nowHour = new Date().getHours();
      const prediksiSekarang = ctx.prediksi?.find(p => Math.abs(nowHour - parseInt(p.jam_prediksi?.split(':')[0] || '0')) <= 2);

      if (prediksiSekarang) {
        story += `Estimasi jam ${prediksiSekarang.jam_prediksi?.substring(0, 5)} WIB:\n`;
        story += `📊 ${prediksiSekarang.prediksi_kondisi}\n`;
        story += `🎯 Akurasi: ${Math.round((prediksiSekarang.prediksi_skor || 0.5) * 100)}%\n\n`;
      } else if (ctx.prediksi?.length > 0) {
        story += `Prediksi tersedia untuk jam: ${ctx.prediksi.map(p => p.jam_prediksi?.substring(0, 5)).join(', ')}\n\n`;
      } else {
        story += `Data belum cukup untuk prediksi akurat.\n\n`;
      }
      return story + `✨ Geser untuk insight lainnya! 🔄`;
    }
  },
  {
    id: 'riwayat',
    name: '📜 Riwayat & Kejadian',
    build: (ctx, tempatName) => {
      let story = `📜 **Catatan Historis ${tempatName}**\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];

      const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran'];
      const daruratMasaLalu = (ctx.laporanWarga || []).filter(l => {
        const tglLaporan = l.created_at?.split('T')[0] || '';
        const teks = dapatkanTeksLaporan(l).toLowerCase();
        return tglLaporan !== todayStr && emergencyKeywords.some(kw => teks.includes(kw));
      });

      if (daruratMasaLalu.length > 0) {
        story += `⏳ **Kilas Balik Kejadian:**\n`;
        story += `• ${daruratMasaLalu.length} insiden terekam di periode lalu\n`;
        story += `• Status saat ini: Kondisi terpantau pulih\n\n`;
      }

      if (ctx.insidenHistoris?.length > 0) {
        story += `📌 **Arsip Peristiwa:**\n`;
        ctx.insidenHistoris.slice(0, 2).forEach(i => {
          const tanggal = i.tanggal_mulai ? new Date(i.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Waktu lampau';
          story += `• *${tanggal}* — ${i.judul}\n`;
        });
      } else if (daruratMasaLalu.length === 0) {
        story += `Tidak ada catatan kejadian besar di masa lampau.\n\n`;
      }

      return story + `✨ Geser untuk insight lainnya! 🔄`;
    }
  },
  {
    id: 'aktivitas',
    name: '👥 Aktivitas Warga',
    build: (ctx, tempatName) => {
      let story = `👥 **Kegiatan di ${tempatName}**\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];
      const aktivitasHariIni = ctx.aktivitasWarga?.filter(a => a.tanggal_mulai === todayStr);

      if (aktivitasHariIni?.length > 0) {
        story += `📅 **Agenda Hari Ini:**\n`;
        aktivitasHariIni.forEach(a => {
          story += `   • ${a.judul_aktivitas}${a.estimasi_peserta ? ` (${a.estimasi_peserta} peserta)` : ''}\n`;
        });
        story += `\n`;
      }

      const nowHour = new Date().getHours();
      const currentDay = new Date().toLocaleDateString('id', { weekday: 'long' });
      const aktivitasRutin = ctx.aktivitasBerkala?.find(a =>
        a.hari === currentDay &&
        parseInt(a.jam_mulai?.split(':')[0] || '0') <= nowHour &&
        parseInt(a.jam_selesai?.split(':')[0] || '23') >= nowHour
      );

      if (aktivitasRutin) {
        story += `⏰ **Sedang Berlangsung:** ${aktivitasRutin.nama_aktivitas}\n\n`;
      }

      if (!aktivitasHariIni?.length && !aktivitasRutin) {
        story += `Tidak ada agenda kegiatan terjadwal hari ini.\n\n`;
      }

      return story + `✨ Geser untuk insight lainnya! 🔄`;
    }
  },
  {
    id: 'karakter',
    name: '📍 Karakter Tempat',
    build: (ctx, tempatName) => {
      let story = `📍 **Karakteristik ${tempatName}**\n\n`;

      if (ctx.metadata) {
        const tipeMap = {
          masjid: '🕌 Tempat Ibadah',
          industri: '🏭 Kawasan Industri',
          sekolah: '🏫 Lingkungan Pendidikan',
          rs: '🏥 Fasilitas Kesehatan',
          mall: '🛍️ Pusat Perbelanjaan',
          wisata: '🏖️ Destinasi Wisata',
          kantor: '🏢 Kawasan Perkantoran'
        };
        story += `Jenis: **${tipeMap[ctx.metadata.tipe_utama] || 'Lokasi Umum'}**\n`;
        if (ctx.metadata.kapasitas_normal) {
          story += `📏 Kapasitas normal: ~${ctx.metadata.kapasitas_normal} orang\n`;
        }
        story += `\n`;
      }

      if (ctx.layananTersedia?.length > 0) {
        story += `🏢 **Fasilitas Tersedia:**\n`;
        ctx.layananTersedia.slice(0, 4).forEach(l => {
          story += `   • ${l.sub_layanan}\n`;
        });
        story += `\n`;
      }

      return story + `✨ Geser untuk insight lainnya! 🔄`;
    }
  }
];