"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, VideoOff, Send } from "lucide-react";
import Hls from "hls.js";
import { supabase } from "@/lib/supabaseClient";

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

export default function LivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentContainerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState<boolean | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userData, setUserData] = useState<Profile | null>(null);
  const [isCommentLoading, setIsCommentLoading] = useState(true);
  const [videoFit, setVideoFit] = useState<'cover' | 'contain'>('cover');

  const STREAM_ID = '00c40fc1aaff4ea1882011355887bd8e';
  const hlsUrl = `https://res.cloudinary.com/dmhpgqe3o/video/live/live_stream_${STREAM_ID}_hls.m3u8`;

  useEffect(() => {
    setIsMounted(true);
  }, []);


  // Get User Profile
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

  // Check Live Status
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
    const interval = setInterval(checkLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [isMounted, hlsUrl]);

  useEffect(() => {
    if (!isMounted || isLiveActive === null) return;

    const updateLiveStatus = async () => {
      try {
        const { error } = await supabase
          .from('live_streams')
          .upsert({
            stream_id: STREAM_ID,
            is_active: isLiveActive,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'stream_id'
          });

        if (error) console.error('Error:', error);
      } catch (err) {
        console.error('Error updating live status:', err);
      }
    };

    updateLiveStatus();
  }, [isMounted, isLiveActive, STREAM_ID]);

  // FETCH COMMENTS & SUBSCRIBE REAL-TIME
  useEffect(() => {
    if (!isMounted || !isLiveActive) return;

    let isSubscribed = true;
    let commentQueue: Comment[] = [];
    let batchTimeout: NodeJS.Timeout;

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
      .channel(`live_comments_${STREAM_ID}`)
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

          commentQueue.push(commentWithAvatar);

          clearTimeout(batchTimeout);
          batchTimeout = setTimeout(() => {
            if (commentQueue.length > 0 && isSubscribed) {
              setComments(prev => {
                const updated = [...prev, ...commentQueue];
                return updated.slice(-100);
              });
              commentQueue = [];
            }
          }, 300);
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      clearTimeout(batchTimeout);
      if (commentQueue.length > 0) {
        setComments(prev => [...prev, ...commentQueue].slice(-100));
      }
      supabase.removeChannel(channel);
    };
  }, [isMounted, isLiveActive, STREAM_ID]);

  // Auto-scroll
  useEffect(() => {
    if (commentContainerRef.current) {
      const container = commentContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [comments]);

  // HLS Player + FIX ORIENTATION
  useEffect(() => {
    if (!isMounted || !isLiveActive || !videoRef.current) return;

    let hls: Hls;
    const video = videoRef.current;
    let orientationCheckInterval: NodeJS.Timeout;
    let checkCount = 0;

    // Fungsi deteksi orientasi yang lebih stabil
    const detectAndSetOrientation = () => {
      if (!video) return;

      // Coba dapatkan dimensi dari berbagai sumber
      let width = video.videoWidth;
      let height = video.videoHeight;

      // Jika belum dapat, coba dari style atau client
      if (!width || !height) {
        width = video.clientWidth || video.offsetWidth || 0;
        height = video.clientHeight || video.offsetHeight || 0;
      }

      // Jika masih 0, coba dari element parent
      if (!width || !height) {
        const parent = video.parentElement;
        if (parent) {
          width = parent.clientWidth || parent.offsetWidth || 0;
          height = parent.clientHeight || parent.offsetHeight || 0;
        }
      }

      // Jika sudah dapat dimensi yang valid
      if (width > 0 && height > 0) {
        const aspectRatio = width / height;

        // Log untuk debugging
        console.log(`Video dimensions: ${width}x${height}, Aspect: ${aspectRatio.toFixed(2)}`);

        // Jika aspect ratio lebih dari 1.2 => landscape (lebar > tinggi)
        // Jika kurang dari 0.8 => portrait (tinggi > lebar)
        // Jika di antara => square, treat as portrait untuk mobile
        if (aspectRatio > 1.2) {
          setVideoFit('cover'); // Landscape: cover
        } else {
          setVideoFit('contain'); // Portrait atau square: contain
        }

        // Clear interval setelah berhasil mendeteksi
        if (orientationCheckInterval) {
          clearInterval(orientationCheckInterval);
          orientationCheckInterval = undefined;
        }
        return true;
      }
      return false;
    };

    // Function to start orientation detection with retry
    const startOrientationDetection = () => {
      // Coba deteksi langsung
      if (detectAndSetOrientation()) {
        return;
      }

      // Jika gagal, coba dengan interval
      checkCount = 0;
      if (orientationCheckInterval) {
        clearInterval(orientationCheckInterval);
      }

      orientationCheckInterval = setInterval(() => {
        checkCount++;
        const success = detectAndSetOrientation();

        // Stop setelah 10 kali percobaan atau berhasil
        if (success || checkCount >= 10) {
          clearInterval(orientationCheckInterval);
          orientationCheckInterval = undefined;
        }
      }, 300);
    };

    video.muted = false;
    video.volume = 1.0;

    const playWithAudio = async () => {
      try {
        await video.play();
        // Start orientation detection after play starts
        setTimeout(startOrientationDetection, 100);
      } catch (err) {
        const handleUserInteraction = () => {
          video.play().catch(e => console.log('Still blocked:', e));
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('touchstart', handleUserInteraction);
        };
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('touchstart', handleUserInteraction);
      }
    };

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
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 45,
        startLevel: -1,
        fragLoadingMaxRetry: 5,
        fragLoadingRetryDelay: 500,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 300,
        liveSyncDurationCount: 3,
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

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          video.src = hlsUrl;
          playWithAudio();
        }
      });

      // Deteksi orientasi saat level loaded
      hls.on(Hls.Events.LEVEL_LOADED, () => {
        setTimeout(startOrientationDetection, 100);
      });

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        playWithAudio();
        setTimeout(startOrientationDetection, 100);
      });
    }

    // Event listeners untuk deteksi orientasi
    const handleLoadedMetadata = () => {
      setTimeout(startOrientationDetection, 50);
    };

    const handleLoadedData = () => {
      setTimeout(startOrientationDetection, 50);
    };

    const handleResize = () => {
      // Re-check orientation on resize
      setTimeout(startOrientationDetection, 100);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    window.addEventListener("resize", handleResize);

    let waitingTimeout: NodeJS.Timeout;

    const handleWaiting = () => {
      // Kasih delay 500ms sebelum muncul spinner
      waitingTimeout = setTimeout(() => {
        // Cek apakah video benar-benar buffering
        if (video && video.buffered.length > 0 && video.paused) {
          setIsBuffering(true);
        }
      }, 500);
    };

    const handlePlaying = () => {
      clearTimeout(waitingTimeout); // Hapus timeout jika video play lagi
      setIsBuffering(false);
      setTimeout(startOrientationDetection, 200);
    };

    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    return () => {
      if (hls) hls.destroy();
      if (orientationCheckInterval) clearInterval(orientationCheckInterval);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      window.removeEventListener("resize", handleResize);
    };
  }, [isMounted, isLiveActive, hlsUrl, networkQuality]);

  // AUTO-RECOVER
  useEffect(() => {
    if (!isMounted || !isLiveActive || !videoRef.current) return;

    let retryCount = 0;
    const video = videoRef.current;

    const handleStalled = () => {
      if (video.buffered.length > 0 && video.paused) {
        setTimeout(() => {
          if (retryCount < 3) {
            retryCount++;
            video.play().catch(() => {
              video.load();
              setTimeout(() => video.play().catch(console.error), 1000);
            });
          }
        }, 3000);
      }
    };

    video.addEventListener('stalled', handleStalled);
    return () => video.removeEventListener('stalled', handleStalled);
  }, [isMounted, isLiveActive]);

  // Send Comment
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

  // Simulate Viewers
  useEffect(() => {
    if (!isMounted || !isLiveActive) return;
    setViewers(Math.floor(Math.random() * 30) + 15);
    const interval = setInterval(() => {
      setViewers(prev => Math.max(1, prev + Math.floor(Math.random() * 3) - 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [isMounted, isLiveActive]);

  // Helper Avatar
  const getAvatarUrl = useCallback((avatarUrl: string | null, name: string | null) => {
    if (avatarUrl) return avatarUrl;
    const displayName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=24&bold=true&rounded=true`;
  }, []);

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

        {/* VIDEO LAYER - FIXED ORIENTATION */}
        <div className="absolute inset-0 w-full h-full z-0 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className={`w-full h-full ${videoFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            style={{
              objectFit: videoFit === 'cover' ? 'cover' : 'contain',
              objectPosition: 'center',
              width: '100%',
              height: '100%'
            }}
            playsInline
            autoPlay
            muted={false}
            volume={1.0}
          />
        </div>

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
            <div className="w-10 h-10 border-4 border-white/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        )}

        {/* TOP LAYER */}
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

        {/* BOTTOM LAYER */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-28 pb-4 px-4 flex flex-col justify-end pointer-events-none">

          {/* COMMENT CONTAINER */}
          <div
            ref={commentContainerRef}
            className="h-[200px] overflow-y-auto mb-3 pointer-events-auto scrollbar-none"
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
                      {/* AVATAR USER */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-gradient-to-br from-purple-500 to-pink-500">
                        <img
                          src={getAvatarUrl(msg.avatar_url, msg.user_name)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      {/* TEKS KOMENTAR */}
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
            className="flex gap-2 items-center pointer-events-auto"
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