// contexts/AuthContext.jsx - SIMPLE VERSION
"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('warga');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        
        setUser(currentUser);
        
        if (currentUser) {
          // Hanya 1 query ke profiles
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role, full_name, avatar_url')
            .eq('id', currentUser.id)
            .maybeSingle();
          
          const currentRole = profileData?.role?.toLowerCase() || "warga";
          const isSuper = currentRole === 'superadmin';
          const isAdm = currentRole === 'admin' || isSuper;
          
          setRole(currentRole);
          setIsAdmin(isAdm);
          setIsSuperAdmin(isSuper);
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
    
    // Listener untuk auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role, full_name, avatar_url')
            .eq('id', currentUser.id)
            .maybeSingle();
          
          const currentRole = profileData?.role?.toLowerCase() || "warga";
          const isSuper = currentRole === 'superadmin';
          const isAdm = currentRole === 'admin' || isSuper;
          
          setRole(currentRole);
          setIsAdmin(isAdm);
          setIsSuperAdmin(isSuper);
          setProfile(profileData);
        } else if (event === 'SIGNED_OUT') {
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