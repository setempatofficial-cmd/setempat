// components/ChunkErrorHandler.jsx
'use client'

import { useEffect, useState } from 'react';

export function ChunkErrorHandler() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Handler untuk chunk errors
    const handleChunkError = (event) => {
      const error = event.error || event.message;
      
      // Deteksi chunk load error
      const isChunkError = 
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Failed to load chunk') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('ChunkLoadError');

      if (isChunkError) {
        console.warn('🔴 Chunk load error detected, attempting recovery...');
        
        // Log untuk monitoring
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'chunk_error', {
            error: error.message || 'ChunkLoadError',
            url: window.location.href,
          });
        }

        // Tampilkan fallback jika belum
        if (!document.getElementById('chunk-error-fallback')) {
          setShowFallback(true);
          
          // Tambahkan UI fallback
          const fallback = document.createElement('div');
          fallback.id = 'chunk-error-fallback';
          fallback.style.cssText = `
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white;
            padding: 20px;
            text-align: center;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          `;
          fallback.innerHTML = `
            <div style="max-width: 400px;">
              <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
              <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 12px; color: #1a1a1a;">
                Gagal Memuat Aplikasi
              </h2>
              <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
                Terjadi kesalahan teknis. Silakan refresh halaman untuk mencoba lagi.
              </p>
              <button 
                onclick="window.location.reload()" 
                style="
                  padding: 12px 32px;
                  background: #E3655B;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 500;
                  cursor: pointer;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#d44a40'"
                onmouseout="this.style.background='#E3655B'"
              >
                🔄 Refresh Halaman
              </button>
              <p style="color: #999; font-size: 12px; margin-top: 16px;">
                Jika masalah berlanjut, coba clear cache browser
              </p>
            </div>
          `;
          document.body.appendChild(fallback);
          
          // Sembunyikan konten utama
          const root = document.getElementById('__next');
          if (root) root.style.display = 'none';
        }

        // Coba auto-reload setelah 3 detik
        setTimeout(() => {
          if (document.getElementById('chunk-error-fallback')) {
            console.log('🔄 Auto-reloading...');
            window.location.reload();
          }
        }, 3000);
      }
    };

    // Pasang event listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return null;
}