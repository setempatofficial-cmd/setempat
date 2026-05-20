// AuthContext.jsx - OPTIMIZED VERSION
"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('warga');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profile, setProfile] = useState(null);

  // Fungsi untuk load profile dengan caching
  const loadProfileWithCache = async (userId) => {
    const cacheKey = `profile_${userId}`;
    const cached = localStorage.getItem(cacheKey);

    // Cek cache valid
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data; // Return cached profile
        }
      } catch (e) { }
    }

    // Fetch fresh profile
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    }

    return data;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // ✅ Cek sessionStorage dulu
        const cachedSession = sessionStorage.getItem('auth_session');
        if (cachedSession) {
          try {
            const { user: cachedUser, timestamp } = JSON.parse(cachedSession);
            if (Date.now() - timestamp < CACHE_DURATION && cachedUser) {
              setUser(cachedUser);
              setLoading(false); // ✅ Set loading false EARLY!

              // Load profile di background (tidak block UI)
              loadProfileWithCache(cachedUser.id).then(profileData => {
                if (profileData) {
                  const currentRole = profileData.role?.toLowerCase() || "warga";
                  const isSuper = currentRole === 'superadmin';
                  const isAdm = currentRole === 'admin' || isSuper;
                  setRole(currentRole);
                  setIsAdmin(isAdm);
                  setIsSuperAdmin(isSuper);
                  setProfile(profileData);
                }
              });
              return;
            }
          } catch (e) { }
        }

        // No cache, fetch normally
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoading(false); // ✅ Set loading false setelah session

        if (currentUser) {
          // Cache session
          sessionStorage.setItem('auth_session', JSON.stringify({
            user: currentUser,
            timestamp: Date.now()
          }));

          // Load profile (bisa async, tidak block)
          const profileData = await loadProfileWithCache(currentUser.id);
          if (profileData) {
            const currentRole = profileData.role?.toLowerCase() || "warga";
            const isSuper = currentRole === 'superadmin';
            const isAdm = currentRole === 'admin' || isSuper;
            setRole(currentRole);
            setIsAdmin(isAdm);
            setIsSuperAdmin(isSuper);
            setProfile(profileData);
          }
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setLoading(false);
      }
    };

    initAuth();

    // Listener untuk auth changes (tetap sama)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          // Invalidate cache on sign in
          localStorage.removeItem(`profile_${currentUser.id}`);
          sessionStorage.removeItem('auth_session');

          const profileData = await loadProfileWithCache(currentUser.id);
          if (profileData) {
            const currentRole = profileData.role?.toLowerCase() || "warga";
            const isSuper = currentRole === 'superadmin';
            const isAdm = currentRole === 'admin' || isSuper;
            setRole(currentRole);
            setIsAdmin(isAdm);
            setIsSuperAdmin(isSuper);
            setProfile(profileData);
          }
        } else if (event === 'SIGNED_OUT') {
          // Clear all caches on logout
          localStorage.removeItem(`profile_${user?.id}`);
          sessionStorage.removeItem('auth_session');
          setRole('warga');
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    // Clear caches
    if (user) localStorage.removeItem(`profile_${user.id}`);
    sessionStorage.removeItem('auth_session');
    setUser(null);
    setRole('warga');
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, role, isAdmin, isSuperAdmin, profile, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);