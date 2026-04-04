// lib/socialSignalProcessor.js
// Proses signal dari: Instagram, TikTok, Facebook, dan Berita Lokal
// Menggunakan tabel 'tempat' yang sudah ada (kolom: name, alamat, news_keywords, instagram_handle, tiktok_handle, fb_page_url)

import { supabase } from "@/lib/supabaseClient";

// ============================================
// 1. PROSES MEDIA SOSIAL (IG, TikTok, FB)
// ============================================

/**
 * Proses single post dari Instagram
 */
export async function processInstagramPost(postData) {
  try {
    const { username, caption, media_url, timestamp, likes, comments, post_url } = postData;
    
    const match = await matchEntityToAlias(username, 'instagram');
    
    if (!match) {
      return await saveUnclassifiedSignal({
        source: 'instagram',
        username,
        content: caption,
        media_url,
        post_url,
        created_at: timestamp
      });
    }
    
    const signalData = {
      tempat_id: match.tempat_id,
      source: 'instagram',
      source_platform: 'instagram',
      username: username,
      content: caption,
      media_url: media_url,
      post_url: post_url,
      likes_count: likes || 0,
      comments_count: comments || 0,
      confidence: match.confidence,
      created_at: timestamp,
      fetched_at: new Date()
    };
    
    const { error } = await supabase
      .from('external_signals')
      .insert(signalData);
    
    if (error) throw error;
    
    return { success: true, tempat_id: match.tempat_id };
    
  } catch (error) {
    console.error('Error processing Instagram post:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Proses single post dari TikTok
 */
export async function processTikTokPost(postData) {
  try {
    const { username, caption, video_url, stats, create_time, post_url } = postData;
    
    const match = await matchEntityToAlias(username, 'tiktok');
    
    if (!match) {
      return await saveUnclassifiedSignal({
        source: 'tiktok',
        username,
        content: caption,
        media_url: video_url,
        post_url,
        created_at: new Date(create_time * 1000)
      });
    }
    
    const signalData = {
      tempat_id: match.tempat_id,
      source: 'tiktok',
      source_platform: 'tiktok',
      username: username,
      content: caption,
      media_url: video_url,
      post_url: post_url,
      likes_count: stats?.likeCount || stats?.likes || 0,
      comments_count: stats?.commentCount || stats?.comments || 0,
      shares_count: stats?.shareCount || stats?.shares || 0,
      views_count: stats?.playCount || stats?.views || 0,
      confidence: match.confidence,
      created_at: new Date(create_time * 1000),
      fetched_at: new Date()
    };
    
    const { error } = await supabase
      .from('external_signals')
      .insert(signalData);
    
    if (error) throw error;
    
    return { success: true, tempat_id: match.tempat_id };
    
  } catch (error) {
    console.error('Error processing TikTok post:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Proses single post dari Facebook
 */
export async function processFacebookPost(postData) {
  try {
    const { username, message, media_url, created_time, likes, comments, post_url } = postData;
    
    const match = await matchEntityToAlias(username, 'facebook');
    
    if (!match) {
      return await saveUnclassifiedSignal({
        source: 'facebook',
        username,
        content: message,
        media_url,
        post_url,
        created_at: new Date(created_time)
      });
    }
    
    const signalData = {
      tempat_id: match.tempat_id,
      source: 'facebook',
      source_platform: 'facebook',
      username: username,
      content: message,
      media_url: media_url,
      post_url: post_url,
      likes_count: likes?.summary?.total_count || likes || 0,
      comments_count: comments?.summary?.total_count || comments || 0,
      confidence: match.confidence,
      created_at: new Date(created_time),
      fetched_at: new Date()
    };
    
    const { error } = await supabase
      .from('external_signals')
      .insert(signalData);
    
    if (error) throw error;
    
    return { success: true, tempat_id: match.tempat_id };
    
  } catch (error) {
    console.error('Error processing Facebook post:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 2. PROSES BERITA LOKAL
// ============================================

/**
 * Proses artikel berita lokal
 */
export async function processLocalNews(newsData) {
  try {
    const { 
      title, 
      content, 
      source,      // 'WartaBromo', 'Kabarpas', dll
      url, 
      published_at,
      author,
      thumbnail 
    } = newsData;
    
    const fullText = (title + ' ' + content).toLowerCase();
    
    // Cari tempat yang match berdasarkan name dan news_keywords
    const matchedPlaces = await findMatchingPlaces(fullText);
    
    if (matchedPlaces.length === 0) {
      return await saveUnclassifiedSignal({
        source: source || 'local_news',
        username: author || source || 'Redaksi',
        content: title,
        media_url: thumbnail,
        post_url: url,
        created_at: published_at,
        type: 'news'
      });
    }
    
    const results = [];
    const tipe = detectTipeFromText(fullText);
    const isUrgent = detectUrgencyFromText(fullText);
    const estimatedPeople = extractEstimatedPeople(fullText);
    const estimatedWaitTime = extractEstimatedWaitTime(fullText);
    
    for (const place of matchedPlaces) {
      const signalData = {
        tempat_id: place.id,
        source: 'news',
        source_platform: source,
        username: author || source || 'Redaksi',
        content: title,
        media_url: thumbnail,
        post_url: url,
        likes_count: 0,
        comments_count: 0,
        confidence: 0.9,
        created_at: published_at || new Date(),
        fetched_at: new Date(),
        tipe: tipe,
        is_urgent: isUrgent,
        estimated_people: estimatedPeople,
        estimated_wait_time: estimatedWaitTime,
        verified: true,
        verified_by: source
      };
      
      const { error } = await supabase
        .from('external_signals')
        .insert(signalData);
      
      if (!error) {
        results.push({ success: true, tempat_id: place.id, source });
      }
    }
    
    return {
      success: true,
      places_found: matchedPlaces.length,
      signals_created: results.length,
      results
    };
    
  } catch (error) {
    console.error('Error processing local news:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 3. FUNGSI PEMBANTU (HELPERS)
// ============================================

/**
 * Mencari tempat yang match dengan teks berita
 * Berdasarkan name dan news_keywords dari database
 */
async function findMatchingPlaces(text) {
  const matches = [];
  
  const { data: allTempat, error } = await supabase
    .from('tempat')
    .select('id, name, news_keywords');
  
  if (error) {
    console.error('Error fetching places:', error);
    return [];
  }
  
  for (const tempat of allTempat) {
    const keywords = [tempat.name.toLowerCase()];
    
    if (tempat.news_keywords) {
      const extraKeywords = tempat.news_keywords
        .toLowerCase()
        .split(',')
        .map(k => k.trim());
      keywords.push(...extraKeywords);
    }
    
    const matched = keywords.some(keyword => 
      keyword && text.includes(keyword)
    );
    
    if (matched) {
      matches.push({ id: tempat.id, name: tempat.name });
    }
  }
  
  return matches;
}

/**
 * Mencocokkan username media sosial dengan tempat di database
 */
async function matchEntityToAlias(username, platform) {
  if (!username) return null;
  
  const lowerUsername = username.toLowerCase();
  let query = supabase.from('tempat').select('id, name');
  
  switch(platform) {
    case 'instagram':
      query = query.ilike('instagram_handle', `%${lowerUsername}%`);
      break;
    case 'tiktok':
      query = query.ilike('tiktok_handle', `%${lowerUsername}%`);
      break;
    case 'facebook':
      query = query.ilike('fb_page_url', `%${lowerUsername}%`);
      break;
    default:
      return null;
  }
  
  const { data, error } = await query.limit(1);
  
  if (error || !data || data.length === 0) return null;
  
  return {
    tempat_id: data[0].id,
    name: data[0].name,
    confidence: 0.95
  };
}

/**
 * Deteksi tipe (Ramai/Antri/Sepi/Update)
 */
function detectTipeFromText(text) {
  if (/(antri|queue|mengantri|panjang|penuh)/.test(text)) return 'Antri';
  if (/(ramai|padat|macet|banyak|sesak|longsor|kecelakaan|banjir|demo)/.test(text)) return 'Ramai';
  if (/(sepi|kosong|sepi pengunjung)/.test(text)) return 'Sepi';
  return 'Update';
}

/**
 * Deteksi urgency (bencana, kecelakaan)
 */
function detectUrgencyFromText(text) {
  const urgentKeywords = [
    'bencana', 'kecelakaan', 'longsor', 'banjir', 'kebakaran',
    'gempa', 'meninggal', 'luka', 'evakuasi', 'darurat'
  ];
  return urgentKeywords.some(kw => text.includes(kw));
}

/**
 * Ekstrak estimasi jumlah orang dari teks
 */
function extractEstimatedPeople(text) {
  const patterns = [
    /(\d+)\s*(orang|person|jiwa|kk)/i,
    /sekitar\s*(\d+)\s*orang/i,
    /puluhan\s*(\d+)/i,
    /ratusan\s*(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2] === 'kk') return parseInt(match[1]) * 4;
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
 * Simpan signal yang tidak terklasifikasi
 */
async function saveUnclassifiedSignal(data) {
  try {
    const { error } = await supabase
      .from('unclassified_signals')
      .insert({
        source: data.source,
        username: data.username,
        content: data.content,
        media_url: data.media_url,
        post_url: data.post_url,
        created_at: data.created_at || new Date(),
        fetched_at: new Date(),
        status: 'pending',
        type: data.type || 'social'
      });
    
    if (error) throw error;
    return { success: false, classified: false };
    
  } catch (error) {
    console.error('Error saving unclassified signal:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 4. BATCH PROCESSING
// ============================================

/**
 * Batch process multiple social posts
 */
export async function batchProcessSocialPosts(posts, platform) {
  const results = [];
  
  for (const post of posts) {
    let result;
    switch(platform) {
      case 'instagram':
        result = await processInstagramPost(post);
        break;
      case 'tiktok':
        result = await processTikTokPost(post);
        break;
      case 'facebook':
        result = await processFacebookPost(post);
        break;
      default:
        result = { success: false, error: 'Unknown platform' };
    }
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return {
    total: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    unclassified: results.filter(r => r.classified === false).length,
    results
  };
}

/**
 * Batch process multiple news articles
 */
export async function batchProcessLocalNews(articles) {
  const results = [];
  
  for (const article of articles) {
    const result = await processLocalNews(article);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return {
    total: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

/**
 * Get unclassified signals for manual review
 */
export async function getUnclassifiedSignals(limit = 50, source = null) {
  let query = supabase
    .from('unclassified_signals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (source) {
    query = query.eq('source', source);
  }
  
  const { data, error } = await query;
  if (error) return [];
  return data;
}

/**
 * Manually classify a signal (admin action)
 */
export async function classifySignal(signalId, tempatId, notes = '') {
  try {
    const { data: signal, error: fetchError } = await supabase
      .from('unclassified_signals')
      .select('*')
      .eq('id', signalId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const { error: insertError } = await supabase
      .from('external_signals')
      .insert({
        tempat_id: tempatId,
        source: signal.source,
        source_platform: signal.source,
        username: signal.username,
        content: signal.content,
        media_url: signal.media_url,
        post_url: signal.post_url,
        confidence: 0.95,
        created_at: signal.created_at,
        fetched_at: new Date(),
        verified: true,
        verified_by: 'admin',
        verified_at: new Date()
      });
    
    if (insertError) throw insertError;
    
    await supabase
      .from('unclassified_signals')
      .update({
        status: 'reviewed',
        notes: notes,
        reviewed_by: 'admin',
        reviewed_at: new Date()
      })
      .eq('id', signalId);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error classifying signal:', error);
    return { success: false, error: error.message };
  }
}