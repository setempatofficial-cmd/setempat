// lib/extractors/wartabromo.js (PERBAIKAN - ambil semua konten)
import axios from 'axios';
import * as cheerio from 'cheerio';

// Fungsi ambil konten detail dari URL
async function getNewsDetail(url, retryCount = 0) {
  try {
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // Hapus elemen tidak perlu
    $('script, style, iframe, .share, .related, .comment, .sidebar, nav, footer').remove();
    
    // Coba berbagai selector untuk konten
    let content = '';
    const contentSelectors = [
      'article', '.post-content', '.entry-content', '.article-content',
      '.berita-content', '.isi-berita', 'article p', '.post-content p'
    ];
    
    for (const selector of contentSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        if (selector.includes('p')) {
          // Ambil beberapa paragraf
          const paragraphs = [];
          elements.each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50) paragraphs.push(text);
          });
          content = paragraphs.slice(0, 4).join('\n\n');
        } else {
          content = elements.text().trim();
        }
        if (content.length > 100) break;
      }
    }
    
    // Jika tidak ketemu, ambil semua paragraf
    if (!content || content.length < 100) {
      const paragraphs = [];
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) paragraphs.push(text);
      });
      content = paragraphs.slice(0, 4).join('\n\n');
    }
    
    // Bersihkan konten
    content = content
      .replace(/\s+/g, ' ')
      .replace(/[\n\r\t]+/g, '\n\n')
      .trim()
      .substring(0, 800);
    
    // Cari gambar
    let imageUrl = null;
    const imgSelectors = [
      'article img:first', '.post-content img:first', '.entry-content img:first',
      'img.wp-post-image', 'meta[property="og:image"]', 'img.featured-image'
    ];
    
    for (const selector of imgSelectors) {
      if (selector.includes('meta')) {
        const metaImg = $(selector).attr('content');
        if (metaImg && metaImg.startsWith('http')) {
          imageUrl = metaImg;
          break;
        }
      } else {
        const img = $(selector).first();
        if (img.length && img.attr('src')) {
          let src = img.attr('src');
          if (src && !src.startsWith('data:')) {
            if (src.startsWith('//')) src = 'https:' + src;
            if (!src.startsWith('http')) src = new URL(src, url).href;
            imageUrl = src;
            break;
          }
        }
      }
    }
    
    return { content, image_url: imageUrl };
    
  } catch (error) {
    if (retryCount < 2) {
      console.log(`  ⏳ Retry ${retryCount + 1} for ${url.substring(0, 50)}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getNewsDetail(url, retryCount + 1);
    }
    console.error(`  ❌ Failed to fetch: ${url.substring(0, 50)}`);
    return { content: '', image_url: null };
  }
}

export async function extractWartaBromo() {
  try {
    console.log('📰 Fetching WartaBromo...');
    
    const response = await axios.get('https://www.wartabromo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const incidents = [];  // untuk external_signals
    const economies = [];  // untuk kabar_bakul
    
    $('a').each((i, el) => {
      let title = $(el).text().trim();
      const link = $(el).attr('href');
      
      title = title.replace(/\s+/g, ' ').trim();
      
      if (title && title.length > 35 && title.length < 200 && link) {
        const isNav = /(home|login|facebook|twitter|instagram|youtube)/i.test(title);
        
        if (!isNav && !link.includes('#') && link.includes('/202')) {
          const fullLink = link.startsWith('http') ? link : `https://www.wartabromo.com${link}`;
          
          // Deteksi jenis berita
          const isIncident = /(kecelakaan|tabrakan|banjir|kebakaran|polisi|tahan|bentrok|demo|viral|jembatan|rampung|akses|longsor|gempa)/i.test(title);
          const isEkonomi = /(harga|ekonomi|bisnis|pasar|dagang|produk|sembako|inflasi|uang)/i.test(title);
          
          if (isIncident) {
            incidents.push({
              title: title,
              url: fullLink,
              source: 'WartaBromo',
              source_platform: 'News Portal',
              type: 'incident'
            });
          } else if (isEkonomi) {
            economies.push({
              title: title,
              url: fullLink,
              source: 'WartaBromo',
              summary: title,
              type: 'economy'
            });
          }
        }
      }
    });
    
    // Ambil konten detail untuk incidents (max 30)
    console.log(`📊 Found ${incidents.length} incidents, ${economies.length} economy news`);
    console.log(`📥 Fetching details for ${Math.min(incidents.length, 30)} incidents...`);
    
    for (let i = 0; i < Math.min(incidents.length, 30); i++) {
      const detail = await getNewsDetail(incidents[i].url);
      incidents[i].content = detail.content || incidents[i].title;
      incidents[i].image_url = detail.image_url;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { incidents, economies };
    
  } catch (error) {
    console.error('Error extracting WartaBromo:', error.message);
    return { incidents: [], economies: [] };
  }
}