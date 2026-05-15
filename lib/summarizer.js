import axios from 'axios';

/**
 * Ringkas berita menggunakan AI Groq (Optimized for Setempat.id)
 * DENGAN CACHE & BATCHING UNTUK HEMAT KUOTA
 */

// ============================================
// 1. CACHE UNTUK HASIL RINGKASAN (HINDARI DUPLIKAT)
// ============================================
const summaryCache = new Map();
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 hari

function getCachedSummary(title, content) {
  const key = `${title.substring(0, 100)}_${content.substring(0, 200)}`;
  const cached = summaryCache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.summary;
  }
  return null;
}

function setCachedSummary(title, content, summary) {
  const key = `${title.substring(0, 100)}_${content.substring(0, 200)}`;
  summaryCache.set(key, { summary, timestamp: Date.now() });
}

// ============================================
// 2. BATCH REQUEST (GABUNG BEBERAPA BERITA DALAM 1 REQUEST)
// ============================================
export async function batchSummarizeWithAI(items) {
  // Hanya untuk yang belum di-cache
  const uncachedItems = items.filter(item => !getCachedSummary(item.title, item.content));
  
  if (uncachedItems.length === 0) return items.map(item => getCachedSummary(item.title, item.content));
  
  if (!process.env.GROQ_API_KEY) {
    return uncachedItems.map(item => simpleSummarize(item.title, item.content));
  }
  
  try {
    // Buat prompt untuk beberapa berita sekaligus
    const batchPrompt = uncachedItems.map((item, idx) => {
      return `[BERITA ${idx + 1}]\nJudul: ${item.title}\nIsi: ${(item.content || '').substring(0, 800)}\n`;
    }).join('\n---\n');
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `Kamu adalah asisten redaksi. Ringkas setiap berita menjadi 1 kalimat pendek (max 150 karakter). 
            Format output: [BERITA 1] ringkasan1 [BERITA 2] ringkasan2 ...`
          },
          {
            role: 'user',
            content: batchPrompt
          }
        ],
        max_tokens: 500, // 5 berita × 100 token
        temperature: 0.5
      },
      {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 15000
      }
    );
    
    const result = response.data.choices[0]?.message?.content?.trim();
    
    // Parsing hasil batch
    const summaries = [];
    const regex = /\[BERITA \d+\]\s*([^\[]+)/g;
    let match;
    while ((match = regex.exec(result)) !== null) {
      summaries.push(match[1].trim());
    }
    
    // Simpan ke cache
    uncachedItems.forEach((item, idx) => {
      const summary = summaries[idx] || simpleSummarize(item.title, item.content);
      setCachedSummary(item.title, item.content, summary);
    });
    
    return uncachedItems.map((item, idx) => summaries[idx] || simpleSummarize(item.title, item.content));
    
  } catch (error) {
    console.error('Batch summarize error:', error.message);
    return uncachedItems.map(item => simpleSummarize(item.title, item.content));
  }
}

// ============================================
// 3. SINGLE SUMMARIZE (DENGAN CACHE)
// ============================================
export async function summarizeWithAI(title, content) {
  // CEK CACHE DULU
  const cached = getCachedSummary(title, content);
  if (cached) {
    console.log(`📦 Cache hit for: ${title.substring(0, 40)}...`);
    return cached;
  }
  
  // Skip jika konten terlalu pendek
  if (!content || content.length < 100) {
    const summary = title.length > 250 ? title.substring(0, 247) + '...' : title;
    setCachedSummary(title, content, summary);
    return summary;
  }
  
  if (!process.env.GROQ_API_KEY) {
    const summary = simpleSummarize(title, content);
    setCachedSummary(title, content, summary);
    return summary;
  }
  
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `Kamu asisten redaksi "Setempat.id". Ringkas berita jadi 1 kalimat (max 150 karakter). 
            Format: [Apa/Kejadian] di [Tempat]. Hindari kata "dalam rangka" atau "telah".`
          },
          {
            role: 'user',
            content: `Judul: ${title}\n\nIsi: ${(content || '').substring(0, 1000)}`
          }
        ],
        max_tokens: 80, // LEBIH KECIL (sebelumnya 150)
        temperature: 0.3 // LEBIH RENDAH (hasil lebih konsisten)
      },
      {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 5000
      }
    );
    
    let summary = response.data.choices[0]?.message?.content?.trim();
    summary = summary.replace(/^["']|["']$/g, '');
    
    if (summary && summary.length > 200) {
      summary = summary.substring(0, 197) + '...';
    }
    
    const finalSummary = summary || simpleSummarize(title, content);
    
    // SIMPAN KE CACHE
    setCachedSummary(title, content, finalSummary);
    
    return finalSummary;
    
  } catch (error) {
    console.error('AI Summarize error:', error.message);
    const summary = simpleSummarize(title, content);
    setCachedSummary(title, content, summary);
    return summary;
  }
}

export function simpleSummarize(title, content) {
  const sentences = (content || title).split(/[.!?]+/);
  let summary = sentences.slice(0, 2).join('. ') + '.';
  summary = summary.replace(/\s+/g, ' ').trim();
  
  if (summary.length > 200) {
    summary = summary.substring(0, 197) + '...';
  }
  
  if (summary.length < 30) {
    return title.length > 200 ? title.substring(0, 197) + '...' : title;
  }
  
  return summary;
}

// ============================================
// 4. UPDATE DI ROUTE.JS (PAKAI BATCH)
// ============================================
// Di dalam route.js, kumpulkan dulu semua yang perlu diringkas:
/*
const itemsToSummarize = [];
for (const signal of pemkabSignals) {
  if (signal.content && signal.content.length > 100) {
    itemsToSummarize.push({ title: signal.title, content: signal.content });
  }
}

// Batch summarize (1 API call untuk banyak berita)
const summaries = await batchSummarizeWithAI(itemsToSummarize);

// Terapkan hasilnya
for (let i = 0; i < summaries.length; i++) {
  pemkabSignals[i].summary = summaries[i];
}
*/