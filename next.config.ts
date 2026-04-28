import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 始终使用 standalone 输出（Docker 构建需要）
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  // 允许 Docker 环境中的开发连接
  allowedDevOrigins: ['192.168.1.14', 'localhost', '0.0.0.0'],
};

export default nextConfig;
