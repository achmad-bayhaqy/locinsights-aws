import type { NextConfig } from "next";

/**
 * Next.js configuration for LocInsights.
 *
 * - `output: 'standalone'` produces a self-contained .next/standalone build
 *   (smaller container image, faster cold starts on Vercel).
 * - `reactStrictMode: true` surfaces unsafe side-effects in development.
 * - TypeScript errors are NOT ignored — production builds must be type-safe.
 *
 * Maintained by: MAP Active Adiperkasa — Data Team
 */
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Prisma generates its client into node_modules; we must NOT transpile it.
  // Vercel handles Prisma binaries via postinstall (see package.json).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
    ],
  },
};

export default nextConfig;
