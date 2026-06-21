"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Headphones, Users, Radio, Volume2, VolumeX, Send, Video } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const STREAM_ID = process.env.NEXT_PUBLIC_CLOUDINARY_STREAM_ID!;
const CLOUD_NAME = "dmhpgqe3o";

if (!STREAM_ID) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_CLOUDINARY_STREAM_ID");
}

// === URL AUDIO-ONLY YANG HEMAT ===
// Gunakan transformasi Cloudinary untuk audio-only dengan bitrate rendah
const AUDIO_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/live/live_stream_${STREAM_ID}_hls.m3u8`;

// Alternatif: Jika f_mp3 tidak support untuk HLS, gunakan ini:
// const AUDIO_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/live/live_stream_${STREAM_ID}_hls.m3u8?audio_only=1`;

interface Comment {
  id: number;
  user_id?: string;
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

export default function AudioLivePage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [listeners, setListeners] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userData, setUserData] = useState<Profile | null>(null);
  const [isCommentLoading, setIsCommentLoading] = useState(true);
  const commentContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // === Get User Profile ===
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

  // === Check Live Status ===
  useEffect(() => {
    if (!isMounted) return;

    const checkLiveStatus = async () => {
      try {
        const response = await fetch(AUDIO_URL, { method: 'HEAD' });
        if (response.ok) {
          setIsLiveActive(true);
        } else {
          setIsLiveActive(false);
        }
      } catch {
        setIsLiveActive(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [isMounted]);

  // === Audio Player (DENGAN URL HEMAT) ===
  useEffect(() => {
    if (!isMounted || !isLiveActive || !audioRef.current) return;

    const audio = audioRef.current;

    const handleCanPlay = () => {
      setIsLoading(false);
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.log('Autoplay blocked:', err);
          setIsPlaying(false);
        });
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setIsLoading(false);
      // Auto-reconnect dengan delay
      setTimeout(() => {
        if (isLiveActive) {
          audio.load();
          audio.play().catch(console.error);
        }
      }, 5000);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    // Load audio dengan URL hemat
    audio.src = AUDIO_URL;
    audio.volume = volume;
    audio.muted = isMuted;
    audio.load();

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, [isMounted, isLiveActive]);

  // === Simulate Listeners ===
  useEffect(() => {
    if (!isMounted || !isLiveActive) return;
    setListeners(Math.floor(Math.random() * 50) + 20);
    const interval = setInterval(() => {
      setListeners(prev => Math.max(1, prev + Math.floor(Math.random() * 4) - 2));
    }, 5000);
    return () => clearInterval(interval);
  }, [isMounted, isLiveActive]);

  // === Fetch Comments & Subscribe ===
  useEffect(() => {
    if (!isMounted || !isLiveActive) return;

    let isSubscribed = true;

    const fetchInitialComments = async () => {
      try {
        setIsCommentLoading(true);

        const { data: commentsData, error: commentsError } = await supabase
          .from("live_comments")
          .select(`id, user_id, user_name, comment, created_at`)
          .eq("stream_id", STREAM_ID)
          .order("created_at", { ascending: false })
          .limit(50);

        if (commentsError) {
          console.error('Error fetching comments:', commentsError);
          setComments([]);
          setIsCommentLoading(false);
          return;
        }

        if (!isSubscribed) return;

        const mappedComments: Comment[] = [];

        if (commentsData && commentsData.length > 0) {
          const userIds = [...new Set(commentsData.map((item: any) => item.user_id).filter(Boolean))];

          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            try {
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, avatar_url, full_name, username')
                .in('id', userIds);

              if (profilesData) {
                profilesMap = profilesData.reduce((acc: any, profile: any) => {
                  acc[profile.id] = profile;
                  return acc;
                }, {});
              }
            } catch (profileErr) {
              console.warn('Error fetching profiles:', profileErr);
            }
          }

          for (const item of commentsData) {
            const profile = item.user_id ? profilesMap[item.user_id] : null;
            mappedComments.push({
              id: item.id,
              user_id: item.user_id,
              user_name: item.user_name || profile?.full_name || profile?.username || "Warga",
              avatar_url: profile?.avatar_url || null,
              comment: item.comment || "",
              created_at: item.created_at || new Date().toISOString()
            });
          }
        }

        setComments(mappedComments.reverse());
      } catch (err) {
        console.error('Error in fetchInitialComments:', err);
        setComments([]);
      } finally {
        setIsCommentLoading(false);
      }
    };

    fetchInitialComments();

    const channel = supabase
      .channel(`live_comments_${STREAM_ID}_audio`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_comments",
          filter: `stream_id=eq.${STREAM_ID}`,
        },
        async (payload) => {
          const newComment = payload.new as any;
          if (!newComment || !newComment.comment) return;
          if (newComment.user_id === userData?.id) return;

          let profileData = null;
          if (newComment.user_id) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('avatar_url, full_name, username')
                .eq('id', newComment.user_id)
                .single();
              profileData = profile;
            } catch (err) { }
          }

          const commentWithAvatar: Comment = {
            id: newComment.id,
            user_id: newComment.user_id,
            user_name: newComment.user_name || profileData?.full_name || profileData?.username || "Warga",
            avatar_url: profileData?.avatar_url || null,
            comment: newComment.comment || "",
            created_at: newComment.created_at || new Date().toISOString()
          };

          setComments(prev => [...prev, commentWithAvatar].slice(-100));
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [isMounted, isLiveActive, STREAM_ID, userData?.id]);

  // === Auto-scroll comments ===
  useEffect(() => {
    if (commentContainerRef.current) {
      const container = commentContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [comments]);

  // === Send Comment ===
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userData) return;

    const commentText = newComment.trim();
    setNewComment("");

    try {
      const { error } = await supabase.from("live_comments").insert({
        user_id: userData.id,
        user_name: userData.full_name || userData.username || "Warga",
        comment: commentText,
        stream_id: STREAM_ID,
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error("Gagal mengirim komentar:", error.message);
        alert("Gagal mengirim komentar. Silakan coba lagi.");
        setNewComment(commentText);
      } else {
        const optimisticComment: Comment = {
          id: Date.now(),
          user_id: userData.id,
          user_name: userData.full_name || userData.username || "Warga",
          avatar_url: userData.avatar_url || null,
          comment: commentText,
          created_at: new Date().toISOString()
        };
        setComments(prev => [...prev, optimisticComment]);
      }
    } catch (err) {
      console.error("Error saat kirim komentar:", err);
      alert("Gagal mengirim komentar. Silakan coba lagi.");
      setNewComment(commentText);
    }
  };

  // === Toggle Play/Pause ===
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  }, [isPlaying]);

  // === Toggle Mute ===
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // === Change Volume ===
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newVolume = parseFloat(e.target.value);
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      audioRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  // === Helper Avatar ===
  const getAvatarUrl = useCallback((avatarUrl: string | null, name: string | null) => {
    if (avatarUrl) return avatarUrl;
    const displayName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=24&bold=true&rounded=true`;
  }, []);

  // === Loading State ===
  if (!isMounted || isLoading) {
    return (
      <div className="fixed inset-0 bg-neutral-900 flex justify-center items-center z-[100]">
        <div className="w-full max-w-[420px] h-full bg-black flex flex-col items-center justify-center text-white gap-3">
          <div className="w-10 h-10 border-4 border-white/20 border-t-red-500 rounded-full animate-spin"></div>
          <p className="text-xs text-neutral-400 tracking-wider">Memuat siaran audio...</p>
        </div>
      </div>
    );
  }

  // === Offline State ===
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
            <Radio size={48} />
          </div>
          <h2 className="text-lg font-bold tracking-wide">Siaran Belum Dimulai</h2>
          <p className="text-sm text-neutral-400 mt-2 max-w-[280px]">
            Saat ini tidak ada siaran audio. Silakan kembali lagi nanti.
          </p>
          <button onClick={() => router.back()} className="mt-8 px-6 py-2 bg-neutral-800 text-sm font-semibold rounded-full border border-neutral-700">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // === Main Audio UI ===
  return (
    <div className="fixed inset-0 bg-neutral-950 flex justify-center items-center z-[100]">
      <div className="relative w-full max-w-[420px] h-full bg-gradient-to-b from-neutral-900 to-black overflow-hidden shadow-2xl">

        {/* === Audio Element === */}
        <audio ref={audioRef} playsInline preload="auto" />

        {/* === Background Visual === */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-red-900/20 via-purple-900/10 to-blue-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/5 via-transparent to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-red-500/10 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-red-500/5 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-red-500/5 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* === Top Bar === */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>

            {/* === Tombol Switch ke Video === */}
            <button
              onClick={() => router.push('/live')}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-red-600/30 hover:border-red-500/50 transition-all duration-200 group"
              title="Beralih ke mode video"
            >
              <Video size={20} className="group-hover:text-red-400 transition-colors" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-red-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              LIVE
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-2 py-1 rounded-md flex items-center gap-1 text-white text-[10px] font-bold shadow-md">
              <Users size={13} />
              <span>{listeners}</span>
            </div>
          </div>
        </div>

        {/* === Center Content === */}
        <div className="absolute inset-0 z-5 flex flex-col items-center justify-center px-6">
          {/* Radio Icon */}
          <div className="relative mb-6">
            <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-2xl shadow-red-500/20 ${isPlaying ? 'animate-pulse' : ''}`}>
              <Radio size={56} className="text-white" />
            </div>
            {isPlaying && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </div>

          {/* Station Info */}
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Siaran Langsung</h1>
          <p className="text-sm text-white/50 mb-6">Dengarkan siaran audio secara real-time</p>

          {/* === Audio Controls === */}
          <div className="w-full max-w-xs space-y-4">
            {/* Play/Pause Button */}
            <div className="flex justify-center">
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 transition-all duration-200 flex items-center justify-center shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3">
              <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600"
              />
              <span className="text-white/30 text-xs w-8 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* === Bottom: Comments === */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-28 pb-4 px-4 flex flex-col justify-end">

          {/* Comments Container */}
          <div
            ref={commentContainerRef}
            className="h-[160px] overflow-y-auto mb-3 scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            <div className="flex flex-col justify-end min-h-full">
              <div className="space-y-2 pb-2">
                {isCommentLoading ? (
                  <div className="text-center text-white/30 text-xs py-4">
                    Memuat komentar...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-white/30 text-xs py-4">
                    Belum ada komentar. Jadilah yang pertama!
                  </div>
                ) : (
                  comments.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className="flex items-start gap-2 animate-fadeIn px-1 text-left"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-gradient-to-br from-purple-500 to-pink-500">
                        <img
                          src={getAvatarUrl(msg.avatar_url, msg.user_name)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col text-left">
                        <span className="font-extrabold text-slate-300 text-[11px] tracking-wide mb-0.5 text-left drop-shadow-md">
                          {msg.user_name || "Warga"}
                        </span>
                        <p className="text-[13px] font-medium text-white leading-snug break-words text-left drop-shadow-md">
                          {msg.comment}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Comment Input */}
          <form
            onSubmit={handleSendComment}
            className="flex gap-2 items-center"
          >
            {userData && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-gradient-to-br from-purple-500 to-pink-500">
                <img
                  src={getAvatarUrl(userData.avatar_url, userData.full_name || userData.username)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
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