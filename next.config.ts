import type { NextConfig } from "next";

// GitHub Pages serves a project site under /<repo>/, so the build needs every
// asset path prefixed with that base — set by the workflow at build time.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
};

export default nextConfig;
