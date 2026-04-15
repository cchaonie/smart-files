import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 生产环境使用 standalone 输出
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  // 允许 Docker 环境中的开发连接
  allowedDevOrigins: ['192.168.1.14', 'localhost', '0.0.0.0'],
};

export default nextConfig;
