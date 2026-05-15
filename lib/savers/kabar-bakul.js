// lib/savers/kabar-bakul.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Fungsi utama untuk menyimpan data ke tabel kabar_bakul
 * Bisa menerima single object atau array of objects
 * @param {Object|Array} data - Data kabar bakul (bisa tunggal atau array)
 * @param {Object|null} matchResult - Hasil matching tempat (optional)
 * @returns {Promise<number>} - Jumlah data yang berhasil disimpan
 */
export async function saveToKabarBakul(data, matchResult = null) {
  // Jika data berupa array, proses satu per satu
  if (Array.isArray(data)) {
    let savedCount = 0;
    for (const item of data) {
      const result = await saveSingleKabarBakul(item, matchResult);
      if (result) savedCount++;
    }
    return savedCount;
  }
  
  // Single item
  return (await saveSingleKabarBakul(data, matchResult)) ? 1 : 0;
}

/**
 * Fungsi internal untuk menyimpan satu item kabar bakul
 * @param {Object} item - Item kabar bakul
 * @param {Object|null} matchResult - Hasil matching tempat
 * @returns {Promise<boolean>} - Berhasil atau tidak
 */
async function saveSingleKabarBakul(item, matchResult) {
  // Validasi minimal: harus ada judul
  if (!item.judul || item.judul.length < 5) {
    console.log('⚠️ Skipping kabar_bakul: judul terlalu pendek');
    return false;
  }

  // Tentukan sumber default jika tidak ada
  const source = item.sumber || (item.source === 'WartaBromo' ? 'WartaBromo' : 'SISKAPERBAPO');

  // Tentukan jenis_kabar default jika tidak ada
  const jenisKabar = item.jenis_kabar || 'ekonomi';

  // Tentukan target lokasi
  let targetLokasi = item.target_lokasi || null;
  if (!targetLokasi && matchResult?.tempat?.name) {
    targetLokasi = matchResult.tempat.name.split(',')[0].trim();
  }

  // Tentukan is_global (default: true jika tidak ada target lokasi)
  const isGlobal = item.is_global !== undefined ? item.is_global : !targetLokasi;

  // Siapkan data untuk insert
  const kabarData = {
    jenis_kabar: jenisKabar,
    sumber: source,
    judul: item.judul.substring(0, 150),
    konten: (item.konten || item.judul || '').substring(0, 500),
    gambar_url: item.gambar_url || item.image_url || null,
    is_global: isGlobal,
    target_lokasi: targetLokasi,
    is_active: item.is_active !== undefined ? item.is_active : true,
    is_pinned: item.is_pinned || false,
    tag: item.tag || null,
    tag_color: item.tag_color || null,
    action_type: item.action_type || null,
    action_id: item.action_id || null,
    expires_at: item.expires_at || null,
    created_by: item.created_by || null,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Cek duplikat (berdasarkan judul dan sumber dalam 24 jam terakhir)
  const { data: existing } = await supabaseAdmin
    .from('kabar_bakul')
    .select('id')
    .eq('judul', kabarData.judul)
    .eq('sumber', kabarData.sumber)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existing) {
    console.log(`⏭️ Duplicate kabar_bakul: ${kabarData.judul.substring(0, 50)}...`);
    return true; // Anggap sukses karena sudah ada
  }

  // Insert ke database
  const { error } = await supabaseAdmin
    .from('kabar_bakul')
    .insert([kabarData]);

  if (error) {
    console.error('❌ Save to kabar_bakul error:', error.message);
    return false;
  }

  // Tampilkan log sukses dengan icon
  const icon = jenisKabar === 'ekonomi' ? '💰' : '📰';
  console.log(`${icon} Kabar Bakul saved: ${kabarData.judul.substring(0, 60)}... (lokasi: ${targetLokasi || 'Global'})`);
  
  return true;
}

/**
 * Fungsi khusus untuk membuat item kabar_bakul dari data harga SISKAPERBAPO
 * @param {Object} commodity - Data komoditas { nama, harga, satuan }
 * @param {string} region - Wilayah (contoh: 'Jawa Timur', 'Kabupaten Pasuruan')
 * @returns {Object} - Item kabar_bakul yang siap disimpan
 */
export function createKabarBakulFromPrice(commodity, region = 'Jawa Timur') {
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const hargaFormatted = commodity.harga.toLocaleString('id-ID');
  
  // Tentukan status harga (naik/turun/stabil) - bisa dikembangkan dengan data historis
  let statusEmoji = '📊';
  if (commodity.trend === 'naik') statusEmoji = '📈';
  if (commodity.trend === 'turun') statusEmoji = '📉';
  
  return {
    jenis_kabar: 'ekonomi',
    sumber: 'SISKAPERBAPO Jatim',
    judul: `Update Harga ${commodity.nama} di ${region} - ${date}`,
    konten: `${statusEmoji} Harga ${commodity.nama} per ${date}: Rp${hargaFormatted} ${commodity.satuan || ''}.`,
    target_lokasi: region === 'Jawa Timur' ? null : region,
    is_global: region === 'Jawa Timur'
  };
}

/**
 * Fungsi untuk membuat item kabar_bakul dari ringkasan harga (summary)
 * @param {string} summary - Ringkasan harga komoditas
 * @param {string} region - Wilayah
 * @returns {Object} - Item kabar_bakul
 */
export function createKabarBakulSummary(summary, region = 'Jawa Timur') {
  const date = new Date().toLocaleDateString('id-ID');
  
  return {
    jenis_kabar: 'ekonomi',
    sumber: 'SISKAPERBAPO Jatim',
    judul: `Ringkasan Harga Bahan Pokok ${region} - ${date}`,
    konten: summary,
    target_lokasi: region === 'Jawa Timur' ? null : region,
    is_global: region === 'Jawa Timur'
  };
}

/**
 * Fungsi untuk membuat item kabar_bakul dari berita WartaBromo ekonomi
 * @param {Object} article - Artikel dari WartaBromo
 * @param {Object|null} matchResult - Hasil matching tempat
 * @returns {Object} - Item kabar_bakul
 */
export function createKabarBakulFromWartaBromo(article, matchResult = null) {
  let targetLokasi = null;
  if (matchResult?.tempat?.name) {
    targetLokasi = matchResult.tempat.name.split(',')[0].trim();
  }
  
  return {
    jenis_kabar: 'ekonomi',
    sumber: 'WartaBromo',
    judul: article.title.substring(0, 150),
    konten: (article.summary || article.title).substring(0, 500),
    gambar_url: article.image_url || null,
    target_lokasi: targetLokasi,
    is_global: !targetLokasi,
    created_at: new Date().toISOString()
  };
}