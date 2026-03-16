// lib/socialSignalProcessor.js
// Fungsi untuk memproses data dari media sosial (Instagram, TikTok, Facebook)
// Dipanggil oleh service scraping atau webhook

import { supabase } from "@/lib/supabaseClient";
import { matchEntityToAlias, determineTierFromUsername } from "./entityMatching";

/**
 * Proses single post dari Instagram
 */
export async function processInstagramPost(postData) {
  try {
    const { username, caption, media_url, timestamp, likes, comments, post_url } = postData;
    
    // 1. Coba cocokkan username dengan entity_aliases
    const match = await matchEntityToAlias(username, 'instagram');
    
    if (!match) {
      // Tidak cocok dengan tempat manapun, simpan sebagai unclassified
      return await saveUnclassifiedSignal({
        source: 'instagram',
        username,
        content: caption,
        media_url,
        post_url,
        created_at: timestamp
      });
    }
    
    // 2. Dapat tempat_id! Ini signal berbobot
    const tier = determineTierFromUsername(username);
    
    // 3. Simpan ke external_signals
    const signalData = {
      tempat_id: match.tempat_id,
      source: 'instagram',
      source_platform: 'instagram',
      source_tier: tier,
      username: username,
      content: caption,
      media_url: media_url,
      post_url: post_url,
      likes_count: likes || 0,
      comments_count: comments || 0,
      confidence: match.confidence,
      matching_confidence: match.confidence,
      matched_entity_id: match.tempat_id,
      has_image: !!media_url,
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
    
    const tier = determineTierFromUsername(username);
    
    const signalData = {
      tempat_id: match.tempat_id,
      source: 'tiktok',
      source_platform: 'tiktok',
      source_tier: tier,
      username: username,
      content: caption,
      media_url: video_url,
      post_url: post_url,
      likes_count: stats?.likeCount || stats?.likes || 0,
      comments_count: stats?.commentCount || stats?.comments || 0,
      shares_count: stats?.shareCount || stats?.shares || 0,
      views_count: stats?.playCount || stats?.views || 0,
      confidence: match.confidence,
      matching_confidence: match.confidence,
      matched_entity_id: match.tempat_id,
      has_video: true,
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
    
    const tier = determineTierFromUsername(username);
    
    const signalData = {
      tempat_id: match.tempat_id,
      source: 'facebook',
      source_platform: 'facebook',
      source_tier: tier,
      username: username,
      content: message,
      media_url: media_url,
      post_url: post_url,
      likes_count: likes?.summary?.total_count || likes || 0,
      comments_count: comments?.summary?.total_count || comments || 0,
      confidence: match.confidence,
      matching_confidence: match.confidence,
      matched_entity_id: match.tempat_id,
      has_image: !!media_url,
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

/**
 * Simpan signal yang tidak terklasifikasi (belum ada tempat_id)
 * Untuk ditinjau manual atau diproses ulang nanti
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
        status: 'pending'
      });
    
    if (error) throw error;
    return { success: false, classified: false };
    
  } catch (error) {
    console.error('Error saving unclassified signal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Batch process multiple posts
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
    
    // Small delay to avoid rate limiting
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
  
  if (error) {
    console.error('Error fetching unclassified signals:', error);
    return [];
  }
  
  return data;
}

/**
 * Manually classify a signal (admin action)
 */
export async function classifySignal(signalId, tempatId, notes = '') {
  try {
    // Get the signal data
    const { data: signal, error: fetchError } = await supabase
      .from('unclassified_signals')
      .select('*')
      .eq('id', signalId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Insert to external_signals
    const { error: insertError } = await supabase
      .from('external_signals')
      .insert({
        tempat_id: tempatId,
        source: signal.source,
        source_platform: signal.source,
        source_tier: determineTierFromUsername(signal.username),
        username: signal.username,
        content: signal.content,
        media_url: signal.media_url,
        post_url: signal.post_url,
        confidence: 0.95, // Manual review = high confidence
        matching_confidence: 0.95,
        matched_entity_id: tempatId,
        has_image: !!signal.media_url,
        created_at: signal.created_at,
        fetched_at: new Date(),
        verified: true,
        verified_by: 'admin',
        verified_at: new Date()
      });
    
    if (insertError) throw insertError;
    
    // Update unclassified signal status
    const { error: updateError } = await supabase
      .from('unclassified_signals')
      .update({
        status: 'reviewed',
        notes: notes,
        reviewed_by: 'admin',
        reviewed_at: new Date()
      })
      .eq('id', signalId);
    
    if (updateError) throw updateError;
    
    return { success: true };
    
  } catch (error) {
    console.error('Error classifying signal:', error);
    return { success: false, error: error.message };
  }
}