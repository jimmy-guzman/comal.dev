import "./src/env";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForBuild: !process.env.VERCEL,
  },
  reactCompiler: true,
  typedRoutes: true,
};

export default nextConfig;
