"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, User, ShieldCheck } from "lucide-react";
import KTPCardPublic from "@/app/components/layout/KTPCardPublic";

export default function UsernameProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (error || !data) {
        setError("Warga tidak ditemukan");
        setLoading(false);
        return;
      }

      setProfile(data);
      setUser({
        id: data.id,
        user_metadata: {
          full_name: data.full_name,
          username: data.username,
          avatar_url: data.avatar_url
        }
      });
      setLoading(false);
    };

    if (username) fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
        <div className="text-center">
          <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Warga Tidak Ditemukan</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-5">
      <KTPCardPublic 
        user={user} 
        profile={profile}
        theme={{ isMalam: true }}
      />
    </div>
  );
}