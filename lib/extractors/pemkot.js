import axios from 'axios';
import * as cheerio from 'cheerio';
import { summarizeWithAI } from '../summarizer.js'; // Pastikan path benar

export async function extractPemkotSignals() {
  const signals = [];
  const targetUrl = 'https://pasuruankota.go.id/category/aktual/';

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://pasuruankota.go.id/'
      },
      timeout: 20000
    });

    const $ = cheerio.load(response.data);
    
    // Array untuk menampung promise ringkasan AI
    const tasks = [];

    $('article, .post-item, .blog-entry').each((i, el) => {
      const titleEl = $(el).find('h2, h3, .entry-title, .post-title').first();
      const linkEl = $(el).find('a').first();
      // Mengambil deskripsi singkat di bawah judul (biasanya di tag p atau .entry-content)
      const excerptEl = $(el).find('.entry-content p, .post-excerpt, p').first();
      
      let title = titleEl.text().trim();
      let href = linkEl.attr('href');
      let rawContent = excerptEl.text().trim() || title; // Fallback ke judul jika tak ada teks

      if (title && title.length > 15 && href) {
        const fullLink = href.startsWith('http') ? href : `https://pasuruankota.go.id${href}`;
        
        if (!signals.some(s => s.url === fullLink)) {
          // Push data awal
          const signalEntry = {
            title: title.replace(/\s+/g, ' '),
            url: fullLink,
            source: 'Pemkot Pasuruan',
            source_platform: 'Website Resmi',
            timestamp: new Date().toISOString()
          };

          // Jalankan AI Summarizer untuk tiap berita yang ditemukan
          const task = summarizeWithAI(title, rawContent).then(summary => {
            signalEntry.content = summary;
            signals.push(signalEntry);
          });
          
          tasks.push(task);
        }
      }
    });

    // Tunggu semua proses AI selesai
    await Promise.all(tasks);

    if (signals.length > 0) {
      console.log(`✅ Pemkot: Berhasil memproses ${signals.length} berita dari /category/aktual/`);
      return signals;
    }

  } catch (error) {
    console.log('⚠️ Direct scraping failed (PasuruanKota):', error.message);
  }

  return signals;
}