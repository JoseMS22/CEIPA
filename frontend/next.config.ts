import type { NextConfig } from "next";

const requiredEnv = ["NEXT_PUBLIC_API_BASE_URL", "INTERNAL_API_BASE_URL"] as const;
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key]!.trim() === "") {
    throw new Error(`❌ Missing env var: ${key}`);
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.INTERNAL_API_BASE_URL}/api/:path*`,
      },
    ];
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
