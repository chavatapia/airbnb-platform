import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  serverExternalPackages: [
    "pg",
    "@prisma/adapter-pg",
    "twilio",
    "node-ical",
    "@anthropic-ai/sdk",
    "resend",
  ],
};

export default nextConfig;
