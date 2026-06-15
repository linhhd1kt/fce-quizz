import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'canvas', 'pdfjs-dist'],
};

export default nextConfig;
