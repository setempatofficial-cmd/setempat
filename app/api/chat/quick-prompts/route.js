// app/api/chat/quick-prompts/route.js (VERSION FINAL)

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { tempatId, userId } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ambil data tempat dari feed_view
    const { data: tempat } = await supabase
      .from('feed_view')
      .select('id, name, category, alamat, jam_buka, daftar_produk, personil_sekitar')
      .eq('id', tempatId)
      .single();

    // Ambil laporan terbaru
    const { data: laporan } = await supabase
      .from('laporan_warga')
      .select('tipe, deskripsi')
      .eq('tempat_id', tempatId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1);

    // Ambil nama user
    let userName = "Warga";
    if (userId) {
      const { data: user } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', userId)
        .single();
      userName = user?.full_name?.split(' ')[0] || user?.username || "Warga";
    }

    // Generate greeting & prompts
    const { greeting, quickPrompts } = generateContextualPrompts(tempat, laporan?.[0], userName);

    return NextResponse.json({
      success: true,
      greeting,
      quickPrompts,
      tempatInfo: {
        name: tempat.name,
        category: tempat.category
      }
    });

  } catch (error) {
    console.error("Quick prompts error:", error);
    return NextResponse.json({
      success: false,
      greeting: "Halo! 👋 Ada yang bisa saya bantu?",
      quickPrompts: [
        { text: "Info tentang tempat ini?", icon: "ℹ️" },
        { text: "Jam operasionalnya?", icon: "🕐" },
        { text: "Gimana kondisinya sekarang?", icon: "📊" }
      ]
    });
  }
}

// ==================== GET KONDISI TEXT ====================
function getKondisiText(kondisi, kategori) {
  if (!kondisi) return "kondisi normal 😊";

  // PUSKESMAS / RUMAH SAKIT / KLINIK
  if (kategori === 'puskesmas' || kategori === 'rumah sakit' || kategori === 'klinik') {
    if (kondisi === "Sepi") return "lagi sepi, tidak terlalu ramai pasien 🍃";
    if (kondisi === "Ramai") return "sedang ramai pasien, siap-siap antri 🔥";
    if (kondisi === "Antri") return "ada antrian panjang ⏳, sabar ya!";
  }

  // KANTOR / BALAI DESA
  if (kategori === 'kantor' || kategori === 'balai desa') {
    if (kondisi === "Sepi") return "lagi sepi, cocok buat ngurus administrasi 📋";
    if (kondisi === "Ramai") return "sedang ramai pengunjung 🔥";
    if (kondisi === "Antri") return "ada antrian panjang ⏳";
  }

  // KAFE / RESTO / WISATA (default)
  if (kondisi === "Sepi") return "lagi sepi, cocok buat santai 🍃";
  if (kondisi === "Ramai") return "sedang ramai, rame banget! 🔥";
  if (kondisi === "Antri") return "ada antrian panjang ⏳";

  return "kondisi normal 😊";
}

// ==================== GENERATE CONTEXTUAL PROMPTS ====================
function generateContextualPrompts(tempat, latestReport, userName) {
  const category = tempat?.category?.toLowerCase() || "umum";
  const waktu = new Date().getHours();
  const salam = waktu < 10 ? "Pagi" : waktu < 15 ? "Siang" : waktu < 18 ? "Sore" : "Malam";

  // ✅ Gunakan fungsi getKondisiText
  const kondisiText = getKondisiText(latestReport?.tipe, category);

  // GREETING BERDASARKAN KATEGORI
  let greeting = "";
  let quickPrompts = [];

  switch (category) {
    case "kantor":
    case "kantor desa":
    case "balai desa":
      greeting = `Halo ${userName}! Selamat ${salam}. 👋\n\nIni **${tempat.name}**, ${kondisiText}\n\nAda keperluan administrasi? Saya siap bantu!`;
      quickPrompts = [
        { text: "Cara membuat surat pengantar KTP?", icon: "📝", context: "surat" },
        { text: "Program bantuan apa yang sedang berjalan?", icon: "📋", context: "program" },
        { text: "Jam pelayanan kantor?", icon: "🕐", context: "jam" },
        { text: "Nomor whatsapp untuk info?", icon: "📱", context: "kontak" }
      ];
      break;

    case "rumah sakit":
    case "rs":
    case "klinik":
    case "puskesmas":
      greeting = `Halo ${userName}, selamat ${salam}. 🏥\n\nIni **${tempat.name}**, ${kondisiText}\n\nAda keluhan atau perlu info seputar kesehatan?`;
      quickPrompts = [
        { text: "Jam buka puskesmas?", icon: "🏥", context: "jam" },
        { text: "Cara daftar BPJS online?", icon: "💳", context: "bpjs" },
        { text: "Antrian poli umum sekarang?", icon: "⏳", context: "antrian" },
        { text: "Ada dokter spesialis?", icon: "👨‍⚕️", context: "dokter" }
      ];
      break;

    case "kafe":
    case "coffee shop":
    case "resto":
    case "rumah makan":
    case "warung":
      greeting = `Halo ${userName}! Selamat ${salam} ☕\n\n**${tempat.name}** ${kondisiText}\n\nMau pesan apa atau tanya menu rekomendasi?`;
      quickPrompts = [
        { text: "Menu yang paling laris?", icon: "☕", context: "menu" },
        { text: "Ada wifi dan colokan listrik?", icon: "📶", context: "fasilitas" },
        { text: "Buka sampai jam berapa?", icon: "🕐", context: "jam" },
        { text: "Ada promo atau diskon?", icon: "🏷️", context: "promo" }
      ];
      break;

    case "sekolah":
    case "sd":
    case "smp":
    case "sma":
    case "kampus":
    case "universitas":
      greeting = `Halo ${userName}, selamat ${salam}. 🎓\n\nIni halaman **${tempat.name}**, ${kondisiText}\n\nAda yang ingin ditanyakan seputar sekolah?`;
      quickPrompts = [
        { text: "Pendaftaran siswa baru kapan?", icon: "📝", context: "pendaftaran" },
        { text: "Biaya sekolah berapa?", icon: "💰", context: "biaya" },
        { text: "Fasilitas apa saja yang tersedia?", icon: "🏫", context: "fasilitas" },
        { text: "Kegiatan ekstrakurikuler?", icon: "⚽", context: "ekskul" }
      ];
      break;

    case "masjid":
    case "musholla":
    case "gereja":
    case "pura":
    case "vihara":
      greeting = `Halo ${userName}, selamat ${salam}. 🕌\n\nIni **${tempat.name}**, ${kondisiText}\n\nAda yang bisa saya bantu?`;
      quickPrompts = [
        { text: "Jadwal ibadah?", icon: "📅", context: "jadwal" },
        { text: "Kajian rutin?", icon: "📖", context: "kajian" },
        { text: "Info donasi?", icon: "🤲", context: "donasi" },
        { text: "Parkirnya luas?", icon: "🚗", context: "parkir" }
      ];
      break;

    case "wisata":
    case "taman":
    case "pantai":
    case "gunung":
    case "air terjun":
    case "candi":
      greeting = `Halo ${userName}! Selamat ${salam}. 🏞️\n\n**${tempat.name}** ${kondisiText}\n\nMau tanya harga tiket, jam buka, atau rute ke sini?`;
      quickPrompts = [
        { text: "Harga tiket masuk?", icon: "🎫", context: "harga" },
        { text: "Jam operasional?", icon: "🕐", context: "jam" },
        { text: "Spot foto terbaik?", icon: "📸", context: "spot" },
        { text: "Ada penginapan?", icon: "🏨", context: "penginapan" }
      ];
      break;

    case "pasar":
    case "mall":
    case "plaza":
    case "toko":
    case "supermarket":
      greeting = `Halo ${userName}, selamat ${salam}. 🛒\n\n**${tempat.name}** ${kondisiText}\n\nMau cari info tentang harga atau lapak tertentu?`;
      quickPrompts = [
        { text: "Harga kebutuhan pokok?", icon: "🌶️", context: "harga" },
        { text: "Buka hari apa saja?", icon: "📅", context: "jadwal" },
        { text: "Ada promo?", icon: "🏷️", context: "promo" },
        { text: "Parkir luas?", icon: "🚗", context: "parkir" }
      ];
      break;

    case "bengkel":
    case "service":
    case "montir":
      greeting = `Halo ${userName}, selamat ${salam}. 🔧\n\n**${tempat.name}** ${kondisiText}\n\nAda masalah dengan kendaraan? Saya bantu cari info!`;
      quickPrompts = [
        { text: "Service apa saja?", icon: "🔧", context: "service" },
        { text: "Estimasi biaya?", icon: "💰", context: "biaya" },
        { text: "Jam buka?", icon: "🕐", context: "jam" },
        { text: "Teknisi panggilan?", icon: "📞", context: "teknisi" }
      ];
      break;

    default:
      greeting = `Halo ${userName}! Selamat ${salam}. 👋\n\nIni **${tempat.name}**, ${kondisiText}\n\nAda yang bisa saya bantu tentang tempat ini?`;

      if (tempat.daftar_produk?.length > 0) {
        quickPrompts.push({ text: "Menu atau produk yang tersedia?", icon: "🍽️", context: "menu" });
      }
      if (tempat.personil_sekitar?.length > 0) {
        quickPrompts.push({ text: "Ada driver atau rewang online?", icon: "🚗", context: "driver" });
      }
      quickPrompts.push(
        { text: "Info lengkap tentang tempat ini?", icon: "ℹ️", context: "info" },
        { text: "Jam operasional?", icon: "🕐", context: "jam" },
        { text: "Review dari warga lain?", icon: "⭐", context: "review" }
      );
      break;
  }

  // Batasi 4 prompt teratas
  quickPrompts = quickPrompts.slice(0, 4);

  return { greeting, quickPrompts };
}