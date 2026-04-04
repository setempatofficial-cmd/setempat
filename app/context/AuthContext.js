"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Cache global di luar context
let globalRole = null;
let globalIsAdmin = false;
let globalIsSuperAdmin = false;
let globalUser = null;

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(globalUser);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(globalRole);
  const [isAdmin, setIsAdmin] = useState(globalIsAdmin);
  const [isSuperAdmin, setIsSuperAdmin] = useState(globalIsSuperAdmin);

  const extractName = (user) => {
    if (!user) return "Warga";
    const meta = user.user_metadata || {};
    return meta.full_name || meta.name || meta.preferred_username || user.email?.split("@")[0] || "Warga";
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Jika sudah ada cache global, langsung pakai
        if (globalUser && globalRole) {
          setUser(globalUser);
          setRole(globalRole);
          setIsAdmin(globalIsAdmin);
          setIsSuperAdmin(globalIsSuperAdmin);
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        globalUser = currentUser;

        if (currentUser) {
          const [profileRes, adminRes] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', currentUser.id).maybeSingle(),
            supabase.from('admins').select('id').eq('user_id', currentUser.id).maybeSingle()
          ]);

          const currentRole = profileRes.data?.role?.toLowerCase() || "warga";
          const isAdminTable = !!adminRes.data;
          const superCheck = currentRole === 'superadmin';
          const adminCheck = currentRole === 'admin' || superCheck || isAdminTable;

          // Simpan ke cache global
          globalRole = currentRole;
          globalIsAdmin = adminCheck;
          globalIsSuperAdmin = superCheck;

          setRole(currentRole);
          setIsAdmin(adminCheck);
          setIsSuperAdmin(superCheck);
        } else {
          setRole("warga");
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setRole("warga");
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        globalUser = currentUser;

        if (currentUser) {
          const [profileRes, adminRes] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', currentUser.id).maybeSingle(),
            supabase.from('admins').select('id').eq('user_id', currentUser.id).maybeSingle()
          ]);

          const currentRole = profileRes.data?.role?.toLowerCase() || "warga";
          const isAdminTable = !!adminRes.data;
          const superCheck = currentRole === 'superadmin';
          const adminCheck = currentRole === 'admin' || superCheck || isAdminTable;

          globalRole = currentRole;
          globalIsAdmin = adminCheck;
          globalIsSuperAdmin = superCheck;

          setRole(currentRole);
          setIsAdmin(adminCheck);
          setIsSuperAdmin(superCheck);
        } else {
          globalRole = null;
          globalIsAdmin = false;
          globalIsSuperAdmin = false;
          setRole("warga");
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    globalRole = null;
    globalIsAdmin = false;
    globalIsSuperAdmin = false;
    globalUser = null;
    setUser(null);
    setRole("warga");
    setIsAdmin(false);
    setIsSuperAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, isAdmin, isSuperAdmin, extractName, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);