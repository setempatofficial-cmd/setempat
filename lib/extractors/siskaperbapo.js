// lib/extractors/siskaperbapo.js (FILE BARU)
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function extractSiskaperbapo() {
  try {
    console.log('📊 Fetching SISKAPERBAPO (harga bahan pokok)...');
    
    const response = await axios.get('https://siskaperbapo.jatimprov.go.id', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const commodities = [];
    
    // Ambil data harga komoditas dari tabel
    $('table tbody tr').each((i, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 3) {
        const nama = $(cells[1]).text().trim();
        const satuan = $(cells[2]).text().trim();
        const harga = $(cells[3]).text().trim();
        
        if (nama && harga && harga !== 'HARGA' && !isNaN(parseInt(harga))) {
          commodities.push({
            nama: nama,
            satuan: satuan,
            harga: parseInt(harga),
            timestamp: new Date().toISOString()
          });
        }
      }
    });
    
    // Ambil harga spesifik untuk Kabupaten/Kota Pasuruan
    const pasuruanPrices = extractPasuruanPrices($);
    
    // Buat ringkasan berita ekonomi
    const summary = `📊 Update harga bahan pokok Jawa Timur per ${new Date().toLocaleDateString('id-ID')}: 
- Beras Medium: Rp${formatPrice(getPrice(commodities, 'Beras Medium'))}/kg
- Gula Pasir: Rp${formatPrice(getPrice(commodities, 'Gula Kristal Putih'))}/kg
- Minyak Goreng: Rp${formatPrice(getPrice(commodities, 'Minyak Goreng Curah'))}/kg
- Daging Ayam: Rp${formatPrice(getPrice(commodities, 'Daging Ayam Ras'))}/kg
- Telur Ayam: Rp${formatPrice(getPrice(commodities, 'Telur Ayam Ras'))}/kg
- Cabai Rawit: Rp${formatPrice(getPrice(commodities, 'Cabe Rawit Merah'))}/kg`;
    
    return {
      success: true,
      summary: summary,
      commodities: commodities.slice(0, 20), // 20 komoditas utama
      pasuruan: pasuruanPrices,
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error extracting SISKAPERBAPO:', error.message);
    return { success: false, commodities: [], summary: '' };
  }
}

function getPrice(commodities, name) {
  const item = commodities.find(c => c.nama.includes(name));
  return item ? item.harga : 0;
}

function formatPrice(price) {
  return price.toLocaleString('id-ID');
}

function extractPasuruanPrices($) {
  const prices = {};
  
  // Cari data untuk Kabupaten Pasuruan
  $('a, span, div').each((i, el) => {
    const text = $(el).text();
    if (text.includes('Kab Pasuruan') || text.includes('Kota Pasuruan')) {
      const parent = $(el).closest('tr, div, li');
      const priceText = parent.text();
      const match = priceText.match(/[0-9,.]+/);
      if (match) {
        prices[text.trim()] = match[0];
      }
    }
  });
  
  return prices;
}

// Fungsi untuk membuat kabar_bakul dari data harga
export function createKabarBakulFromPrice(commodity, region = 'Jawa Timur') {
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  
  return {
    jenis_kabar: 'ekonomi',
    sumber: 'SISKAPERBAPO Jatim',
    judul: `Update Harga ${commodity.nama} di ${region}`,
    konten: `Harga ${commodity.nama} per ${date}: Rp${commodity.harga.toLocaleString('id-ID')} ${commodity.satuan}.`,
    gambar_url: null,
    target_lokasi: region === 'Jawa Timur' ? null : region,
    is_global: region === 'Jawa Timur'
  };
}