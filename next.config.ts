import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile above the repo otherwise makes
  // Turbopack mis-infer it (breaks output file tracing on deploy).
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  outputFileTracingIncludes: {
    '/og/[slug]': ['./.data/og/stats.json', './assets/og/**'],
  },
  async headers() {
    return [
      {
        source: '/data/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
