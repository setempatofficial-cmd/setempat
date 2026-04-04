// lib/connectors/news.js
// Wrapper untuk multiple news sources (WartaBromo, radarbromo, dll)

import { supabase } from '@/lib/supabaseClient';
import { fetchWartaBromoNews, processNewsArticle, syncWartaBromoNews } from './wartabromo';
import { 
  fetchRadarBromoNews, 
  processRadarBromoArticle, 
  syncRadarBromoNews 
} from './radarbromo';

// Daftar semua sumber berita yang didukung
const NEWS_SOURCES = {
  wartabromo: {
    name: 'WartaBromo',
    fetch: fetchWartaBromoNews,
    process: processNewsArticle,
    sync: syncWartaBromoNews,
    feeds: ['pasuruan', 'peristiwa', 'hukum_kriminal', 'wisata', 'kuliner']
  },
  radarbromo: { 
    name: 'Radar Bromo',
    fetch: fetchRadarBromoNews,
    process: processRadarBromoArticle,
    sync: syncRadarBromoNews,
    feeds: ['utama'],
    region: 'Probolinggo'
  }
};

/**
 * Fetch news dari source tertentu
 */
export async function fetchNews(source, feedType = null, limit = 10) {
  const newsSource = NEWS_SOURCES[source];
  if (!newsSource) {
    throw new Error(`Unknown news source: ${source}`);
  }
  
  return await newsSource.fetch(feedType, limit);
}

/**
 * Proses dan simpan news article ke external_signals
 */
export async function processNews(source, article) {
  const newsSource = NEWS_SOURCES[source];
  if (!newsSource) {
    throw new Error(`Unknown news source: ${source}`);
  }
  
  return await newsSource.process(article);
}

/**
 * Sync semua news sources (parallel untuk kecepatan)
 */
export async function syncAllNews() {
  const results = {};
  
  // Gunakan Promise.allSettled untuk menjalankan paralel
  const syncPromises = Object.entries(NEWS_SOURCES).map(async ([source, config]) => {
    if (config.sync) {
      console.log(`🔄 Syncing ${source}...`);
      try {
        const result = await config.sync();
        return { source, result, status: 'success' };
      } catch (error) {
        console.error(`❌ Failed to sync ${source}:`, error);
        return { source, error: error.message, status: 'failed' };
      }
    }
    return null;
  });
  
  const syncResults = await Promise.all(syncPromises);
  
  for (const item of syncResults) {
    if (item) {
      results[item.source] = item.status === 'success' ? item.result : { error: item.error };
    }
  }
  
  return results;
}

/**
 * Get unprocessed news (untuk cron job)
 */
export async function getUnprocessedNews(limit = 50) {
  const { data, error } = await supabase
    .from('unclassified_signals')
    .select('*')
    .eq('status', 'pending')
    .eq('type', 'news')
    .limit(limit);
  
  if (error) {
    console.error('Error fetching unprocessed news:', error);
    return [];
  }
  return data;
}

export { syncWartaBromoNews, syncRadarBromoNews };