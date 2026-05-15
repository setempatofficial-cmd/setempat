// app/api/signals/debug/route.js
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || 'https://pasuruankab.go.id/berita';
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    const analysis = {
      url: url,
      title: $('title').text(),
      totalLinks: $('a').length,
      longTextLinks: 0,
      sampleLinks: []
    };
    
    $('a').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 40) {
        analysis.longTextLinks++;
        if (analysis.sampleLinks.length < 10) {
          analysis.sampleLinks.push({
            text: text.replace(/\s+/g, ' ').substring(0, 100),
            href: $(el).attr('href')
          });
        }
      }
    });
    
    return Response.json(analysis);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}