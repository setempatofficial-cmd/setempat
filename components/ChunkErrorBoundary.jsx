// components/ChunkErrorBoundary.jsx
'use client'

import { Component } from 'react';

export class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorType: null,
      errorMessage: ''
    };
  }

  static getDerivedStateFromError(error) {
    // Deteksi jenis error
    const isChunkError = 
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to load chunk') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('ChunkLoadError');

    return { 
      hasError: true, 
      errorType: isChunkError ? 'chunk' : 'general',
      errorMessage: error?.message || 'Unknown error'
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error
    console.error('❌ Error Boundary caught:', error, errorInfo);

    // Kirim ke monitoring jika ada
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'error_boundary', {
        error_type: this.state.errorType,
        error_message: error?.message || 'Unknown',
        component_stack: errorInfo?.componentStack || '',
      });
    }
  }

  handleReload = () => {
    // Reload dengan cache busting
    const url = new URL(window.location.href);
    url.searchParams.set('_t', Date.now());
    window.location.href = url.toString();
  };

  handleClearCache = () => {
    // Petunjuk clear cache
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
    }
    // Reload setelah clear cache
    setTimeout(() => this.handleReload(), 500);
  };

  render() {
    if (this.state.hasError) {
      // Error Chunk
      if (this.state.errorType === 'chunk') {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-white">
            <div className="max-w-md">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-3 text-gray-900">
                Gagal Memuat Komponen
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Beberapa komponen aplikasi gagal dimuat. Ini mungkin terjadi karena ada versi baru aplikasi.
              </p>
              <div className="space-y-3">
                <button
                  onClick={this.handleReload}
                  className="w-full px-6 py-3 bg-[#E3655B] text-white rounded-lg hover:bg-[#d44a40] transition-colors font-medium"
                >
                  🔄 Refresh Halaman
                </button>
                <button
                  onClick={this.handleClearCache}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  🗑️ Clear Cache & Refresh
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-4">
                Jika masalah berlanjut, hubungi dukungan
              </p>
            </div>
          </div>
        );
      }

      // Error General
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-white">
          <div className="max-w-md">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-2xl font-bold mb-3 text-gray-900">
              Terjadi Kesalahan
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Maaf, terjadi kesalahan tak terduga. Tim kami sudah diberitahu dan akan segera memperbaikinya.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full px-6 py-3 bg-[#E3655B] text-white rounded-lg hover:bg-[#d44a40] transition-colors font-medium"
            >
              🔄 Coba Lagi
            </button>
            <p className="text-gray-400 text-sm mt-4">
              Error: {this.state.errorMessage}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}