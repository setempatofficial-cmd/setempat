"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function StudioPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamId, setStreamId] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Konfigurasi Cloudinary
  const CLOUD_NAME = "dmhpgqe3o"; // Ganti dengan cloud name kamu
  const STREAM_ID = "00c40fc1aaff4ea1882011355887bd8e"; // Stream ID yang sudah dibuat

  // Mulai siaran
  const startStream = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Minta akses kamera dan mikrofon
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Kamera depan
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      setMediaStream(stream);
      
      // Tampilkan preview di video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 2. Siapkan RTMP URL dan Stream Key
      const rtmpUrl = `rtmp://live.cloudinary.com/streams`;
      const streamKey = `${STREAM_ID}`; // Gunakan STREAM_ID sebagai stream key

      // 3. Kirim stream ke Cloudinary menggunakan WebRTC ke RTMP
      // Kita akan menggunakan pendekatan dengan MediaRecorder untuk mengirim ke server
      await sendStreamToCloudinary(stream, rtmpUrl, streamKey);

      // 4. Update status di database
      const { error: dbError } = await supabase
        .from('live_streams')
        .upsert({
          stream_id: STREAM_ID,
          is_active: true,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'stream_id'
        });

      if (dbError) throw dbError;

      setIsStreaming(true);
      
    } catch (err) {
      console.error("Error starting stream:", err);
      setError(err instanceof Error ? err.message : "Gagal memulai siaran");
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk mengirim stream ke Cloudinary via RTMP
  const sendStreamToCloudinary = async (
    stream: MediaStream,
    rtmpUrl: string,
    streamKey: string
  ) => {
    return new Promise((resolve, reject) => {
      try {
        // Gunakan WebSocket atau fetch API untuk mengirim stream
        // Karena browser tidak bisa langsung mengirim ke RTMP,
        // kita perlu menggunakan WebRTC atau library pihak ketiga
        
        // Pendekatan sederhana: Gunakan MediaRecorder untuk merekam dan kirim ke server
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2500000
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          try {
            // Kirim chunk ke API endpoint kita
            const blob = new Blob(chunks, { type: 'video/webm' });
            
            // Upload ke Cloudinary via API
            const formData = new FormData();
            formData.append('file', blob, 'stream.webm');
            formData.append('upload_preset', 'live_stream'); // Sesuaikan dengan preset kamu
            
            // Upload ke Cloudinary
            const response = await fetch(
              `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
              {
                method: 'POST',
                body: formData
              }
            );

            if (!response.ok) {
              throw new Error('Failed to upload to Cloudinary');
            }

            const data = await response.json();
            console.log('Upload successful:', data);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        };

        // Rekam setiap 5 detik
        mediaRecorder.start(5000);
        
        // Simpan mediaRecorder untuk dihentikan nanti
        (window as any).mediaRecorder = mediaRecorder;
        
        // Set timeout untuk stop recording jika perlu
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 30000); // Rekam 30 detik untuk demo

      } catch (err) {
        reject(err);
      }
    });
  };

  // Hentikan siaran
  const stopStream = async () => {
    setIsLoading(true);
    try {
      // Hentikan MediaRecorder
      const mediaRecorder = (window as any).mediaRecorder;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }

      // Hentikan semua track kamera/mikrofon
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      }

      // Update status di database
      const { error } = await supabase
        .from('live_streams')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('stream_id', STREAM_ID);

      if (error) throw error;

      setIsStreaming(false);
      router.push('/dashboard');

    } catch (err) {
      console.error("Error stopping stream:", err);
      setError(err instanceof Error ? err.message : "Gagal menghentikan siaran");
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup saat komponen unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      const mediaRecorder = (window as any).mediaRecorder;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    };
  }, [mediaStream]);

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="bg-neutral-800 rounded-2xl p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          🎥 Studio Siaran Langsung
        </h1>

        {/* Preview Video */}
        <div className="bg-black rounded-xl overflow-hidden mb-6 aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          {!isStreaming && !mediaStream && (
            <div className="flex items-center justify-center h-full text-neutral-500">
              <div className="text-center">
                <div className="text-6xl mb-4">📹</div>
                <p>Kamera belum diaktifkan</p>
                <p className="text-sm">Klik "Mulai Siaran" untuk mengakses kamera</p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg mb-4 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Stream Info */}
        <div className="bg-neutral-700 rounded-lg p-4 mb-6">
          <p className="text-neutral-300 text-sm mb-1">Stream ID:</p>
          <code className="bg-neutral-900 text-green-400 px-3 py-2 rounded text-xs block break-all">
            {STREAM_ID}
          </code>
          <p className="text-neutral-400 text-xs mt-2">
            📡 URL HLS: https://res.cloudinary.com/{CLOUD_NAME}/video/live/live_stream_{STREAM_ID}_hls.m3u8
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-4">
          {!isStreaming ? (
            <button
              onClick={startStream}
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memulai...
                </>
              ) : (
                <>
                  <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  🎥 Mulai Siaran
                </>
              )}
            </button>
          ) : (
            <button
              onClick={stopStream}
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menghentikan...
                </>
              ) : (
                "⏹ Stop Siaran"
              )}
            </button>
          )}

          <button
            onClick={() => router.push('/live')}
            className="px-6 py-4 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-xl transition"
          >
            👁 Lihat Siaran
          </button>
        </div>

        {/* Status */}
        <div className="mt-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
            isStreaming 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-neutral-700 text-neutral-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isStreaming ? 'bg-green-400 animate-pulse' : 'bg-neutral-500'
            }`} />
            Status: {isStreaming ? '🟢 LIVE' : '⚪ Offline'}
          </div>
        </div>
      </div>
    </div>
  );
}