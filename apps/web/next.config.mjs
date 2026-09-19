import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Force one copy of React Query.
 *
 * In a pnpm workspace every package resolves its own dependencies, so
 * `@zal/api-client` can end up bundled with a different copy than the app.
 * Two copies means two context registries, and the symptom is a baffling
 * "No QueryClient set" thrown by code that is plainly inside the provider.
 * Pinning the resolution makes that class of bug impossible rather than
 * intermittent.
 *
 * The alias points at the package's *directory*, not its entry file, so
 * subpath imports still resolve.
 *
 * React itself is deliberately NOT aliased. Next resolves it through the
 * `react-server` export condition when building the server layer, where
 * `React.cache` lives; a plain directory alias flattens that away and the
 * build fails with "r.cache is not a function". Next already dedupes React
 * across transpiled workspace packages, so there is nothing to fix there.
 */
const singletons = ['@tanstack/react-query'];

function packageDir(name) {
  return dirname(require.resolve(`${name}/package.json`, { paths: [process.cwd()] }));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The shared packages are TypeScript source in the workspace; Next compiles
  // them itself rather than requiring a build step before `next dev`.
  transpilePackages: ['@zal/contracts', '@zal/api-client', '@zal/tokens', '@zal/i18n'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  eslint: { dirs: ['src'] },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(singletons.map((name) => [name, packageDir(name)])),
    };
    return config;
  },
};

export default nextConfig;
