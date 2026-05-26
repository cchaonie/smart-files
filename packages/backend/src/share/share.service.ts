import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const SHARE_TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class ShareService {
  constructor(private prisma: PrismaService) {}

  async createShare(
    userId: string,
    fileId: string,
    opts?: { password?: string; expiresInHours?: number },
  ) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const token = crypto.randomBytes(SHARE_TOKEN_BYTES).toString('hex');

    let passwordHash: string | null = null;
    if (opts?.password) {
      passwordHash = await bcrypt.hash(opts.password, BCRYPT_ROUNDS);
    }

    let expiresAt: Date | null = null;
    if (opts?.expiresInHours) {
      expiresAt = new Date(Date.now() + opts.expiresInHours * 3600 * 1000);
    }

    const share = await this.prisma.share.create({
      data: {
        fileId,
        token,
        passwordHash,
        expiresAt,
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
      },
    });

    return {
      id: share.id,
      token: share.token,
      fileId: share.fileId,
      fileName: share.file.name,
      fileSize: share.file.size.toString(),
      mimeType: share.file.mimeType,
      hasPassword: !!share.passwordHash,
      expiresAt: share.expiresAt?.toISOString() || null,
      downloadCount: share.downloadCount,
      createdAt: share.createdAt.toISOString(),
    };
  }

  async getShareInfo(token: string) {
    const share = await this.prisma.share.findUnique({
      where: { token },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    return {
      token: share.token,
      fileName: share.file.name,
      fileSize: share.file.size.toString(),
      mimeType: share.file.mimeType,
      hasPassword: !!share.passwordHash,
      expiresAt: share.expiresAt?.toISOString() || null,
      downloadCount: share.downloadCount,
      fileCreatedAt: share.file.createdAt.toISOString(),
      shareCreatedAt: share.createdAt.toISOString(),
    };
  }

  async verifyShare(token: string, password?: string) {
    const share = await this.prisma.share.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    if (share.passwordHash) {
      if (!password) {
        throw new BadRequestException('Password required');
      }
      const valid = await bcrypt.compare(password, share.passwordHash);
      if (!valid) {
        throw new ForbiddenException('Invalid password');
      }
    }

    return {
      fileId: share.fileId,
      fileName: share.file.name,
      storageKey: share.file.storageKey,
      userId: share.file.userId,
      mimeType: share.file.mimeType,
      size: Number(share.file.size),
    };
  }

  async downloadShare(token: string, password?: string) {
    const share = await this.prisma.share.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    if (share.passwordHash) {
      if (!password) {
        throw new BadRequestException('Password required');
      }
      const valid = await bcrypt.compare(password, share.passwordHash);
      if (!valid) {
        throw new ForbiddenException('Invalid password');
      }
    }

    // Increment download count
    await this.prisma.share.update({
      where: { id: share.id },
      data: { downloadCount: share.downloadCount + 1 },
    });

    return {
      fileId: share.fileId,
      fileName: share.file.name,
      storageKey: share.file.storageKey,
      userId: share.file.userId,
      mimeType: share.file.mimeType,
      size: Number(share.file.size),
    };
  }

  async listShares(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: {
        file: { userId },
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => ({
      id: share.id,
      token: share.token,
      fileId: share.fileId,
      fileName: share.file.name,
      fileSize: share.file.size.toString(),
      mimeType: share.file.mimeType,
      hasPassword: !!share.passwordHash,
      expiresAt: share.expiresAt?.toISOString() || null,
      downloadCount: share.downloadCount,
      createdAt: share.createdAt.toISOString(),
    }));
  }

  async deleteShare(userId: string, shareId: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId, file: { userId } },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.prisma.share.delete({ where: { id: shareId } });

    return { success: true };
  }
}
