import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Set basePath if deploying to https://<username>.github.io/<repo-name>
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
