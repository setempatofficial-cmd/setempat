// lib/extractors/pemkab.js
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function extractPemkabSignals() {
  try {
    const response = await axios.get('https://pasuruankab.go.id/berita', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const signals = [];
    
    // Cari semua link yang mengandung '/berita/'
    $('a[href*="/berita/"]').each((i, el) => {
      let rawText = $(el).text().trim();
      const link = $(el).attr('href');
      
      // BERSIHKAN TEKS: hapus newline, tab, multiple spaces, dan CSS
      let cleanText = rawText
        .replace(/[\n\r\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\.news-card\s*{[^}]*}/g, '')
        .replace(/transition[^;]+;/g, '')
        .replace(/transform[^;]+;/g, '')
        .replace(/box-shadow[^;]+;/g, '')
        .trim();
      
      // Hapus teks kategori yang berdiri sendiri
      const categoryWords = ['Ekonomi', 'Kesehatan', 'Pemerintahan', 'Pelayanan Publik', 'Olahraga', 'Umum', 'Pendidikan', 'Budaya'];
      for (const cat of categoryWords) {
        cleanText = cleanText.replace(new RegExp(`^${cat}\\s+`, 'i'), '');
      }
      
      // Filter: judul harus minimal 30 karakter
      if (cleanText && cleanText.length > 30 && cleanText.length < 200 && link) {
        const fullLink = link.startsWith('http') ? link : new URL(link, 'https://pasuruankab.go.id').href;
        
        signals.push({
          title: cleanText,
          url: fullLink,
          source: 'Pemkab Pasuruan',
          type: 'signal'
        });
      }
    });
    
    // Jika tidak ketemu, coba ambil semua link dengan teks panjang
    if (signals.length === 0) {
      $('a').each((i, el) => {
        let text = $(el).text().trim();
        const link = $(el).attr('href');
        
        text = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (text && text.length > 40 && text.length < 200 && link && 
            !link.includes('#') && !link.includes('javascript')) {
          const fullLink = link.startsWith('http') ? link : new URL(link, 'https://pasuruankab.go.id').href;
          signals.push({
            title: text,
            url: fullLink,
            source: 'Pemkab Pasuruan',
            type: 'signal'
          });
        }
      });
    }
    
    console.log(`📰 Pemkab: found ${signals.length} signals`);
    if (signals.length > 0) {
      console.log(`  Sample: ${signals[0].title.substring(0, 80)}...`);
    }
    
    return signals;
  } catch (error) {
    console.error('Error extracting Pemkab:', error.message);
    return [];
  }
}