// lib/connectors/wartabromo.js
// Connector untuk berita lokal WartaBromo

import { supabase } from "@/lib/supabaseClient";
import Parser from 'rss-parser';
import { matchEntityToAlias, extractPotentialMentions } from '@/lib/entityMatching';

// Inisialisasi RSS Parser
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; SetempatBot/1.0)'
  },
  timeout: 10000
});

// Konfigurasi RSS WartaBromo
const WARTABROMO_FEEDS = {
  utama: 'https://www.wartabromo.com/feed',
  pasuruan: 'https://www.wartabromo.com/category/pasuruan/feed',
  probolinggo: 'https://www.wartabromo.com/category/probolinggo/feed',
  lumajang: 'https://www.wartabromo.com/category/lumajang/feed',
  peristiwa: 'https://www.wartabromo.com/category/peristiwa/feed',
  hukum_kriminal: 'https://www.wartabromo.com/category/hukum-kriminal/feed',
};

// Keyword untuk deteksi tipe signal
const TIPE_KEYWORDS = {
  antri: ['antri', 'queue', 'mengantri', 'panjang', 'penuh', 'padat'],
  ramai: ['ramai', 'macet', 'banyak', 'sesak', 'longsor', 'kecelakaan', 'banjir', 'demo', 'kebakaran'],
  sepi: ['sepi', 'kosong', 'sepi pengunjung', 'lengang']
};

// Keyword untuk deteksi urgency
const URGENT_KEYWORDS = [
  'bencana', 'kecelakaan', 'longsor', 'banjir', 'kebakaran',
  'gempa', 'meninggal', 'luka', 'evakuasi', 'darurat'
];

/**
 * Fetch berita dari RSS feed WartaBromo
 */
export async function fetchWartaBromoNews(feedType = 'pasuruan', limit = 10) {
  const feedUrl = WARTABROMO_FEEDS[feedType] || WARTABROMO_FEEDS.pasuruan;
  
  console.log(`📰 Fetching WartaBromo news from: ${feedUrl}`);
  
  try {
    const feed = await parser.parseURL(feedUrl);
    
    if (!feed.items || feed.items.length === 0) {
      console.warn('No items found in feed');
      return [];
    }
    
    const articles = feed.items.slice(0, limit).map(item => ({
      id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: item.title,
      content: item.contentSnippet || item.content || '',
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      author: item.creator || item.author || 'WartaBromo',
      thumbnail: item.enclosure?.url || null,
      source: 'WartaBromo',
      feedType: feedType
    }));
    
    console.log(`✅ Found ${articles.length} articles from WartaBromo`);
    return articles;
    
  } catch (error) {
    console.error('Error fetching WartaBromo RSS:', error);
    return [];
  }
}

/**
 * Mencari tempat yang match dengan teks berita
 * Menggunakan entity_aliases + news_keywords
 */
async function findMatchingTempat(text) {
  const matches = [];
  const processedIds = new Set();
  
  // 1. Ekstrak potensial mentions dari text (pakai entityMatching)
  const potentialMentions = extractPotentialMentions(text);
  console.log(`🔍 Potential mentions: ${potentialMentions.join(', ')}`);
  
  // 2. Coba match dengan entity_aliases untuk setiap mention
  for (const mention of potentialMentions) {
    const aliasMatch = await matchEntityToAlias(mention, 'wartabromo');
    if (aliasMatch && !processedIds.has(aliasMatch.tempat_id)) {
      processedIds.add(aliasMatch.tempat_id);
      matches.push({
        id: aliasMatch.tempat_id,
        name: `(alias: ${aliasMatch.matched_alias})`,
        confidence: aliasMatch.confidence,
        source: 'entity_aliases'
      });
      console.log(`✅ Matched alias "${mention}" to tempat_id: ${aliasMatch.tempat_id}`);
    }
  }
  
  // 3. Lanjut dengan metode lama (news_keywords) untuk yang belum match
  const { data: allTempat, error } = await supabase
    .from('tempat')
    .select('id, name, news_keywords');
  
  if (!error && allTempat) {
    for (const tempat of allTempat) {
      if (processedIds.has(tempat.id)) continue;
      
      const keywords = [tempat.name.toLowerCase()];
      if (tempat.news_keywords) {
        keywords.push(...tempat.news_keywords.toLowerCase().split(',').map(k => k.trim()));
      }
      
      const matched = keywords.some(keyword => 
        keyword && text.toLowerCase().includes(keyword)
      );
      
      if (matched) {
        matches.push({ 
          id: tempat.id, 
          name: tempat.name,
          confidence: 0.85,
          source: 'news_keywords'
        });
        console.log(`✅ Matched keyword for "${tempat.name}"`);
      }
    }
  }
  
  return matches;
}

/**
 * Deteksi tipe signal dari teks
 */
function detectTipe(text) {
  if (TIPE_KEYWORDS.antri.some(kw => text.includes(kw))) return 'Antri';
  if (TIPE_KEYWORDS.ramai.some(kw => text.includes(kw))) return 'Ramai';
  if (TIPE_KEYWORDS.sepi.some(kw => text.includes(kw))) return 'Sepi';
  return 'Update';
}

/**
 * Deteksi urgency dari teks
 */
function detectUrgency(text) {
  return URGENT_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Ekstrak estimasi jumlah orang dari teks
 */
function extractEstimatedPeople(text) {
  const patterns = [
    /(\d+)\s*(orang|person|jiwa|kk)/i,
    /sekitar\s*(\d+)\s*orang/i,
    /puluhan\s*(\d+)/i,
    /ratusan\s*(\d+)/i,
    /(\d+)\s*-\s*(\d+)\s*orang/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2] === 'kk') return parseInt(match[1]) * 4;
      if (match[2] && match[1] && match[2]) {
        return Math.floor((parseInt(match[1]) + parseInt(match[2])) / 2);
      }
      if (text.includes('puluhan')) return parseInt(match[1]) * 10;
      if (text.includes('ratusan')) return parseInt(match[1]) * 100;
      return parseInt(match[1]);
    }
  }
  return null;
}

/**
 * Ekstrak estimasi waktu antri dari teks
 */
function extractEstimatedWaitTime(text) {
  const patterns = [
    /(\d+)\s*(menit|minit|min)/i,
    /antri\s*(\d+)\s*menit/i,
    /(\d+)\s*(jam)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let time = parseInt(match[1]);
      if (match[2]?.includes('jam')) time *= 60;
      return time;
    }
  }
  return null;
}

/**
 * Proses artikel dan simpan ke external_signals
 */
export async function processNewsArticle(article) {
  try {
    const { title, content, link, pubDate, author, source, thumbnail } = article;
    const fullText = (title + ' ' + content).toLowerCase();
    
    // 1. Cari tempat yang match
    const matchedPlaces = await findMatchingTempat(fullText);
    
    if (matchedPlaces.length === 0) {
      console.log(`❌ No matching place for article: ${title.substring(0, 50)}...`);
      return { success: false, classified: false, reason: 'no_match' };
    }
    
    console.log(`📍 Found ${matchedPlaces.length} matching places for: ${title.substring(0, 50)}...`);
    
    // 2. Deteksi tipe signal
    const tipe = detectTipe(fullText);
    const isUrgent = detectUrgency(fullText);
    const estimatedPeople = extractEstimatedPeople(fullText);
    const estimatedWaitTime = extractEstimatedWaitTime(fullText);
    
    // 3. Simpan ke external_signals
    const results = [];
    
    for (const place of matchedPlaces) {
      const signalData = {
        tempat_id: place.id,
        source: 'news',
        source_id: article.id,
        source_platform: source,
        username: author || source,
        content: title,
        original_text: content,
        media_url: thumbnail,
        post_url: link,
        created_at: pubDate ? new Date(pubDate) : new Date(),
        fetched_at: new Date(),
        confidence: place.confidence || 0.9,
        matching_confidence: place.confidence || 0.9,
        matched_entity_id: place.id,
        matched_via: place.source || 'news_keywords',
        has_image: !!thumbnail,
        verified: true,
        verified_by: source,
        verified_at: new Date(),
        tipe: tipe,
        is_urgent: isUrgent,
        estimated_people: estimatedPeople,
        estimated_wait_time: estimatedWaitTime
      };
      
      // Cek duplikat
      const { data: existing } = await supabase
        .from('external_signals')
        .select('id')
        .eq('post_url', link)
        .eq('tempat_id', place.id)
        .maybeSingle();
      
      if (existing) {
        console.log(`⏭️ Signal already exists for ${place.name}, skipping...`);
        results.push({ success: true, tempat_id: place.id, status: 'already_exists' });
        continue;
      }
      
      const { error } = await supabase
        .from('external_signals')
        .insert(signalData);
      
      if (error) {
        console.error(`❌ Error inserting signal for ${place.name}:`, error);
        results.push({ success: false, tempat_id: place.id, error: error.message });
      } else {
        console.log(`✅ Signal saved for ${place.name}: "${title.substring(0, 40)}..." (tipe: ${tipe})`);
        results.push({ success: true, tempat_id: place.id, status: 'inserted' });
      }
    }
    
    return {
      success: results.some(r => r.success),
      places_found: matchedPlaces.length,
      signals_created: results.filter(r => r.status === 'inserted').length,
      results
    };
    
  } catch (error) {
    console.error('Error processing news article:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch dan proses semua berita dari WartaBromo
 */
export async function fetchAndProcessAllWartaBromoNews(feedTypes = ['pasuruan', 'peristiwa', 'hukum_kriminal']) {
  console.log('🚀 Starting WartaBromo news fetch & process...');
  
  let allArticles = [];
  
  for (const feedType of feedTypes) {
    const articles = await fetchWartaBromoNews(feedType, 5);
    allArticles = [...allArticles, ...articles];
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`📰 Total articles fetched: ${allArticles.length}`);
  
  const results = [];
  for (const article of allArticles) {
    const result = await processNewsArticle(article);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const summary = {
    total: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success && !r.reason).length,
    unclassified: results.filter(r => r.reason === 'no_match').length,
    signals_created: results.reduce((sum, r) => sum + (r.signals_created || 0), 0)
  };
  
  console.log('✅ WartaBromo processing complete:', summary);
  return summary;
}

/**
 * Single function untuk dijalankan di cron job
 */
export async function syncWartaBromoNews() {
  console.log('🔄 Syncing WartaBromo news...', new Date().toISOString());
  
  try {
    const result = await fetchAndProcessAllWartaBromoNews([
      'pasuruan',
      'peristiwa', 
      'hukum_kriminal',
    ]);
    
    return { success: true, ...result };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}