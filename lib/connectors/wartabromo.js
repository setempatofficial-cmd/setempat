// lib/connectors/wartabromo.js
// Connector untuk berita lokal WartaBromo (Pasuruan Raya)

import { supabase } from "@/lib/supabaseClient";

// Konfigurasi RSS WartaBromo
const WARTABROMO_FEEDS = {
  utama: 'https://www.wartabromo.com/feed',
  pasuruan: 'https://www.wartabromo.com/category/pasuruan/feed',
  probolinggo: 'https://www.wartabromo.com/category/probolinggo/feed',
  lumajang: 'https://www.wartabromo.com/category/lumajang/feed',
  berita_utama: 'https://www.wartabromo.com/category/peristiwa/feed',
  hukum_kriminal: 'https://www.wartabromo.com/category/hukum-kriminal/feed',
  wisata: 'https://www.wartabromo.com/category/wisata/feed',
  kuliner: 'https://www.wartabromo.com/category/kuliner/feed'
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
 * @param {string} feedType - Jenis feed (utama, pasuruan, probolinggo, dll)
 * @param {number} limit - Maksimal artikel yang diambil
 * @returns {Promise<Array>} Array artikel
 */
export async function fetchWartaBromoNews(feedType = 'pasuruan', limit = 10) {
  const feedUrl = WARTABROMO_FEEDS[feedType] || WARTABROMO_FEEDS.pasuruan;
  
  console.log(`📰 Fetching WartaBromo news from: ${feedUrl}`);
  
  try {
    // Gunakan RSS to JSON converter (rss2json.com gratis, no API key)
    const rssToJsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    
    const response = await fetch(rssToJsonUrl);
    const data = await response.json();
    
    if (data.status !== 'ok') {
      console.error('RSS fetch failed:', data);
      return [];
    }
    
    const articles = data.items.slice(0, limit).map(item => ({
      id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: item.title,
      content: item.description || item.content || '',
      link: item.link,
      pubDate: item.pubDate,
      author: item.author || 'WartaBromo',
      thumbnail: item.thumbnail || item.enclosure?.link || null,
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
 * Proses artikel dan simpan ke external_signals
 * @param {Object} article - Artikel dari fetchWartaBromoNews
 * @returns {Promise<Object>} Hasil processing
 */
export async function processNewsArticle(article) {
  try {
    const { title, content, link, pubDate, author, source, thumbnail } = article;
    const fullText = (title + ' ' + content).toLowerCase();
    
    // 1. Cari tempat yang match berdasarkan name dan news_keywords
    const matchedPlaces = await findMatchingTempat(fullText);
    
    if (matchedPlaces.length === 0) {
      console.log(`No matching place for article: ${title.substring(0, 50)}...`);
      return { success: false, classified: false, reason: 'no_match' };
    }
    
    // 2. Deteksi tipe signal
    const tipe = detectTipe(fullText);
    const isUrgent = detectUrgency(fullText);
    const estimatedPeople = extractEstimatedPeople(fullText);
    const estimatedWaitTime = extractEstimatedWaitTime(fullText);
    
    // 3. Simpan ke external_signals untuk setiap tempat yang match
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
        confidence: 0.9,
        matching_confidence: place.confidence || 0.9,
        matched_entity_id: place.id,
        has_image: !!thumbnail,
        verified: true,
        verified_by: source,
        verified_at: new Date(),
        tipe: tipe,
        is_urgent: isUrgent,
        estimated_people: estimatedPeople,
        estimated_wait_time: estimatedWaitTime
      };
      
      // Cek apakah sudah ada (hindari duplikat)
      const { data: existing } = await supabase
        .from('external_signals')
        .select('id')
        .eq('post_url', link)
        .eq('tempat_id', place.id)
        .maybeSingle();
      
      if (existing) {
        console.log(`Signal already exists for ${place.name}, skipping...`);
        results.push({ success: true, tempat_id: place.id, status: 'already_exists' });
        continue;
      }
      
      const { error } = await supabase
        .from('external_signals')
        .insert(signalData);
      
      if (error) {
        console.error('Error inserting signal:', error);
        results.push({ success: false, tempat_id: place.id, error: error.message });
      } else {
        console.log(`✅ Signal saved for ${place.name}: "${title.substring(0, 40)}..."`);
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
 * Mencari tempat yang match dengan teks berita
 * Berdasarkan name dan news_keywords dari database
 */
async function findMatchingTempat(text) {
  const matches = [];
  
  const { data: allTempat, error } = await supabase
    .from('tempat')
    .select('id, name, news_keywords');
  
  if (error) {
    console.error('Error fetching places:', error);
    return [];
  }
  
  for (const tempat of allTempat) {
    // Buat keyword list dari name dan news_keywords
    const keywords = [tempat.name.toLowerCase()];
    
    if (tempat.news_keywords) {
      const extraKeywords = tempat.news_keywords
        .toLowerCase()
        .split(',')
        .map(k => k.trim());
      keywords.push(...extraKeywords);
    }
    
    // Cek apakah text mengandung salah satu keyword
    const matched = keywords.some(keyword => 
      keyword && text.includes(keyword)
    );
    
    if (matched) {
      matches.push({ 
        id: tempat.id, 
        name: tempat.name,
        confidence: 0.9
      });
    }
  }
  
  return matches;
}

/**
 * Deteksi tipe signal dari teks
 */
function detectTipe(text) {
  // Cek antri dulu (prioritas)
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
 * Fetch dan proses semua berita dari WartaBromo
 * @param {Array} feedTypes - Array feed types yang akan diambil
 * @returns {Promise<Object>} Hasil batch processing
 */
export async function fetchAndProcessAllWartaBromoNews(feedTypes = ['pasuruan', 'utama', 'hukum_kriminal']) {
  console.log('🚀 Starting WartaBromo news fetch & process...');
  
  let allArticles = [];
  
  for (const feedType of feedTypes) {
    const articles = await fetchWartaBromoNews(feedType, 5);
    allArticles = [...allArticles, ...articles];
    // Delay kecil biar gak overload API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`📰 Total articles fetched: ${allArticles.length}`);
  
  const results = [];
  for (const article of allArticles) {
    const result = await processNewsArticle(article);
    results.push(result);
    // Delay kecil
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
 * Mengambil berita terbaru dari WartaBromo dan menyimpan ke database
 */
export async function syncWartaBromoNews() {
  console.log('🔄 Syncing WartaBromo news...', new Date().toISOString());
  
  try {
    const result = await fetchAndProcessAllWartaBromoNews([
      'pasuruan',
      'peristiwa', 
      'hukum_kriminal',
      'wisata'
    ]);
    
    return { success: true, ...result };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}