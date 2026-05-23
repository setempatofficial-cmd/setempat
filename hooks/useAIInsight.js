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

// HELPER AMAN: Menggali teks laporan dari objek terlepas dari penamaan properti di UI/DB
function dapatkanTeksLaporan(obj) {
  if (!obj) return '';
  return obj.deskripsi || obj.content || obj.deskripsi_ai || obj.isi_laporan || '';
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
  // AMBIL DATA USER (FIX: ANTI STOLEN LOCK AUTH)
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

  // Reset tab aktif ke 'laporan' jika tempat berpindah lokasi
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

  function isEmergency(context) {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Cek dari Selected Story yang sedang diklik (Harus Kejadian Hari Ini)
    if (selectedStory) {
      const selectedText = dapatkanTeksLaporan(selectedStory).toLowerCase();
      const storyDateStr = selectedStory.created_at ? selectedStory.created_at.split('T')[0] : '';

      if (storyDateStr === todayStr && ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran', 'pohon tumbang'].some(kw => selectedText.includes(kw))) {
        return true;
      }
    }

    // 2. Cek dari Laporan Kolektif Warga (Harus Kejadian Hari Ini)
    const { laporanWarga, externalSignals } = context;
    const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran', 'pohon tumbang'];

    // Filter laporan & signals yang HANYA terjadi hari ini
    const liveEmergencyReports = [
      ...(laporanWarga || []).filter(l => l.created_at && l.created_at.split('T')[0] === todayStr),
      ...(externalSignals || []).filter(s => s.created_at && s.created_at.split('T')[0] === todayStr)
    ];

    const allTexts = liveEmergencyReports.map(item => `${dapatkanTeksLaporan(item)} ${item.content || ''}`.toLowerCase()).join(' ');
    return emergencyKeywords.some(kw => allTexts.includes(kw));
  }

  // ============================================
  // FETCH RICH CONTEXT (OPTIMAL: PARALEL PROMISE)
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
  // GENERATE SMART INSIGHT (SENSITIF WAKTU DARURAT)
  // ============================================
  const generateSmartInsight = useCallback((context, storyId = 'laporan', userName = 'Warga') => {
    const tempatName = activeTempat?.name || 'tempat ini';
    const emergency = isEmergency(context); // Ini otomatis mengunci hanya untuk HARI INI
    let fullStory = '';
    let selectedStyle = null;

    if (emergency) {
      // MODE AKTIF: Jika beneran ada kejadian darurat BARU HARI INI
      fullStory = `🚨 **PERINGATAN DARURAT WILAYAH!** 🚨\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];

      let emergencyReports = [...(context.laporanWarga || []), ...(context.externalSignals || [])]
        .filter(r => r.created_at && r.created_at.split('T')[0] === todayStr); // Kunci hari ini

      if (selectedStory) {
        emergencyReports = [selectedStory, ...emergencyReports.filter(r => r.id !== selectedStory.id)];
      }

      const filteredEmergency = emergencyReports.filter(item => {
        const text = `${dapatkanTeksLaporan(item)} ${item.content || ''}`.toLowerCase();
        return ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran', 'pohon tumbang'].some(kw => text.includes(kw));
      });

      if (filteredEmergency.length > 0) {
        fullStory += `📢 **Kejadian Genting Hari Ini:**\n`;
        filteredEmergency.slice(0, 2).forEach(r => {
          const teksEmergency = dapatkanTeksLaporan(r);
          fullStory += `   • "${teksEmergency.substring(0, 120)}"\n`;
          fullStory += `     — *Waktu: ${formatTimeAgo(r.created_at)}* (@${r.username || r.user_name || 'warga'})\n\n`;
        });
      }

      fullStory += `⚠️ **Hati-hati, Lur!** Arus penanganan darurat sedang berjalan.\n🚧 Mohon kurangi kecepatan atau hindari area jika tidak mendesak.\n\n✨ Tetap utamakan keselamatan bersama! 🙏`;
      selectedStyle = { name: '🚨 DARURAT' };
    } else {
      // MODE NORMAL: Berjalan sesuai tab menu yang dipilih user (Laporan, Prediksi, Riwayat, dll)
      selectedStyle = STORY_STYLES.find(s => s.id === storyId) || STORY_STYLES[0];
      fullStory = selectedStyle.build(context, tempatName, selectedStory);
    }

    const { text: timeGreeting, icon: timeIcon } = getTimeGreeting();

    const finalGreeting = emergency
      ? `🚨 ${timeGreeting} ${userName}! Ada kejadian darurat di ${tempatName}!`
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
  // CORE FETCH INSIGHT (FIXED: AUTO-FETCH SELECTED STORY)
  // ============================================
  const fetchInsight = useCallback(async () => {
    if (fetchingRef.current || !activeTempat?.id) return;

    // 1. Ambil nama user aktif (Live)
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
      // 2. Tarik data konseptual tempat secara paralel
      const richData = await fetchRichContext(activeTempat.id);
      if (!isMountedRef.current) return;

      // 3. INVESTIGASI SELECTED STORY: Jika data teks kosong, ambil langsung ke database!
      let storyTerpilihLengkap = selectedStory;
      if (selectedStory && !dapatkanTeksLaporan(selectedStory) && selectedStory.id) {
        const { data: detailLaporan } = await supabase
          .from('laporan_warga')
          .select('*')
          .eq('id', selectedStory.id)
          .maybeSingle();

        if (detailLaporan) {
          storyTerpilihLengkap = detailLaporan;
        }
      }

      // 4. Injeksi data yang sudah divalidasi ke generator insight 
      // FIX CRITICAL: Gunakan 'storyTerpilihLengkap' langsung saat build awal insight
      const { finalGreeting, fullStory, finalStats } = generateSmartInsight(richData, activeStoryId, userName);

      // 5. Verifikasi Akhir Teks Render Cerita
      let finalStoryRender = fullStory;
      if (storyTerpilihLengkap) {
        // FIX CRITICAL: Gunakan fungsi helper 'dapatkanTeksLaporan' agar deteksi kolom dinamis (deskripsi/content) akurat!
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
        setStory(`Maaf lur, Mbah AI lagi sibuk. Coba refresh lagi ya! 🙏\n\n✨ Klik 🔄 untuk coba lagi.`);
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
    if (activeTempat?.id) {
      fetchInsight();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [activeTempat?.id, storyVersion, fetchInsight, selectedStory?.id]);

  return { greeting, story, insightStats, isLoading, modelUsed, richContext, refresh, setActiveStoryId };
}

// ============================================
// MODULAR STORY BUILDERS (7 GAYA CERITA)
// ============================================
const STORY_STYLES = [
  {
    id: 'laporan',
    name: '📢 Hasil Laporan',
    build: (ctx, tempatName, selectedStory) => {
      let story = `📢 **AKAMSI AI — Pantauan ${tempatName}**\n\n`;

      // 1. JIKA ADA STORY/VIDEO SPESIFIK YANG SEDANG DIKLIK
      if (selectedStory) {
        const teksUtama = dapatkanTeksLaporan(selectedStory);
        story += `🎯 **Rangkuman Laporan Terpilih:**\n`;

        // --- DIATUNG NANG KENE, CAK ---
        if (teksUtama) {
          const ringkasanTeks = teksUtama.length > 120
            ? `${teksUtama.substring(0, 120)}...`
            : teksUtama;
          story += `💬 *"${ringkasanTeks}"*\n`;
        } else {
          // Ganti teks error dadi info visual cerdas sing mbois
          const lalinInfo = selectedStory.traffic_condition
            ? `Kondisi lalu lintas terpantau **${selectedStory.traffic_condition.toLowerCase()}**`
            : 'Situasi terekam via visual';
          story += `📷 *[${lalinInfo} — Dikirim tanpa catatan teks]*\n`;
        }

        // Ekstraksi Otomatis berbasis isi Teks Deskripsi/Content
        const teksLower = teksUtama.toLowerCase();
        let analisisTeks = [];

        if (['antri', 'antrean', 'panjang', 'ular', 'ramai'].some(k => teksLower.includes(k))) {
          analisisTeks.push("⏳ Warga mengeluhkan adanya antrean/kepadatan di titik pelayanan.");
        }
        if (['habis', 'kosong', 'restock', 'gajek'].some(k => teksLower.includes(k))) {
          analisisTeks.push("❌ Terindikasi ada stok/fasilitas yang sedang kosong atau habis.");
        }
        if (['lancar', 'aman', 'sepi', 'sunyi'].some(k => teksLower.includes(k))) {
          analisisTeks.push("✅ Situasi spesifik di laporan ini terpantau kondusif atau longgar.");
        }
        if (['curang', 'pungli', 'mahal', 'tengkulak'].some(k => teksLower.includes(k))) {
          analisisTeks.push("⚠️ Catatan: Ada keluhan sensitif terkait pelayanan/harga di lokasi.");
        }

        // Gabungkan analisa teks dengan data kolom pendukung jika ada
        if (selectedStory.traffic_condition) {
          analisisTeks.push(`🚗 Arus lalu lintas: **${selectedStory.traffic_condition}**.`);
        }
        if (selectedStory.estimated_wait_time > 0) {
          analisisTeks.push(`⏱️ Estimasi nunggu di lokasi sekitar **${selectedStory.estimated_wait_time} menit**.`);
        }

        if (analisisTeks.length > 0) {
          story += `\n🧠 **Intisari AI Setempat:**\n`;
          analisisTeks.forEach(ai => { story += `• ${ai}\n`; });
        }

        story += `🕒 *Dilaporkan: ${formatTimeAgo(selectedStory.created_at)}*\n\n`;
        story += `---\n\n`;
      }

      // 2. RANGKUMAN KUMULATIF DARI SELURUH LAPORAN WARGA LAIN DI TABEL
      if (ctx.laporanWarga?.length > 0) {
        const laporanLainnya = selectedStory
          ? ctx.laporanWarga.filter(l => l.id !== selectedStory.id)
          : ctx.laporanWarga;

        story += `📊 **Kondisi Gabungan Sekitar (Kolektif):**\n`;

        const semuaTeksGabungan = laporanLainnya.map(l => dapatkanTeksLaporan(l).toLowerCase()).join(' ');

        let kesimpulanKolektif = [];
        if (['macet', 'padat', 'merayap', 'stuck'].some(k => semuaTeksGabungan.includes(k))) {
          kesimpulanKolektif.push("Banyak laporan mengeluhkan hambatan arus jalan terdekat.");
        }
        if (['solar', 'pertalite', 'pertamax', 'bensin', 'pertalit'].some(k => semuaTeksGabungan.includes(k))) {
          kesimpulanKolektif.push("Fokus utama interaksi warga saat ini berkaitan dengan ketersediaan / antrean BBM.");
        }
        if (['hujan', 'banjir', 'genangan', 'becek'].some(k => semuaTeksGabungan.includes(k))) {
          kesimpulanKolektif.push("Faktor cuaca/alam dilaporkan sedang mempengaruhi kenyamanan lokasi.");
        }

        if (kesimpulanKolektif.length > 0) {
          kesimpulanKolektif.forEach(kolektif => { story += `• 📌 ${kolektif}\n`; });
        } else {
          story += `• 📌 Secara umum, laporan warga mengarah pada kondisi operasional normal.\n`;
        }

        const cuplikanLaporan = laporanLainnya.slice(0, 2);
        if (cuplikanLaporan.length > 0) {
          story += `\n📋 **Suara Warga Sekitar:**\n`;
          cuplikanLaporan.forEach(l => {
            const txt = dapatkanTeksLaporan(l);
            if (txt) {
              story += `  👉 "${txt.substring(0, 50)}..." (*${formatTimeAgo(l.created_at)}*)\n`;
            }
          });
        }
      } else if (!selectedStory) {
        story += `Belum ada kiriman info masuk dari warga untuk ${tempatName}. Ayo jadi pelopor informasi di kene, Lur! 📝\n\n`;
      }

      return story + `\n✨ Geser menu di bawah untuk melihat hasil prediksi cerdas atau aktivitas wilayah!`;
    }
  },
  {
    id: 'konteks',
    name: '🔗 Kondisi Sekitar Lokasi',
    build: (ctx, tempatName) => {
      let story = `🔗 **${tempatName} & Sekitarnya**\n\n`;
      const tempatPengaruh = ctx.tempatTerhubung?.filter(t => ['MACET', 'RAMAI'].includes(t.tempat_terkait?.latest_condition));
      if (tempatPengaruh?.length > 0) {
        tempatPengaruh.forEach(t => {
          story += `📍 ${t.tempat_terkait?.name} (${t.jarak_km}km) sedang ${t.tempat_terkait?.latest_condition.toLowerCase()}.\n   Ini berpotensi merembet ke ${tempatName}.\n\n`;
        });
      } else {
        story += `Tempat-tempat penyangga di sekitar ${tempatName} terpantau normal dan lancar.\n\n`;
      }
      return story + `✨ Refresh untuk cerita lain atau klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'layanan',
    name: '🤝 Pantauan Layanan & UMKM',
    build: (ctx, tempatName) => {
      let story = `🤝 **Layanan & Usaha di ${tempatName}**\n\n`;
      const rewang = ctx.layananWarga?.find(l => l.kategori_layanan === 'rewang');
      const ojek = ctx.layananWarga?.find(l => l.kategori_layanan === 'ojek_warga');

      if (rewang) story += `🫱 **Kesiapan Rewang:** Aktif membantu. Respon kisaran ${rewang.estimasi_waktu_respon_menit || 'cepat'} menit.\n\n`;
      if (ojek) story += `🛵 **Ojek Warga:** Standby di pangkalan. Ada ${ojek.jumlah_provider_aktif || 'beberapa'} pengemudi siap meluncur.\n\n`;

      if (ctx.umkmProduk?.length > 0) {
        story += `🛍️ **Geliat UMKM sekitar:**\n`;
        ctx.umkmProduk.slice(0, 3).forEach(u => { story += `   • ${u.nama_produk} — *${u.nama_toko}*\n`; });
        story += `\n`;
      }
      if (!rewang && !ojek && !ctx.umkmProduk?.length) story += `Belum ada entitas layanan warga atau UMKM terdata hari ini.\n\n`;
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
        const prediksiSekarang = ctx.prediksi.find(p => Math.abs(nowHour - parseInt(p.jam_prediksi?.split(':')[0] || '0')) <= 2);
        if (prediksiSekarang) {
          story += `Estimasi sekitar jam ${prediksiSekarang.jam_prediksi?.substring(0, 5)} WIB:\n📊 ${prediksiSekarang.prediksi_kondisi}\n🎯 Akurasi data historis: ${Math.round((prediksiSekarang.prediksi_skor || 0.5) * 100)}%\n\n`;
        }
      } else {
        story += `Sistem belum mengumpulkan basis data yang cukup untuk memprediksi pola jam ini.\n\n`;
      }
      return story + `✨ Refresh untuk cerita lain atau klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'riwayat',
    name: '📜 Hasil Riwayat & Kejadian',
    build: (ctx, tempatName) => {
      let story = `📜 **Catatan Historis & Kilas Balik ${tempatName}**\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];

      // Ambil laporan darurat dari database yang sudah LEWAT hari-hari sebelumnya (Flashback)
      const emergencyKeywords = ['kecelakaan', 'korban', 'luka', 'darurat', 'banjir', 'kebakaran', 'pohon tumbang'];
      const daruratMasaLalu = (ctx.laporanWarga || []).filter(l => {
        const tglLaporan = l.created_at ? l.created_at.split('T')[0] : '';
        const teks = dapatkanTeksLaporan(l).toLowerCase();
        return tglLaporan !== todayStr && emergencyKeywords.some(kw => teks.includes(kw));
      });

      // 1. Jika ada memori insiden darurat warga tempo hari, tampilkan sebagai Flashback Sambutan
      if (daruratMasaLalu.length > 0) {
        story += `⏳ **Kilas Balik Kejadian Wilayah:**\n`;
        daruratMasaLalu.slice(0, 2).forEach(d => {
          const tglFormat = new Date(d.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          story += `⚠️ *Flashback (${tglFormat})*: Pernah terjadi insiden \n   "${dapatkanTeksLaporan(d).substring(0, 90)}..."\n   *Status saat ini: Kondisi terpantau sudah pulih/kondusif.*\n\n`;
        });
        story += `---\n\n`;
      }

      // 2. Tetap tampilkan arsip besar tempat jika ada
      if (ctx.insidenHistoris?.length > 0) {
        story += `📌 **Arsip Peristiwa Besar:**\n`;
        ctx.insidenHistoris.slice(0, 2).forEach(i => {
          const tanggal = i.tanggal_mulai ? new Date(i.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Waktu lampau';
          story += `• *${tanggal}* — **${i.judul}**\n${i.deskripsi ? `  ${i.deskripsi.substring(0, 100)}...\n` : ''}\n`;
        });
      } else if (daruratMasaLalu.length === 0) {
        story += `Arsip digital belum mencatat adanya peristiwa darurat atau kejadian besar di masa lampau, Lur. Wilayah aman tentram!\n\n`;
      }

      return story + `✨ Refresh untuk cerita lain atau klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'aktivitas',
    name: '👥 Pantauan Aktivitas Warga',
    build: (ctx, tempatName) => {
      let story = `👥 **Kegiatan Kolektif di ${tempatName}**\n\n`;
      const todayStr = new Date().toISOString().split('T')[0];
      const aktivitasHariIni = ctx.aktivitasWarga?.filter(a => a.tanggal_mulai === todayStr);

      if (aktivitasHariIni?.length > 0) {
        story += `📅 **Agenda Hari Ini:**\n`;
        aktivitasHariIni.forEach(a => { story += `   • ${a.judul_aktivitas}${a.estimasi_peserta ? ` (~${a.estimasi_peserta} warga)` : ''}\n`; });
        story += `\n`;
      }

      const nowHour = new Date().getHours();
      const currentDay = new Date().toLocaleDateString('id', { weekday: 'long' });
      const aktivitasRutin = ctx.aktivitasBerkala?.find(a => a.hari === currentDay && parseInt(a.jam_mulai?.split(':')[0] || '0') <= nowHour && parseInt(a.jam_selesai?.split(':')[0] || '23') >= nowHour);

      if (aktivitasRutin) story += `⏰ **Rutin Jam Sini:**\n   Sedang berlangsung: *${aktivitasRutin.nama_aktivitas}*\n\n`;
      if (!aktivitasHariIni?.length && !aktivitasRutin) story += `Agenda kegiatan warga terpantau nihil/lowong untuk hari ini.\n\n`;
      return story + `✨ Refresh untuk cerita lain atau klik pojok kanan bawah! 🔄`;
    }
  },
  {
    id: 'karakter',
    name: '📍 Hasil Pengamatan Karakter Tempat',
    build: (ctx, tempatName) => {
      let story = `📍 **Karakteristik Wilayah ${tempatName}**\n\n`;
      if (ctx.metadata) {
        const tipeMap = { masjid: '🕌 Zona Peribadatan', industri: '🏭 Kawasan Perindustrian', sekolah: '🏫 Lingkungan Pendidikan', rs: '🏥 Fasilitas Kesehatan', mall: '🛍️ Pusat Perbelanjaan', wisata: '🏖️ Destinasi Publik/Wisata', kantor: '🏢 Klaster Administrasi' };
        story += `Klasifikasi: **${tipeMap[ctx.metadata.tipe_utama] || '📍 Sektor Terbuka'}** ${tempatName}${ctx.metadata.kapasitas_normal ? `\n📏 Ambang Batas Normal: ~${ctx.metadata.kapasitas_normal} mobilitas orang` : ''}\n\n`;
      }
      if (ctx.layananTersedia?.length > 0) {
        story += `🏢 **Prasarana Terdekat:**\n`;
        ctx.layananTersedia.slice(0, 4).forEach(l => { story += `   • ${l.sub_layanan}\n`; });
        story += `\n`;
      }
      return story + `✨ Refresh untuk cerita lain atau klik pojok kanan bawah! 🔄`;
    }
  }
];