// hooks/useExternalSignals.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Simple cache dengan TTL 30 detik
const cache = new Map();
const CACHE_TTL = 30000;

export function useExternalSignals(tempatId, options = {}) {
  const { 
    autoFetch = true, 
    limit = 10,
    source = null,
    verifiedOnly = false
  } = options;
  
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const fetchExternalSignals = useCallback(async (ignoreCache = false) => {
    if (!tempatId) return [];
    
    const cacheKey = `${tempatId}_${source}_${verifiedOnly}_${limit}`;
    const cached = cache.get(cacheKey);
    if (!ignoreCache && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      setSignals(cached.data);
      setLastFetch(cached.timestamp);
      return cached.data;
    }
    
    // Batalkan request sebelumnya
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('external_signals')
        .select('*')
        .eq('tempat_id', tempatId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (source) query = query.eq('source', source);
      if (verifiedOnly) query = query.eq('verified', true);
      
      // Gunakan abortSignal
      const { data, error: dbError } = await query.abortSignal(abortController.signal);
      
      if (dbError) throw dbError;
      
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
      
      cache.set(cacheKey, { data: formattedSignals, timestamp: Date.now() });
      setSignals(formattedSignals);
      setLastFetch(new Date());
      return formattedSignals;
      
    } catch (err) {
      // AbortError diabaikan
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
        console.log('Request aborted, ignoring...');
        return [];
      }
      console.error('Error fetching external signals:', err);
      setError(err.message || 'Gagal mengambil data');
      return [];
    } finally {
      setLoading(false);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [tempatId, limit, source, verifiedOnly]);

  // Auto fetch dengan debounce 150ms
  useEffect(() => {
    if (!autoFetch || !tempatId) return;
    
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchExternalSignals();
    }, 150);
    
    return () => clearTimeout(debounceTimerRef.current);
  }, [autoFetch, tempatId, fetchExternalSignals]);

  const refresh = useCallback(() => fetchExternalSignals(true), [fetchExternalSignals]);

  return {
    externalSignals: signals,
    loading,
    error,
    lastFetch,
    refresh,
    count: signals.length
  };
}

// Helper functions
function detectTipeFromContent(content) {
  if (!content) return 'Update';
  const lower = content.toLowerCase();
  if (/(antri|queue|mengantri|panjang|penuh)/.test(lower)) return 'Antri';
  if (/(ramai|padat|macet|banyak|sesak|longsor|kecelakaan|banjir|demo)/.test(lower)) return 'Ramai';
  if (/(sepi|kosong|sepi pengunjung)/.test(lower)) return 'Sepi';
  return 'Update';
}

function getTimeTag(dateString) {
  if (!dateString) return 'Hari Ini';
  const hour = new Date(dateString).getHours();
  if (hour < 10) return 'Pagi';
  if (hour < 15) return 'Siang';
  if (hour < 19) return 'Sore';
  return 'Malam';
}