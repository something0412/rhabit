import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our shared package is plain TypeScript, so Next needs to compile it too
  transpilePackages: ["@productivity/shared"],
};

export default nextConfig;
