import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are posted to the API routes as base64 JSON. Ontario furniture
  // listings run up to 10 images, so the default 1MB body limit is too small
  // even after the client downscales them.
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
