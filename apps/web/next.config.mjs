/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared packages are TypeScript source in the workspace; Next compiles
  // them itself rather than requiring a build step before `next dev`.
  transpilePackages: ['@zal/contracts', '@zal/api-client', '@zal/tokens'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  eslint: { dirs: ['src'] },
};

export default nextConfig;
