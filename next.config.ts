import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.14"],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
