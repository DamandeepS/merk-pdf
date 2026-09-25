import type { NextConfig } from "next";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? (isGitHubActions ? "/merk-pdf" : ""),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
