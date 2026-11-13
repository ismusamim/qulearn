import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user and reads the session, so the whole app renders on
  // demand. Cache Components (static shells + Suspense) is deliberately off.
  cacheComponents: false,
  experimental: {
    // Spreadsheet imports send the parsed rows to a server action (default limit 1 MB).
    // Vercel caps any request body at 4.5 MB, so going higher would not help there.
    serverActions: { bodySizeLimit: "4.5mb" },
    // Backups are uploaded (gzipped) to /import/restore, which passes through src/proxy.ts (default 10 MB).
    proxyClientMaxBodySize: "50mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
