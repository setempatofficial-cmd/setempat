"use client";

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const supabase = getSupabaseClient();

  // FIX: Fungsi logout yang lebih "galak" untuk cegah Lock Broken
  const logout = async () => {
    try {
      // 1. Sign out dari Supabase secara internal
      await supabase.auth.signOut();
      
      // 2. Bersihkan storage secara manual jika ada yang tersangkut
      if (typeof window !== "undefined") {
        localStorage.clear(); 
        sessionStorage.clear();
        
        // 3. Hard Refresh ke home untuk mereset semua instance Client
        // Ini adalah obat paling ampuh buat AbortError
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback: jika error tetap paksa pindah halaman
      window.location.href = "/";
    }
  };

  useEffect(() => {
    let mounted = true;

    const getInitialUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        if (session?.user) {
          await handleUserData(session.user);
        }
      } catch (error) {
        console.error("Error fetching auth:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Fungsi pembantu agar kode tidak duplikat
    const handleUserData = async (currentUser) => {
      const avatarUrl = currentUser.user_metadata?.avatar_url || 
                       currentUser.user_metadata?.picture || 
                       null;
      
      if (mounted) {
        setUser({ ...currentUser, avatar_url: avatarUrl });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();
      
      if (mounted && profile) {
        setIsAdmin(profile.role === 'admin');
      }
    };

    getInitialUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Jika event SIGNED_OUT, langsung reset state
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (session?.user) {
        await handleUserData(session.user);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); 

  return { user, isAdmin, loading, supabase, logout };
}