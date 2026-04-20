"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import WoroContent from "@/app/components/layout/woro/WoroContent";

export default function WoroPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      // ✅ Gunakan getSession() bukan getUser()
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Session error:", error.message);
        router.push("/");
        return;
      }
      
      if (!session?.user) {
        router.push("/");
        return;
      }
      
      setIsAuthorized(true);
    } catch (error) {
      console.error("Error checking access:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-white/40 text-sm">Memuat Woro...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return <WoroContent />;
}