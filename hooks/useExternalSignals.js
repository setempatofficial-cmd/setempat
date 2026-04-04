// hooks/useExternalSignals.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useExternalSignals(tempatId, options = {}) {
  const { 
    autoFetch = true, 
    limit = 10,
    source = null,        // filter by source: 'instagram', 'tiktok', 'facebook', 'news'
    verifiedOnly = false  // hanya yang terverifikasi
  } = options;
  
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchExternalSignals = useCallback(async () => {
    if (!tempatId) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('external_signals')
        .select('*')
        .eq('tempat_id', tempatId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // Optional filters
      if (source) {
        query = query.eq('source', source);
      }
      
      if (verifiedOnly) {
        query = query.eq('verified', true);
      }
      
      const { data, error: dbError } = await query;
      
      if (dbError) throw dbError;
      
      // Transform ke format yang kompatibel dengan LaporanData (LiveInsight)
      const formattedSignals = (data || []).map(signal => ({
        id: signal.id,
        tempat_id: signal.tempat_id,
        user_id: null,
        user_name: signal.username || signal.source_platform || signal.source,
        user_avatar: null,
        tipe: detectTipeFromContent(signal.content),
        deskripsi: signal.content,
        content: signal.content,
        photo_url: signal.media_url,
        video_url: null,
        media_type: signal.media_url ? 'photo' : 'text',
        time_tag: getTimeTag(signal.created_at),
        created_at: signal.created_at,
        status: 'active',
        estimated_people: null,
        estimated_wait_time: null,
        source: signal.source,
        source_platform: signal.source_platform,
        source_tier: signal.source_tier,
        is_external: true,
        verified: signal.verified || false,
        likes_count: signal.likes_count,
        comments_count: signal.comments_count,
        confidence: signal.confidence
      }));
      
      setSignals(formattedSignals);
      setLastFetch(new Date());
      return formattedSignals;
      
    } catch (err) {
      console.error('Error fetching external signals:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [tempatId, limit, source, verifiedOnly]);

  // Auto fetch on mount or tempatId change
  useEffect(() => {
    if (autoFetch && tempatId) {
      fetchExternalSignals();
    }
  }, [autoFetch, tempatId, fetchExternalSignals]);

  // Manual refresh
  const refresh = useCallback(() => {
    return fetchExternalSignals();
  }, [fetchExternalSignals]);

  return {
    externalSignals: signals,
    loading,
    error,
    lastFetch,
    refresh,
    count: signals.length
  };
}

// Helper: detect tipe dari content
function detectTipeFromContent(content) {
  if (!content) return 'Update';
  
  const lower = content.toLowerCase();
  if (/(antri|queue|mengantri|panjang|penuh)/.test(lower)) return 'Antri';
  if (/(ramai|padat|macet|banyak|sesak|longsor|kecelakaan|banjir|demo)/.test(lower)) return 'Ramai';
  if (/(sepi|kosong|sepi pengunjung)/.test(lower)) return 'Sepi';
  return 'Update';
}

// Helper: get time tag from date
function getTimeTag(dateString) {
  if (!dateString) return 'Hari Ini';
  const hour = new Date(dateString).getHours();
  if (hour < 10) return 'Pagi';
  if (hour < 15) return 'Siang';
  if (hour < 19) return 'Sore';
  return 'Malam';
}