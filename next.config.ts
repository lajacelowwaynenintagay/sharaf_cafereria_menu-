import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.7", "192.168.1.3", "localhost"],
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
