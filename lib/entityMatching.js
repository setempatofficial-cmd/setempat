// lib/entityMatching.js
// Fungsi untuk mencocokkan teks dari external sources dengan tempat di database
// Menggunakan tabel entity_aliases untuk mapping alias ke tempat_id

import { supabase } from "@/lib/supabaseClient";

/**
 * Menghitung similarity antara dua string (Levenshtein distance sederhana)
 * @param {string} str1 - String pertama
 * @param {string} str2 - String kedua
 * @returns {number} - Nilai similarity 0-1
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;
  
  // Implementasi sederhana
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

/**
 * Hitung edit distance (Levenshtein distance)
 * @param {string} str1 - String pertama
 * @param {string} str2 - String kedua
 * @returns {number} - Jarak edit
 */
function editDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i-1] === str1[j-1]) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Mencocokkan teks (username, mention, hashtag) dengan entity_aliases
 * @param {string} text - Teks yang akan dicocokkan (username, mention, dll)
 * @param {string} source - Sumber/platform (instagram, tiktok, facebook, dll)
 * @returns {Promise<{tempat_id: number, confidence: number, matched_alias: string} | null>}
 */
export async function matchEntityToAlias(text, source = 'unknown') {
  if (!text || typeof text !== 'string') return null;
  
  // Bersihkan text: lowercase, hapus karakter khusus, trim
  const cleanText = text.toLowerCase()
    .replace(/[@#]/g, '') // Hapus @ dan #
    .replace(/[^a-z0-9]/g, '') // Hanya huruf dan angka
    .trim();
  
  if (cleanText.length < 3) return null; // Minimal 3 karakter
  
  try {
    // Ambil semua alias dari database
    // Untuk production, mungkin perlu pagination atau limit
    const { data: aliases, error } = await supabase
      .from('entity_aliases')
      .select('id, tempat_id, alias, confidence_threshold');
    
    if (error) {
      console.error('Error fetching aliases:', error);
      return null;
    }
    
    if (!aliases || aliases.length === 0) return null;
    
    // Cari yang paling cocok
    let bestMatch = null;
    let highestConfidence = 0;
    
    for (const alias of aliases) {
      const aliasClean = alias.alias.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
      
      // Hitung similarity
      const similarity = calculateSimilarity(cleanText, aliasClean);
      const threshold = alias.confidence_threshold || 0.7;
      
      if (similarity >= threshold && similarity > highestConfidence) {
        highestConfidence = similarity;
        bestMatch = alias;
      }
    }
    
    if (bestMatch) {
      return {
        tempat_id: bestMatch.tempat_id,
        confidence: highestConfidence,
        matched_alias: bestMatch.alias,
        alias_id: bestMatch.id
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error in matchEntityToAlias:', error);
    return null;
  }
}

/**
 * Mencocokkan multiple teks sekaligus (misal dari caption)
 * @param {string[]} texts - Array teks yang akan dicocokkan
 * @param {string} source - Sumber/platform
 * @returns {Promise<Array>} - Array hasil matching
 */
export async function matchMultipleEntities(texts, source = 'unknown') {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  
  const results = [];
  const processed = new Set(); // Hindari duplikat tempat_id
  
  for (const text of texts) {
    const match = await matchEntityToAlias(text, source);
    if (match && !processed.has(match.tempat_id)) {
      processed.add(match.tempat_id);
      results.push(match);
    }
  }
  
  return results;
}

/**
 * Extract potensial entity mentions dari text (caption, komentar)
 * @param {string} text - Teks yang akan diekstrak
 * @returns {string[]} - Array potensial mentions
 */
export function extractPotentialMentions(text) {
  if (!text || typeof text !== 'string') return [];
  
  const mentions = [];
  
  // Extract @username
  const atMentions = text.match(/@[a-zA-Z0-9_.]+/g) || [];
  mentions.push(...atMentions.map(m => m.substring(1))); // Hapus @
  
  // Extract #hashtag
  const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
  mentions.push(...hashtags.map(h => h.substring(1))); // Hapus #
  
  // Extract kata dengan huruf kapital (kemungkinan nama tempat)
  const words = text.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanWord.length > 3 && /^[A-Z]/.test(cleanWord)) {
      mentions.push(cleanWord.toLowerCase());
    }
  }
  
  // Hapus duplikat
  return [...new Set(mentions)];
}

/**
 * Tentukan tier berdasarkan username/alias
 * @param {string} username - Username dari external source
 * @returns {number} - Tier 1-5
 */
export function determineTierFromUsername(username) {
  if (!username) return 5;
  
  const lowerUsername = username.toLowerCase();
  
  // Tier 1: Institusi resmi
  const tier1Keywords = ['dishub', 'bmkg', 'polres', 'polsek', 'pemda', 'kelurahan', 'kecamatan'];
  if (tier1Keywords.some(keyword => lowerUsername.includes(keyword))) {
    return 1;
  }
  
  // Tier 2: Akun resmi tempat (biasanya pakai nama tempat)
  const tier2Indicators = ['official', 'resmi', 'id', 'co.id'];
  if (tier2Indicators.some(ind => lowerUsername.includes(ind))) {
    return 2;
  }
  
  // Tier 3: Media
  const tier3Keywords = ['wartabromo', 'jawapos', 'antara', 'detik', 'kompas', 'tribun'];
  if (tier3Keywords.some(keyword => lowerUsername.includes(keyword))) {
    return 3;
  }
  
  // Tier 4: Personal dengan banyak followers (nanti bisa dicek)
  // Butuh data tambahan
  
  return 5; // Default
}