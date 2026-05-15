import axios from 'axios';
import * as cheerio from 'cheerio';

export async function extractPemkabSignals() {
  try {
    const response = await axios.get('https://pasuruankab.go.id/berita', {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' 
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const signals = [];
    
    // Menggunakan selektor yang lebih spesifik ke pembungkus berita (biasanya .news-card atau .post-item)
    // Berdasarkan struktur umum web pemerintah tersebut:
    $('.news-card, .post-item, div.col-md-4').each((i, el) => {
      // 1. Ambil Judul dari tag h5 atau h3 di dalam card
      const titleEl = $(el).find('h5, h3, .title').first();
      let title = titleEl.text().trim();
      
      // 2. Ambil Link
      const link = $(el).find('a').attr('href');
      
      // 3. Ambil Ringkasan/Konten (Jika ada di halaman utama)
      let summary = $(el).find('p').text().trim();
      
      if (title && link) {
        const fullLink = link.startsWith('http') ? link : new URL(link, 'https://pasuruankab.go.id').href;
        
        // Membersihkan teks dari sisa-sisa CSS atau kategori
        const cleanTitle = title.replace(/\.news-card\s*{[^}]*}/g, '').replace(/\s+/g, ' ').trim();
        
        signals.push({ 
          title: cleanTitle,
          summary: summary || "Klik tautan untuk membaca lengkap", // Mencegah konten kosong
          url: fullLink, 
          source: 'Pemkab Pasuruan', 
          type: 'signal' 
        });
      }
    });

    // Jika list kosong, kita pakai fallback ke selektor <a> asli Anda tapi lebih bersih
    if (signals.length === 0) {
        $('a[href*="/berita/"]').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 20) { // Hanya ambil jika teks cukup panjang untuk sebuah judul
                signals.push({
                    title: text.replace(/\s+/g, ' '),
                    url: $(el).attr('href'),
                    source: 'Pemkab Pasuruan'
                });
            }
        });
    }
    
    // Menghilangkan duplikat berdasarkan URL
    const uniqueSignals = Array.from(new Map(signals.map(s => [s.url, s])).values());

    console.log(`📰 Pemkab: found ${uniqueSignals.length} unique signals`);
    return uniqueSignals;
  } catch (error) {
    console.error('Error extracting Pemkab:', error.message);
    return [];
  }
}