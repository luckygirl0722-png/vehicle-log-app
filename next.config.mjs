import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true  },
  // jszip을 webpack 번들링 대상에서 제외 → 런타임에 native require로 로드
  serverExternalPackages: ["jszip"],
  experimental: {
    outputFileTracingRoot: __dirname,
  },
};

export default nextConfig;
