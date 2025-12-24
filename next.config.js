const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@react-email/components',
    '@react-email/render',
  ],
  webpack: (config, { isServer, nextRuntime }) => {
    // Fix for @supabase/realtime-js using Node.js APIs in Edge Runtime
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      };
    }

    // Provide process.versions polyfill for Edge Runtime
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.versions': JSON.stringify({}),
        })
      );
    }

    return config;
  },
};

module.exports = nextConfig;
