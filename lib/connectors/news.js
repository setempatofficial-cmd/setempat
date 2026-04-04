// lib/connectors/news.js
import { supabase } from '@/lib/supabaseClient';
import { fetchWartaBromoNews, processNewsArticle, syncWartaBromoNews } from './wartabromo';

const NEWS_SOURCES = {
  wartabromo: {
    name: 'WartaBromo',
    fetch: fetchWartaBromoNews,
    process: processNewsArticle,
    sync: syncWartaBromoNews,
    feeds: ['pasuruan', 'peristiwa', 'hukum_kriminal', 'wisata', 'kuliner']
  }
};

export async function fetchNews(source, feedType = null, limit = 10) {
  const newsSource = NEWS_SOURCES[source];
  if (!newsSource) {
    throw new Error(`Unknown news source: ${source}`);
  }
  return await newsSource.fetch(feedType, limit);
}

export async function processNews(source, article) {
  const newsSource = NEWS_SOURCES[source];
  if (!newsSource) {
    throw new Error(`Unknown news source: ${source}`);
  }
  return await newsSource.process(article);
}

export async function syncAllNews() {
  const results = {};
  
  for (const [source, config] of Object.entries(NEWS_SOURCES)) {
    if (config.sync) {
      console.log(`🔄 Syncing ${source}...`);
      try {
        const result = await config.sync();
        results[source] = result;
      } catch (error) {
        console.error(`❌ Failed to sync ${source}:`, error);
        results[source] = { error: error.message };
      }
    }
  }
  return results;
}

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

export { syncWartaBromoNews };