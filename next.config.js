/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude supabase folder dari proses build Next.js
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Abaikan folder supabase
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/**'],
    };
    return config;
  },
};

module.exports = nextConfig;