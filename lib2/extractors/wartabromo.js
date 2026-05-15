import axios from 'axios';
import * as cheerio from 'cheerio';

export async function extractWartaBromo() {
  try {
    const response = await axios.get('https://www.wartabromo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];
    
    $('a').each((i, el) => {
      let title = $(el).text().trim();
      const link = $(el).attr('href');
      
      title = title.replace(/\s+/g, ' ').trim();
      
      if (title && title.length > 35 && title.length < 200 && link) {
        const isNav = /(home|login|facebook|twitter|instagram|youtube|whatsapp)/i.test(title);
        
        if (!isNav && !link.includes('#') && !link.includes('javascript')) {
          const fullLink = link.startsWith('http') ? link : `https://www.wartabromo.com${link}`;
          
          const isIncident = /(jembatan|rampung|akses|dipangkas|desak|sidak|viral|polisi|kecelakaan|banjir|kebakaran)/i.test(title);
          const isEkonomi = /(harga|ekonomi|bisnis|pasar|dagang|produk|sembako|inflasi|uang|mahar)/i.test(title);
          
          articles.push({
            title, url: fullLink, summary: title, image_url: null,
            source: 'WartaBromo', type: isEkonomi && !isIncident ? 'economy' : 'incident'
          });
        }
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Error extracting WartaBromo:', error.message);
    return [];
  }
}