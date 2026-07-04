import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AdminService {
  private uploadRoot: string;

  constructor(private prisma: PrismaService) {
    this.uploadRoot = process.env.UPLOAD_ROOT || './data/storage';
  }

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

  /**
   * Clean up stale/orphaned upload tmp directories.
   * - failed/cancelled sessions → delete
   * - completed sessions → tmp already cleaned, but orphaned dirs still found → delete
   * - pending sessions older than 24h → delete
   * - active pending sessions → skip
   * - orphaned tmp dirs (no DB record) → delete
   */
  async cleanupUploads(dryRun = false) {
    const tmpRoot = path.join(this.uploadRoot, 'tmp');
    const results: {
      deleted: string[],
      skipped: string[],
      totalFreedBytes: number,
      failedSessions: number,
      orphanedDirs: number,
    } = {
      deleted: [],
      skipped: [],
      totalFreedBytes: 0,
      failedSessions: 0,
      orphanedDirs: 0,
    };

    let tmpDirsExist = true;
    try {
      await fs.access(tmpRoot);
    } catch {
      tmpDirsExist = false;
    }

    if (!tmpDirsExist) {
      return { ...results, message: 'No tmp directory found' };
    }

    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

    // Read all user-level tmp directories
    const userDirs = await fs.readdir(tmpRoot);

    for (const userId of userDirs) {
      const userTmpPath = path.join(tmpRoot, userId);
      const stat = await fs.stat(userTmpPath).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      const sessionDirs = await fs.readdir(userTmpPath);

      for (const sessionId of sessionDirs) {
        const sessionTmpPath = path.join(userTmpPath, sessionId);
        const sessionStat = await fs.stat(sessionTmpPath).catch(() => null);
        if (!sessionStat || !sessionStat.isDirectory()) continue;

        // Check if this is a valid session dir or an older layout (userId/sessionId)
        // Also support the newer layout: userId/sessionId/chunk-files
        const session = await this.prisma.uploadSession.findUnique({
          where: { id: sessionId },
        }).catch(() => null);

        let shouldDelete = false;
        let reason = '';

        if (!session) {
          // Orphaned — no DB record
          shouldDelete = true;
          reason = 'orphaned (no session record)';
          results.orphanedDirs++;
        } else if (session.status === 'failed') {
          shouldDelete = true;
          reason = `failed session`;
          results.failedSessions++;
        } else if (session.status === 'pending' && session.createdAt < staleThreshold) {
          shouldDelete = true;
          reason = `stale pending (>24h)`;
        } else if (session.status === 'completed') {
          // Completed sessions should already have been cleaned, but check
          shouldDelete = true;
          reason = `completed (leftover tmp)`;
        } else if (session.status === 'merging') {
          // Merging sessions older than 24h are stuck
          if (session.createdAt < staleThreshold) {
            shouldDelete = true;
            reason = `stuck merging (>24h)`;
          }
        }

        if (shouldDelete) {
          // Calculate size
          let dirSize = 0;
          try {
            dirSize = await this.getDirSize(sessionTmpPath);
          } catch {}

          if (!dryRun) {
            await fs.rm(sessionTmpPath, { recursive: true, force: true }).catch(() => {});
          }

          results.deleted.push(`${userId}/${sessionId} (${reason}, ${this.formatBytes(dirSize)})`);
          results.totalFreedBytes += dirSize;

          // If failed session, also null out the session status (keep record for history)
          if (!dryRun && session && session.status !== 'completed') {
            await this.prisma.uploadSession.update({
              where: { id: sessionId },
              data: { status: 'cleaned' },
            }).catch(() => {});
          }
        } else {
          results.skipped.push(`${userId}/${sessionId} (active ${session?.status || 'unknown'})`);
        }
      }
    }

    return {
      ...results,
      dryRun,
      message: dryRun
        ? `Dry run: would delete ${results.deleted.length} dirs (${this.formatBytes(results.totalFreedBytes)})`
        : `Cleaned ${results.deleted.length} dirs, freed ${this.formatBytes(results.totalFreedBytes)}`,
    };
  }

  private async getDirSize(dirPath: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await this.getDirSize(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath).catch(() => null);
        if (stat) total += stat.size;
      }
    }
    return total;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }
}
