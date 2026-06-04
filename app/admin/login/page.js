"use client";

import { useState, useEffect } from "react";  // 🔥 TAMBAHKAN useEffect
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 CEK APAKAH ADA REDIRECT OTOMATIS
  useEffect(() => {
    console.log("🔍 AdminLoginPage mounted - URL:", window.location.href);
    
    // Cek apakah user sudah login
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("🔍 Session:", session?.user?.email || "Tidak ada session");
      
      if (session?.user) {
        console.log("🔍 User sudah login:", session.user.email);
        // Cek role
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        console.log("🔍 User role:", userRole?.role);
      }
    };
    
    checkSession();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("🔍 Login attempt with:", email);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.log("🔍 SignIn error:", signInError.message);
      setError(signInError.message);
      setLoading(false);
      return;
    }

    console.log("🔍 Login success:", data.user?.email);

    // Cek role admin
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    console.log("🔍 User role from DB:", userRole?.role);

    if (!userRole || (userRole.role !== "admin" && userRole.role !== "superadmin")) {
      console.log("🔍 Bukan admin, signing out...");
      await supabase.auth.signOut();
      setError("Anda tidak memiliki akses ke halaman admin");
      setLoading(false);
      return;
    }

    console.log("🔍 Redirecting to /admin/dashboard");
    router.push("/admin/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Admin Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-xl bg-slate-700 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-xl bg-slate-700 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 rounded-xl text-white font-bold"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}