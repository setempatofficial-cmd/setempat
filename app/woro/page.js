"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
      <div className="flex justify-center items-center h-64">
        <div className="relative flex items-center justify-center">
          <div className="absolute animate-ping h-12 w-12 rounded-full bg-[#E3655B] opacity-20"></div>
          <div className="absolute animate-ping h-12 w-12 rounded-full bg-[#25F4EE] opacity-20 [animation-delay:0.5s]"></div>
          <div className="relative h-10 w-10 border-4 border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return <WoroContent />;
}