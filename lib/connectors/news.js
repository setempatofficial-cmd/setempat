// lib/connectors/news.js
// Wrapper untuk multiple news sources (WartaBromo, radarbromo, dll)

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
 * Sync semua news sources
 */
export async function syncAllNews() {
  const results = {};
  
  for (const [source, config] of Object.entries(NEWS_SOURCES)) {
    if (config.sync) {
      console.log(`🔄 Syncing ${source}...`);
      results[source] = await config.sync();
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
  
  if (error) return [];
  return data;
}

export { syncWartaBromoNews };