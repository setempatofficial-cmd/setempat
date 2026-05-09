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
      // Saran: Tambahkan juga domain Supabase Anda di sini jika nanti simpan foto di sana
      /* {
        protocol: 'https',
        hostname: 'kfgpftfpflelmgmmgnlm.supabase.co',
        pathname: '/storage/v1/object/public/**',
      }, */
    ],
  },
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**', '**/supabase/**'],
    };
    return config;
  },
  // Tambahkan ini untuk menonaktifkan error Turbopack
  turbopack: {},
};

module.exports = nextConfig;