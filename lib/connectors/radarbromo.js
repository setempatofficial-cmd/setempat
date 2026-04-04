// lib/connectors/radarbromo.js
// Connector untuk berita lokal Radar Bromo (Jawa Pos Group) - Cakupan: Probolinggo

import { supabase } from "@/lib/supabaseClient";

// Konfigurasi Radar Bromo
// Website ini kemungkinan menggunakan struktur RSS standar WordPress (karena jawapos.com grup)
// Mencoba endpoint RSS yang umum
const RADARBROMO_FEEDS = {
  utama: 'https://radarbromo.jawapos.com/feed',
  // Jika struktur URL-nya berbeda, coba tambahkan kategori di sini nanti
  // Contoh: https://radarbromo.jawapos.com/category/[slug]/feed
};

// Keyword untuk deteksi tipe signal (sama seperti WartaBromo)
const TIPE_KEYWORDS = {
  antri: ['antri', 'queue', 'mengantri', 'panjang', 'penuh', 'padat'],
  ramai: ['ramai', 'macet', 'banyak', 'sesak', 'longsor', 'kecelakaan', 'banjir', 'demo', 'kebakaran'],
  sepi: ['sepi', 'kosong', 'sepi pengunjung', 'lengang']
};

const URGENT_KEYWORDS = [
  'bencana', 'kecelakaan', 'longsor', 'banjir', 'kebakaran',
  'gempa', 'meninggal', 'luka', 'evakuasi', 'darurat'
];

/**
 * Fetch berita dari RSS feed Radar Bromo
 * @param {string} feedType - Jenis feed (utama, dll)
 * @param {number} limit - Maksimal artikel yang diambil
 * @returns {Promise<Array>} Array artikel
 */
export async function fetchRadarBromoNews(feedType = 'utama', limit = 10) {
  const feedUrl = RADARBROMO_FEEDS[feedType] || RADARBROMO_FEEDS.utama;
  
  console.log(`📰 Fetching Radar Bromo news from: ${feedUrl}`);
  
  try {
    const rssToJsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(rssToJsonUrl);
    const data = await response.json();
    
    if (data.status !== 'ok') {
      console.error('Radar Bromo RSS fetch failed:', data);
      return [];
    }
    
    const articles = data.items.slice(0, limit).map(item => ({
      id: `rb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: item.title,
      content: item.description || item.content || '',
      link: item.link,
      pubDate: item.pubDate,
      author: item.author || 'Radar Bromo',
      thumbnail: item.thumbnail || null,
      source: 'Radar Bromo',
      feedType: feedType,
      region: 'Probolinggo' // Tambahkan informasi wilayah
    }));
    
    console.log(`✅ Found ${articles.length} articles from Radar Bromo`);
    return articles;
    
  } catch (error) {
    console.error('Error fetching Radar Bromo RSS:', error);
    return [];
  }
}

/**
 * Proses artikel Radar Bromo dan simpan ke external_signals
 * (Fungsi ini mirip dengan processNewsArticle di wartabromo.js)
 */
export async function processRadarBromoArticle(article) {
  try {
    const { title, content, link, pubDate, author, source, thumbnail, region } = article;
    const fullText = (title + ' ' + content).toLowerCase();
    
    // Cari tempat yang match, khususnya yang berada di wilayah Probolinggo atau sekitarnya
    const matchedPlaces = await findMatchingTempat(fullText, region);
    
    if (matchedPlaces.length === 0) {
      console.log(`No matching place for Radar Bromo article: ${title.substring(0, 50)}...`);
      return { success: false, classified: false, reason: 'no_match' };
    }
    
    const tipe = detectTipe(fullText);
    const isUrgent = detectUrgency(fullText);
    const estimatedPeople = extractEstimatedPeople(fullText);
    const estimatedWaitTime = extractEstimatedWaitTime(fullText);
    
    const results = [];
    
    for (const place of matchedPlaces) {
      // Cek duplikat berdasarkan URL
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
        confidence: 0.85, // Confidence sedikit lebih rendah karena sumber agregator
        matching_confidence: place.confidence || 0.85,
        matched_entity_id: place.id,
        has_image: !!thumbnail,
        verified: true, // Masih bisa dianggap terverifikasi karena dari grup Jawa Pos
        verified_by: source,
        verified_at: new Date(),
        tipe: tipe,
        is_urgent: isUrgent,
        estimated_people: estimatedPeople,
        estimated_wait_time: estimatedWaitTime
      };
      
      const { error } = await supabase
        .from('external_signals')
        .insert(signalData);
      
      if (error) {
        console.error('Error inserting Radar Bromo signal:', error);
        results.push({ success: false, tempat_id: place.id, error: error.message });
      } else {
        console.log(`✅ Radar Bromo signal saved for ${place.name}: "${title.substring(0, 40)}..."`);
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
    console.error('Error processing Radar Bromo article:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mencari tempat yang match dengan teks berita
 * Prioritas pada wilayah yang sesuai (misal: Probolinggo untuk Radar Bromo)
 */
async function findMatchingTempat(text, preferredRegion = null) {
  const matches = [];
  
  let query = supabase
    .from('tempat')
    .select('id, name, news_keywords, kota, kecamatan');
  
  const { data: allTempat, error } = await query;
  
  if (error) {
    console.error('Error fetching places:', error);
    return [];
  }
  
  for (const tempat of allTempat) {
    // Cek apakah tempat berada di wilayah yang diprioritaskan (jika ada)
    let isInPreferredRegion = true;
    if (preferredRegion) {
      const tempatWilayah = `${tempat.kota || ''} ${tempat.kecamatan || ''}`.toLowerCase();
      isInPreferredRegion = tempatWilayah.includes(preferredRegion.toLowerCase());
    }
    
    // Buat keyword list
    const keywords = [tempat.name.toLowerCase()];
    if (tempat.news_keywords) {
      const extraKeywords = tempat.news_keywords.toLowerCase().split(',').map(k => k.trim());
      keywords.push(...extraKeywords);
    }
    
    const matched = keywords.some(keyword => keyword && text.includes(keyword));
    
    if (matched) {
      // Beri bobot lebih jika tempat berada di wilayah yang diprioritaskan
      const confidence = isInPreferredRegion ? 0.9 : 0.7;
      matches.push({ 
        id: tempat.id, 
        name: tempat.name,
        confidence: confidence
      });
    }
  }
  
  // Urutkan berdasarkan confidence tertinggi
  return matches.sort((a, b) => b.confidence - a.confidence);
}

// Helper functions (sama seperti di wartabromo.js)
function detectTipe(text) {
  if (TIPE_KEYWORDS.antri.some(kw => text.includes(kw))) return 'Antri';
  if (TIPE_KEYWORDS.ramai.some(kw => text.includes(kw))) return 'Ramai';
  if (TIPE_KEYWORDS.sepi.some(kw => text.includes(kw))) return 'Sepi';
  return 'Update';
}

function detectUrgency(text) {
  return URGENT_KEYWORDS.some(kw => text.includes(kw));
}

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
 * Fetch dan proses semua berita dari Radar Bromo
 */
export async function fetchAndProcessAllRadarBromoNews(feedTypes = ['utama'], limitPerFeed = 5) {
  console.log('🚀 Starting Radar Bromo news fetch & process...');
  
  let allArticles = [];
  
  for (const feedType of feedTypes) {
    const articles = await fetchRadarBromoNews(feedType, limitPerFeed);
    allArticles = [...allArticles, ...articles];
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`📰 Total Radar Bromo articles fetched: ${allArticles.length}`);
  
  const results = [];
  for (const article of allArticles) {
    const result = await processRadarBromoArticle(article);
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
  
  console.log('✅ Radar Bromo processing complete:', summary);
  return summary;
}

/**
 * Single sync function untuk Radar Bromo
 */
export async function syncRadarBromoNews() {
  console.log('🔄 Syncing Radar Bromo news...', new Date().toISOString());
  
  try {
    const result = await fetchAndProcessAllRadarBromoNews(['utama'], 10);
    return { success: true, ...result };
  } catch (error) {
    console.error('Radar Bromo sync failed:', error);
    return { success: false, error: error.message };
  }
}