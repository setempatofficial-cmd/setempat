// lib/connectors/instagram.js

import axios from 'axios';
import { supabase } from '../supabase/client.js';

/**
 * Konfigurasi Instagram API
 */
const INSTAGRAM_CONFIG = {
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  baseUrl: 'https://graph.instagram.com/v12.0',
  businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
};

// Tier system untuk berbagai sumber
const SOURCE_TIERS = {
  INSTAGRAM_OFFICIAL: 1,      // Verified business account milik tempat
  INSTAGRAM_INFLUENCER: 2,     // Influencer verified
  INSTAGRAM_HIGH_ENGAGEMENT: 3, // High likes/comments
  INSTAGRAM_NORMAL: 4,         // Post biasa
  INSTAGRAM_LOW_QUALITY: 5,    // Low engagement/confidence
};

/**
 * Fungsi utama mencari mention Instagram
 * @param {Object} tempat - Data tempat { id, name, latitude, longitude, instagram_username }
 * @returns {Array} Array of signal objects sesuai skema external_signals
 */
export async function fetchInstagramMentions(tempat) {
  try {
    console.log(`🔍 Mencari mention Instagram untuk: ${tempat.name}`);
    
    // Cek apakah tempat punya Instagram official
    const officialAccount = await checkOfficialAccount(tempat);
    
    // Kumpulkan signals dari berbagai metode
    let signals = [];
    
    // 1. Search by location tag (jika ada koordinat)
    if (tempat.latitude && tempat.longitude) {
      const locationSignals = await searchByLocation(tempat);
      signals.push(...locationSignals);
    }
    
    // 2. Search by hashtag
    const hashtagSignals = await searchByHashtag(tempat);
    signals.push(...hashtagSignals);
    
    // 3. Cek official account posts (jika ada)
    if (officialAccount) {
      const officialSignals = await fetchOfficialAccountPosts(tempat, officialAccount);
      signals.push(...officialSignals);
    }
    
    // 4. Deduplikasi berdasarkan source_id
    signals = deduplicateSignals(signals);
    
    // 5. Enrich dengan metadata tambahan
    signals = await enrichSignalsMetadata(signals, tempat);
    
    console.log(`✅ Ditemukan ${signals.length} signals untuk ${tempat.name}`);
    
    return signals;
    
  } catch (error) {
    console.error(`❌ Error fetching Instagram for ${tempat.name}:`, error.message);
    
    // Fallback ke mock data untuk development
    if (process.env.NODE_ENV === 'development') {
      console.log('📦 Using MOCK data for development');
      return generateMockSignals(tempat);
    }
    
    return [];
  }
}

/**
 * Cek apakah tempat punya Instagram official account
 */
async function checkOfficialAccount(tempat) {
  try {
    // Cek dari database dulu
    const { data: tempatData } = await supabase
      .from('tempat')
      .select('instagram_username, instagram_verified')
      .eq('id', tempat.id)
      .single();
    
    if (tempatData?.instagram_username) {
      return {
        username: tempatData.instagram_username,
        verified: tempatData.instagram_verified || false
      };
    }
    
    // Search by name similarity (optional)
    // Ini bisa pake Instagram API search users
    
    return null;
  } catch (error) {
    console.error('Error checking official account:', error);
    return null;
  }
}

/**
 * Search Instagram posts by location coordinates
 */
async function searchByLocation(tempat) {
  try {
    // 1. Cari location ID dari Instagram
    const locationId = await findInstagramLocationId(tempat);
    
    if (!locationId) {
      console.log(`📍 No Instagram location found for ${tempat.name}`);
      return [];
    }
    
    // 2. Fetch recent media dari location tersebut
    const response = await axios.get(
      `${INSTAGRAM_CONFIG.baseUrl}/${locationId}/recent_media`,
      {
        params: {
          access_token: INSTAGRAM_CONFIG.accessToken,
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,owner{username,id}',
          limit: 50
        }
      }
    );
    
    // 3. Transform ke format external_signals
    return response.data.data.map(post => transformToSignal(post, tempat, 'location'));
    
  } catch (error) {
    console.error('Error searching by location:', error.message);
    return [];
  }
}

/**
 * Cari Instagram Location ID berdasarkan koordinat
 */
async function findInstagramLocationId(tempat) {
  try {
    const response = await axios.get(
      `${INSTAGRAM_CONFIG.baseUrl}/locations/search`,
      {
        params: {
          access_token: INSTAGRAM_CONFIG.accessToken,
          lat: tempat.latitude,
          lng: tempat.longitude,
          distance: 500 // 500 meter radius
        }
      }
    );
    
    // Cari lokasi dengan nama paling mirip
    const locations = response.data.data || [];
    const bestMatch = locations.find(loc => 
      loc.name.toLowerCase().includes(tempat.name.toLowerCase()) ||
      tempat.name.toLowerCase().includes(loc.name.toLowerCase())
    );
    
    return bestMatch?.id || locations[0]?.id || null;
    
  } catch (error) {
    console.error('Error finding location ID:', error);
    return null;
  }
}

/**
 * Search Instagram by hashtags
 */
async function searchByHashtag(tempat) {
  try {
    const hashtags = generateHashtags(tempat);
    let allSignals = [];
    
    for (const hashtag of hashtags.slice(0, 3)) { // Batasi 3 hashtag utama
      const hashtagId = await getHashtagId(hashtag);
      
      if (!hashtagId) continue;
      
      const response = await axios.get(
        `${INSTAGRAM_CONFIG.baseUrl}/${hashtagId}/recent_media`,
        {
          params: {
            user_id: INSTAGRAM_CONFIG.businessAccountId,
            access_token: INSTAGRAM_CONFIG.accessToken,
            fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,owner{username,id}',
            limit: 25
          }
        }
      );
      
      const signals = response.data.data.map(post => 
        transformToSignal(post, tempat, 'hashtag', hashtag)
      );
      
      allSignals.push(...signals);
      
      // Delay antar request
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return allSignals;
    
  } catch (error) {
    console.error('Error searching by hashtag:', error.message);
    return [];
  }
}

/**
 * Generate hashtags untuk tempat
 */
function generateHashtags(tempat) {
  const hashtags = [];
  
  // Nama tempat tanpa spasi
  const cleanName = tempat.name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '');
  hashtags.push(cleanName);
  
  // Nama + Kota (jika ada)
  if (tempat.city) {
    hashtags.push(`${cleanName}${tempat.city.replace(/\s+/g, '')}`);
  }
  
  // Variasi populer
  hashtags.push(`Kuliner${cleanName}`);
  hashtags.push(`TempatNongkrong${cleanName}`);
  hashtags.push(`Review${cleanName}`);
  
  return hashtags;
}

/**
 * Get Hashtag ID dari Instagram API
 */
async function getHashtagId(hashtagName) {
  try {
    const response = await axios.get(
      `${INSTAGRAM_CONFIG.baseUrl}/ig_hashtag_search`,
      {
        params: {
          user_id: INSTAGRAM_CONFIG.businessAccountId,
          q: hashtagName.toLowerCase(),
          access_token: INSTAGRAM_CONFIG.accessToken
        }
      }
    );
    
    return response.data.data[0]?.id || null;
  } catch (error) {
    console.error(`Error getting hashtag ID for #${hashtagName}:`, error.message);
    return null;
  }
}

/**
 * Fetch posts dari official Instagram account
 */
async function fetchOfficialAccountPosts(tempat, officialAccount) {
  try {
    // Cari user ID dulu
    const userResponse = await axios.get(
      `${INSTAGRAM_CONFIG.baseUrl}/users/search`,
      {
        params: {
          q: officialAccount.username,
          access_token: INSTAGRAM_CONFIG.accessToken
        }
      }
    );
    
    const userId = userResponse.data.data[0]?.id;
    if (!userId) return [];
    
    // Fetch recent media
    const mediaResponse = await axios.get(
      `${INSTAGRAM_CONFIG.baseUrl}/${userId}/media`,
      {
        params: {
          access_token: INSTAGRAM_CONFIG.accessToken,
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          limit: 20
        }
      }
    );
    
    return mediaResponse.data.data.map(post => {
      const signal = transformToSignal(post, tempat, 'official');
      signal.is_official_place_account = true;
      signal.verified_account = officialAccount.verified;
      signal.source_tier = SOURCE_TIERS.INSTAGRAM_OFFICIAL;
      signal.verification_level = 'high';
      return signal;
    });
    
  } catch (error) {
    console.error('Error fetching official posts:', error.message);
    return [];
  }
}

/**
 * Transform Instagram post ke format external_signals
 */
function transformToSignal(post, tempat, searchMethod = 'unknown', hashtagUsed = null) {
  // Extract media URLs
  const mediaUrls = [];
  if (post.media_url) {
    mediaUrls.push(post.media_url);
  }
  if (post.children?.data) {
    post.children.data.forEach(child => {
      if (child.media_url) mediaUrls.push(child.media_url);
    });
  }
  
  // Calculate confidence
  const confidence = calculateMatchingConfidence(post.caption, tempat);
  
  // Determine source tier
  const sourceTier = determineSourceTier(post, searchMethod);
  
  // Check verification level
  const verificationLevel = determineVerificationLevel(post, confidence);
  
  return {
    tempat_id: tempat.id,
    source: 'instagram',
    source_platform: 'instagram',
    source_id: post.id,
    username: post.owner?.username || post.username || 'unknown',
    content: post.caption || '',
    media_url: post.media_url || null,
    media_urls: JSON.stringify(mediaUrls),
    post_url: post.permalink,
    likes_count: post.like_count || 0,
    comments_count: post.comments_count || 0,
    confidence: confidence.matching_confidence,
    matching_confidence: confidence.matching_confidence,
    matched_entity_id: tempat.id,
    original_text: post.caption || '',
    source_tier: sourceTier,
    is_official_place_account: false,
    verified_account: false,
    verification_level: verificationLevel,
    has_image: post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL_ALBUM',
    has_video: post.media_type === 'VIDEO',
    verified: false, // Perlu manual verification
    created_at: post.timestamp ? new Date(post.timestamp) : new Date(),
    fetched_at: new Date()
  };
}

/**
 * Calculate matching confidence dengan NLP sederhana
 */
function calculateMatchingConfidence(content, tempat) {
  if (!content) return 0.3;
  
  const lowerContent = content.toLowerCase();
  const placeNameLower = tempat.name.toLowerCase();
  
  let score = 0.5; // Base score
  
  // Exact match nama tempat
  if (lowerContent.includes(placeNameLower)) {
    score += 0.3;
  }
  
  // Partial match kata-kata penting
  const placeWords = placeNameLower.split(' ').filter(w => w.length > 3);
  const matchCount = placeWords.filter(word => lowerContent.includes(word)).length;
  score += (matchCount / placeWords.length) * 0.2;
  
  // Cek keyword relevan
  const relevantKeywords = ['makan', 'enak', 'tempat', 'nongkrong', 'kuliner', 'review'];
  const keywordMatches = relevantKeywords.filter(kw => lowerContent.includes(kw)).length;
  score += (keywordMatches / relevantKeywords.length) * 0.1;
  
  return Math.min(score, 1.0);
}

/**
 * Determine source tier berdasarkan engagement
 */
function determineSourceTier(post, searchMethod) {
  const engagement = (post.like_count || 0) + (post.comments_count || 0) * 2;
  
  if (searchMethod === 'official') {
    return SOURCE_TIERS.INSTAGRAM_OFFICIAL;
  }
  
  if (engagement > 1000) {
    return SOURCE_TIERS.INSTAGRAM_HIGH_ENGAGEMENT;
  }
  
  if (engagement > 100) {
    return SOURCE_TIERS.INSTAGRAM_NORMAL;
  }
  
  return SOURCE_TIERS.INSTAGRAM_LOW_QUALITY;
}

/**
 * Determine verification level
 */
function determineVerificationLevel(post, confidence) {
  if (confidence.matching_confidence > 0.9) {
    return 'high';
  }
  if (confidence.matching_confidence > 0.7) {
    return 'medium';
  }
  return 'low';
}

/**
 * Enrich signals dengan metadata tambahan
 */
async function enrichSignalsMetadata(signals, tempat) {
  // Bisa ditambahkan:
  // - Sentiment analysis
  // - Topic classification
  // - Entity extraction
  return signals;
}

/**
 * Deduplikasi signals
 */
function deduplicateSignals(signals) {
  const seen = new Map();
  
  return signals.filter(signal => {
    if (seen.has(signal.source_id)) {
      return false;
    }
    seen.set(signal.source_id, true);
    return true;
  });
}

/**
 * Save signals ke database
 */
export async function saveInstagramSignals(signals) {
  if (!signals.length) return [];
  
  try {
    const { data, error } = await supabase
      .from('external_signals')
      .upsert(signals, { 
        onConflict: 'source_id',
        ignoreDuplicates: false 
      })
      .select();
      
    if (error) throw error;
    
    console.log(`✅ Saved ${data.length} Instagram signals to database`);
    return data;
  } catch (error) {
    console.error('Error saving signals:', error.message);
    return [];
  }
}

/**
 * Fetch all Instagram mentions untuk semua tempat
 */
export async function fetchAllInstagramMentions(tempatList) {
  console.log(`🔍 Mencari mention Instagram untuk ${tempatList.length} tempat...`);
  
  let allSignals = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (const tempat of tempatList) {
    try {
      const signals = await fetchInstagramMentions(tempat);
      allSignals.push(...signals);
      successCount++;
      
      // Save to database immediately
      if (signals.length > 0) {
        await saveInstagramSignals(signals);
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error processing ${tempat.name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`
    📊 Instagram Fetch Summary:
    - Total tempat diproses: ${tempatList.length}
    - Berhasil: ${successCount}
    - Gagal: ${errorCount}
    - Total signals ditemukan: ${allSignals.length}
  `);
  
  return allSignals;
}

// ============ MOCK DATA GENERATOR (Development) ============

function generateMockSignals(tempat) {
  const signals = [];
  const postCount = Math.floor(Math.random() * 5) + 1;
  
  for (let i = 0; i < postCount; i++) {
    const likes = Math.floor(Math.random() * 200) + 10;
    const comments = Math.floor(Math.random() * 50) + 2;
    const confidence = 0.7 + (Math.random() * 0.3);
    
    signals.push({
      tempat_id: tempat.id,
      source: 'instagram',
      source_platform: 'instagram',
      source_id: `ig_mock_${tempat.id}_${Date.now()}_${i}`,
      username: ['foodie_jatim', 'kuliner_sby', 'explore_malang', 'wisata_jatim'][i % 4],
      content: `Enak banget di ${tempat.name}! Recommended banget buat yang suka kuliner. #${tempat.name.replace(/\s+/g, '')} #KulinerJatim`,
      media_url: `https://picsum.photos/seed/${tempat.id}${i}/500/500`,
      media_urls: JSON.stringify([`https://picsum.photos/seed/${tempat.id}${i}/500/500`]),
      post_url: `https://instagram.com/p/mock_${tempat.id}_${i}`,
      likes_count: likes,
      comments_count: comments,
      confidence: confidence,
      matching_confidence: confidence,
      matched_entity_id: tempat.id,
      original_text: `Review ${tempat.name}`,
      source_tier: likes > 100 ? SOURCE_TIERS.INSTAGRAM_HIGH_ENGAGEMENT : SOURCE_TIERS.INSTAGRAM_NORMAL,
      is_official_place_account: false,
      verified_account: false,
      verification_level: confidence > 0.85 ? 'high' : 'medium',
      has_image: true,
      has_video: Math.random() > 0.7,
      verified: false,
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      fetched_at: new Date()
    });
  }
  
  return signals;
}

// Export tambahan untuk search by hashtag (public API)
export async function fetchInstagramByHashtag(hashtag) {
  console.log(`🔍 Mencari Instagram dengan hashtag: #${hashtag}`);
  
  // Untuk sekarang return mock, nanti bisa implement API real
  return generateMockSignals({ id: 0, name: hashtag });
}