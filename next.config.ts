import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "pg", "@clickhouse/client", "@mastra/core", "@mastra/ai-sdk"],
};

export default nextConfig;
