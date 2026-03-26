import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "pg", "@clickhouse/client"],
};

export default nextConfig;
