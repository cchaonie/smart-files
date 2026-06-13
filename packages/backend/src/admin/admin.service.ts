import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            files: true,
            photos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch storage usage for each user
    const result = [];
    for (const user of users) {
      const storageAgg = await this.prisma.file.aggregate({
        where: { userId: user.id, deletedAt: null },
        _sum: { size: true },
      });
      const storageUsage = storageAgg._sum.size
        ? Number(storageAgg._sum.size)
        : 0;

      result.push({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        photoCount: user._count.photos,
        fileCount: user._count.files,
        storageUsage,
      });
    }

    return result;
  }

  async resetPassword(userId: string, requesterId: string) {
    if (userId === requesterId) {
      throw new ForbiddenException('Cannot reset your own password');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, temporaryPassword: temporaryPassword };
  }

  async changeRole(userId: string, newRole: string) {
    if (!['admin', 'user'].includes(newRole)) {
      throw new BadRequestException('Role must be "admin" or "user"');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't allow demoting the last admin
    if (user.role === 'admin' && newRole !== 'admin') {
      const adminCount = await this.prisma.user.count({
        where: { role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return updated;
  }

  async getUserUsage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fileAgg = await this.prisma.file.aggregate({
      where: { userId, deletedAt: null },
      _count: { id: true },
      _sum: { size: true },
    });

    const photoCount = await this.prisma.photo.count({
      where: { userId },
    });

    return {
      userId,
      fileCount: fileAgg._count.id,
      photoCount,
      totalSize: fileAgg._sum.size ? Number(fileAgg._sum.size) : 0,
    };
  }
}
