"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient"; // Sesuaikan path jika perlu

export default function PostDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();

      if (data) setPost(data);
      setLoading(false);
    }
    if (id) fetchPost();
  }, [id]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E3655B] border-t-transparent"></div>
    </div>
  );

  if (!post) return <div className="p-10 text-center">Informasi tidak ditemukan.</div>;

  return (
    <main className="min-h-screen bg-white">
      {/* Header Minimalis */}
      <div className="sticky top-0 flex items-center gap-4 bg-white/80 p-4 backdrop-blur-md border-b">
        <button onClick={() => router.back()} className="text-2xl">←</button>
        <h2 className="font-bold text-gray-800">Detail Informasi</h2>
      </div>

      <div className="p-4">
        {/* Konten Gambar (Jika ada) */}
        {post.image_url && (
          <img 
            src={post.image_url} 
            alt={post.title} 
            className="w-full h-64 object-cover rounded-3xl mb-4 shadow-sm"
          />
        )}
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h1>
        <p className="text-sm text-[#E3655B] font-medium mb-4">{post.category || "Berita Lokal"}</p>
        
        <div className="prose prose-sm text-gray-600 leading-relaxed">
          {post.content}
        </div>
      </div>
    </main>
  );
}