/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  // Untuk Next.js 16, lebih baik pakai Turbopack
  turbopack: {
    // Konfigurasi Turbopack jika diperlukan
  },
};

module.exports = nextConfig;