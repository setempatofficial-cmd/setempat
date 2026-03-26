import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper ambil nama dari berbagai kemungkinan metadata Google/Magic Link
  const extractName = (user) => {
    if (!user) return "Warga";
    const meta = user.user_metadata || {};
    return (
      meta.full_name ||
      meta.name ||           // Google kadang pakai 'name' bukan 'full_name'
      meta.preferred_username ||
      user.email?.split("@")[0] ||
      "Warga"
    );
  };

  const checkAdmin = async (user) => {
    if (!user) { setIsAdmin(false); return; }
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(); // maybeSingle tidak throw error jika tidak ada hasil
      setIsAdmin(!!data && !error);
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) await checkAdmin(session.user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkAdmin(session.user);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    try {
      // Scope 'local' — hanya hapus session di browser ini, tidak semua device
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.error("Logout error:", error);
      // Force clear jika signOut gagal
      setUser(null);
      setIsAdmin(false);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
      await checkAdmin(data.user);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const register = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  return {
    user,
    loading,
    isAdmin,
    logout,
    login,
    register,
    extractName, // Export helper ini agar bisa dipakai Uploader
  };
}
