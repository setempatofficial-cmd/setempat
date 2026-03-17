/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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