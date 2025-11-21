// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,

  // En prod solo necesitamos que el frontend sepa a qué URL pegarle.
  // Usamos NEXT_PUBLIC_API_URL que ya pusiste en .env.production
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  },

  async rewrites() {
    // ⚠️ En producción NO hacemos proxy aquí.
    // Nginx se encarga de /api → backend.
    return [];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.jsdelivr.net", pathname: "/**" },
    ],
  },
};

export default nextConfig;
