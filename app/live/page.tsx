"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, VideoOff, Send } from "lucide-react";
import Hls from "hls.js";
import { supabase } from "@/lib/supabaseClient";

interface Comment {
  id: number;
  user_name: string | null;
  avatar_url: string | null;
  comment: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
}

export default function LivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentEndRef = useRef<HTMLDivElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState<boolean | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<'high' | 'medium' | 'low'>('high');

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userData, setUserData] = useState<Profile | null>(null);

  const STREAM_ID = '00c40fc1aaff4ea1882011355887bd8e';
  const hlsUrl = `https://res.cloudinary.com/dmhpgqe3o/video/live/live_stream_${STREAM_ID}_hls.m3u8`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Detect network quality
  useEffect(() => {
    if (!isMounted) return;

    const detectNetworkQuality = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          const speed = connection.downlink || 0;
          if (speed > 5) setNetworkQuality('high');
          else if (speed > 2) setNetworkQuality('medium');
          else setNetworkQuality('low');

          const handleChange = () => {
            const newSpeed = connection.downlink || 0;
            if (newSpeed > 5) setNetworkQuality('high');
            else if (newSpeed > 2) setNetworkQuality('medium');
            else setNetworkQuality('low');
          };
          connection.addEventListener('change', handleChange);
          return () => connection.removeEventListener('change', handleChange);
        }
      }
      setNetworkQuality('medium');
    };

    detectNetworkQuality();
  }, [isMounted]);

  // 1. Get User Data from profiles table
  useEffect(() => {
    if (!isMounted) return;

    const getUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, role')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error);
            setUserData({
              id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || "Warga Setempat",
              username: user.email?.split('@')[0] || null,
              avatar_url: null,
              role: 'warga'
            });
          } else if (profile) {
            setUserData(profile);
          }
        }
      } catch (err) {
        console.error('Error:', err);
      }
    };

    getUserProfile();
  }, [isMounted]);

  // 2. Check Live Status
  useEffect(() => {
    if (!isMounted) return;

    const checkLiveStatus = async () => {
      try {
        const response = await fetch(hlsUrl, { method: 'HEAD' });
        if (response.ok) {
          setIsLiveActive(true);
        } else {
          setIsLiveActive(false);
        }
      } catch {
        setIsLiveActive(false);
      }
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 10000);
    return () => clearInterval(interval);
  }, [isMounted, hlsUrl]);

  // 3. Real-time Comments with avatar from profiles - FIXED with LEFT JOIN
  useEffect(() => {
    if (!isMounted || !isLiveActive) return;

    const fetchComments = async () => {
      try {
        // Gunakan LEFT JOIN agar tetap bisa ambil komentar walau profile tidak ada
        const { data, error } = await supabase
          .from("live_comments")
          .select(`
            id,
            user_id,
            user_name,
            comment,
            created_at,
            profiles (
              avatar_url,
              full_name,
              username
            )
          `)
          .eq("stream_id", STREAM_ID)
          .order("created_at", { ascending: true })
          .limit(50);

        if (error) {
          // Ini hanya warning, bukan error fatal
          console.warn('Warning saat mengambil komentar:', error.message);
          return;
        }

        // Map data dengan aman - jika tidak ada profile, pakai default
        const commentsWithAvatar = (data || []).map((item: any) => ({
          id: item.id,
          user_name: item.user_name ||
            item.profiles?.full_name ||
            item.profiles?.username ||
            "Warga",
          avatar_url: item.profiles?.avatar_url || null,
          comment: item.comment || "",
          created_at: item.created_at || new Date().toISOString()
        }));

        setComments(commentsWithAvatar);
      } catch (err) {
        // Tangkap error dengan aman
        console.warn('Error saat fetch komentar:', err);
        // Set comments kosong agar tidak crash
        setComments([]);
      }
    };

    fetchComments();

    // Subscribe ke perubahan komentar
    const channel = supabase
      .channel(`live_comments:${STREAM_ID}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_comments",
          filter: `stream_id=eq.${STREAM_ID}`,
        },
        async (payload) => {
          try {
            const newComment = payload.new as any;

            // Ambil profile jika ada
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url, full_name, username')
              .eq('id', newComment.user_id)
              .single();

            const commentWithAvatar = {
              id: newComment.id,
              user_name: newComment.user_name ||
                profile?.full_name ||
                profile?.username ||
                "Warga",
              avatar_url: profile?.avatar_url || null,
              comment: newComment.comment || "",
              created_at: newComment.created_at || new Date().toISOString()
            };

            setComments((prev) => [...prev, commentWithAvatar]);
          } catch (err) {
            console.warn('Error saat proses komentar baru:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, isLiveActive]);

  // 4. Auto-scroll comments
  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // 5. Initialize HLS Player with adaptive bitrate based on network
  useEffect(() => {
    if (!isMounted || !isLiveActive || !videoRef.current) return;

    let hls: Hls;
    const video = videoRef.current;

    // Always start with audio enabled
    video.muted = false;
    video.volume = 1.0;

    const playWithAudio = async () => {
      try {
        await video.play();
        console.log("✅ Audio aktif dan video diputar");
      } catch (err) {
        console.log("⚠️ Auto-play mungkin diblokir browser:", err);
        const handleUserInteraction = () => {
          video.play().catch(e => console.log('Still blocked:', e));
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('touchstart', handleUserInteraction);
        };
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('touchstart', handleUserInteraction);
      }
    };

    // Configure quality based on network
    const getMaxBitrate = () => {
      switch (networkQuality) {
        case 'high': return 8000000;
        case 'medium': return 2000000;
        case 'low': return 500000;
        default: return 2000000;
      }
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: networkQuality === 'high',
        maxBufferLength: networkQuality === 'high' ? 30 : 10,
        maxMaxBufferLength: networkQuality === 'high' ? 60 : 20,
        abrEwmaDefaultEstimate: getMaxBitrate(),
        abrBandWidthUpFactor: networkQuality === 'high' ? 1.2 : 0.8,
        abrBandWidthDownFactor: 0.8,
        startLevel: -1
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels || [];
        if (levels.length > 0) {
          const targetBitrate = getMaxBitrate();
          let bestLevel = 0;
          for (let i = 0; i < levels.length; i++) {
            if (levels[i].bitrate && levels[i].bitrate <= targetBitrate) {
              bestLevel = i;
            }
          }
          if (bestLevel < levels.length) {
            hls.currentLevel = bestLevel;
          }
        }
        playWithAudio();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        console.log(`📊 Switched to level ${data.level}`);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.log("⚠️ HLS Error, mencoba direct play...");
          video.src = hlsUrl;
          playWithAudio();
        }
      });

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        playWithAudio();
      });
    }

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
    };
  }, [isMounted, isLiveActive, hlsUrl, networkQuality]);

  // 6. Send Comment
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userData) return;

    const commentText = newComment;
    setNewComment("");

    try {
      const { error } = await supabase.from("live_comments").insert({
        user_id: userData.id,
        user_name: userData.full_name || userData.username || "Warga",
        comment: commentText,
        stream_id: STREAM_ID
      });

      if (error) {
        console.error("Gagal mengirim komentar:", error.message);
        // Tampilkan pesan ke user
        alert("Gagal mengirim komentar. Silakan coba lagi.");
      }
    } catch (err) {
      console.error("Error saat kirim komentar:", err);
    }
  };

  // 7. Simulate Viewers
  useEffect(() => {
    if (!isMounted || !isLiveActive) return;
    setViewers(Math.floor(Math.random() * 30) + 15);
    const interval = setInterval(() => {
      setViewers(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [isMounted, isLiveActive]);

  // Helper untuk mendapatkan avatar URL
  const getAvatarUrl = (avatarUrl: string | null, name: string | null) => {
    if (avatarUrl) return avatarUrl;
    const displayName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=24&bold=true&rounded=true`;
  };

  if (!isMounted) return null;

  if (isLiveActive === null) {
    return (
      <div className="fixed inset-0 bg-neutral-900 flex justify-center items-center z-[100]">
        <div className="w-full max-w-[420px] h-full bg-black flex flex-col items-center justify-center text-white gap-3">
          <div className="w-10 h-10 border-4 border-white/20 border-t-red-500 rounded-full animate-spin"></div>
          <p className="text-xs text-neutral-400 tracking-wider">Mencari siaran...</p>
        </div>
      </div>
    );
  }

  if (isLiveActive === false) {
    return (
      <div className="fixed inset-0 bg-neutral-900 flex justify-center items-center z-[100]">
        <div className="relative w-full max-w-[420px] h-full bg-black flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="absolute top-0 left-0 right-0 p-4">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white">
              <ArrowLeft size={24} />
            </button>
          </div>
          <div className="bg-neutral-900 p-6 rounded-full mb-4 text-neutral-500 animate-pulse">
            <VideoOff size={48} />
          </div>
          <h2 className="text-lg font-bold tracking-wide">Siaran Belum Dimulai</h2>
          <p className="text-sm text-neutral-400 mt-2 max-w-[280px]">
            Saat ini tidak ada siaran langsung. Silakan kembali lagi nanti.
          </p>
          <button onClick={() => router.back()} className="mt-8 px-6 py-2 bg-neutral-800 text-sm font-semibold rounded-full border border-neutral-700">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 flex justify-center items-center z-[100]">
      <div className="relative w-full max-w-[420px] h-full bg-black overflow-hidden shadow-2xl">

        {/* VIDEO LAYER */}
        <div className="absolute inset-0 w-full h-full z-0 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover min-h-full min-w-full scale-[1.02]"
            style={{
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            playsInline
            autoPlay
            muted={false}
            volume={1.0}
          />
        </div>

        {/* Loading Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
            <div className="w-10 h-10 border-4 border-white/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        )}

        {/* TOP LAYER: Navigation & Live Info */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-30 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/10 pointer-events-auto"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="flex items-center gap-1.5 pointer-events-auto">


            <div className="bg-red-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              LIVE
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-2 py-1 rounded-md flex items-center gap-1 text-white text-[10px] font-bold shadow-md">
              <Eye size={13} />
              <span>{viewers}</span>
            </div>
          </div>
        </div>

        {/* BOTTOM LAYER: Chat with Avatar from Profiles */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/30 to-transparent pt-24 pb-4 px-4 flex flex-col justify-end pointer-events-none">

          {/* Comments Flow with Avatars */}
          <div className="h-[200px] overflow-y-auto space-y-2 mb-4 scrollbar-none pointer-events-auto flex flex-col justify-end">
            <div className="space-y-2">
              {comments.length === 0 ? (
                <div className="text-center text-white/30 text-xs py-4">
                  Belum ada komentar. Jadilah yang pertama!
                </div>
              ) : (
                comments.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start gap-2 animate-fadeIn"
                  >
                    {/* Avatar - smaller size 24px */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-gradient-to-br from-purple-500 to-pink-500">
                      <img
                        src={getAvatarUrl(msg.avatar_url, msg.user_name)}
                        alt={msg.user_name || "User"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const initial = document.createElement('span');
                            initial.className = 'w-full h-full flex items-center justify-center text-white text-[10px] font-bold';
                            initial.textContent = msg.user_name?.charAt(0).toUpperCase() || 'U';
                            parent.appendChild(initial);
                          }
                        }}
                      />
                    </div>

                    {/* Comment Content - WHITE username */}
                    <div className="flex-1 min-w-0">
                      <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-3 py-1.5 inline-block max-w-[85%]">
                        <p className="text-xs break-words text-white leading-relaxed">
                          <span className="font-bold text-white mr-1.5 text-[10px]">
                            {msg.user_name || "Warga"}
                          </span>
                          <span className="text-white/90 text-[13px] font-medium">
                            {msg.comment}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentEndRef} />
            </div>
          </div>

          {/* Comment Input Form */}
          <form
            onSubmit={handleSendComment}
            className="flex gap-2 items-center pointer-events-auto"
          >
            {/* User Avatar - smaller size */}
            {userData && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-gradient-to-br from-purple-500 to-pink-500">
                <img
                  src={getAvatarUrl(userData.avatar_url, userData.full_name || userData.username)}
                  alt={userData.full_name || userData.username || "User"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const initial = document.createElement('span');
                      initial.className = 'w-full h-full flex items-center justify-center text-white text-[10px] font-bold';
                      initial.textContent = (userData.full_name || userData.username || 'U').charAt(0).toUpperCase();
                      parent.appendChild(initial);
                    }
                  }}
                />
              </div>
            )}
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={userData ? "Kirim komentar..." : "Masuk untuk berkomentar..."}
              disabled={!userData}
              className="flex-1 bg-black/40 backdrop-blur-md text-white border border-white/20 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-red-500 placeholder-neutral-300 shadow-inner disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || !userData}
              className="w-8 h-8 bg-red-600 hover:bg-red-500 disabled:bg-black/40 disabled:text-neutral-500 text-white border border-white/10 rounded-full flex items-center justify-center transition-colors shrink-0 shadow-md"
            >
              <Send size={14} />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}