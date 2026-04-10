import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  allowedDevOrigins: ['192.168.1.14'],
};

export default nextConfig;
