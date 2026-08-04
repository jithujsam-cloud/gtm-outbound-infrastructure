import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SWC WASM on ARM64/Android cannot type-check — Vercel uses native bindings
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
