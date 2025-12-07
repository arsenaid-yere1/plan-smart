/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@react-email/components',
    '@react-email/render',
  ],
};

module.exports = nextConfig;
