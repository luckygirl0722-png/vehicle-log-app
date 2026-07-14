import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true  },
  // exceljs는 네이티브 Node.js 모듈을 사용하므로 번들링에서 제외
  serverExternalPackages: ["exceljs"],
  experimental: {
    outputFileTracingRoot: __dirname,
  },
};

export default nextConfig;
