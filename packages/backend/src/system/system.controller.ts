import { Controller, Get, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { readFile, readdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@ApiTags('System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system')
export class SystemController {
  private lastCpuTimes: { user: number; nice: number; system: number; idle: number; iowait: number; irq: number; softirq: number; steal: number } | null = null;
  private lastCpuSampleTime = 0;

  @Get('stats')
  @ApiOperation({ summary: 'Get system stats (CPU, memory, disk, temperature)' })
  async getStats() {
    const [cpu, mem, disk, temp] = await Promise.all([
      this.getCpuUsage(),
      this.getMemory(),
      this.getDisk(),
      this.getTemperature(),
    ]);

    return {
      cpu,
      memory: mem,
      disk,
      temperature: temp,
      hostname: require('os').hostname(),
    };
  }

  @Get('stats/memory')
  @ApiOperation({ summary: 'Get detailed memory stats' })
  async getMemoryDetail() {
    const data = await readFile('/proc/meminfo', 'utf-8');
    const getValue = (key: string): number => {
      const match = data.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match ? parseInt(match[1], 10) : 0;
    };

    const memTotal = getValue('MemTotal');
    const memFree = getValue('MemFree');
    const memAvailable = getValue('MemAvailable');
    const buffers = getValue('Buffers');
    const cached = getValue('Cached');
    const sReclaimable = getValue('SReclaimable');
    const swapTotal = getValue('SwapTotal');
    const swapFree = getValue('SwapFree');
    const shmem = getValue('Shmem');

    const toMb = (kb: number) => Math.round(kb / 1024);
    const toGb = (kb: number) => Math.round(kb / 1024 / 1024 * 100) / 100;

    return {
      total: { kb: memTotal, mb: toMb(memTotal), gb: toGb(memTotal) },
      used: { kb: memTotal - memAvailable, mb: toMb(memTotal - memAvailable), gb: toGb(memTotal - memAvailable) },
      available: { kb: memAvailable, mb: toMb(memAvailable), gb: toGb(memAvailable) },
      free: { kb: memFree, mb: toMb(memFree), gb: toGb(memFree) },
      buffers: { kb: buffers, mb: toMb(buffers), gb: toGb(buffers) },
      cached: { kb: cached + sReclaimable, mb: toMb(cached + sReclaimable), gb: toGb(cached + sReclaimable) },
      shared: { kb: shmem, mb: toMb(shmem), gb: toGb(shmem) },
      swap: {
        total: { kb: swapTotal, mb: toMb(swapTotal), gb: toGb(swapTotal) },
        used: { kb: swapTotal - swapFree, mb: toMb(swapTotal - swapFree), gb: toGb(swapTotal - swapFree) },
        free: { kb: swapFree, mb: toMb(swapFree), gb: toGb(swapFree) },
      },
      usedPercent: memTotal > 0 ? Math.round(((memTotal - memAvailable) / memTotal) * 100) : 0,
    };
  }

  @Get('stats/disk')
  @ApiOperation({ summary: 'Get detailed disk stats (all mounts)' })
  async getDiskDetail() {
    const { stdout } = await execAsync('df -B1 2>&1 | tail -n +2');
    const lines = stdout.trim().split('\n').filter(Boolean);

    const mounts = lines.map(line => {
      const parts = line.split(/\s+/);
      const total = parseInt(parts[1], 10);
      const used = parseInt(parts[2], 10);
      const free = parseInt(parts[3], 10);
      const pct = parseInt((parts[4] || '0').replace('%', ''), 10) || 0;
      return {
        filesystem: parts[0],
        mount: parts[5] || '/',
        total: { kb: Math.round(total / 1024), mb: Math.round(total / 1024 / 1024), gb: Math.round(total / 1024 / 1024 / 1024 * 10) / 10 },
        used: { kb: Math.round(used / 1024), mb: Math.round(used / 1024 / 1024), gb: Math.round(used / 1024 / 1024 / 1024 * 10) / 10 },
        free: { kb: Math.round(free / 1024), mb: Math.round(free / 1024 / 1024), gb: Math.round(free / 1024 / 1024 / 1024 * 10) / 10 },
        usedPercent: pct,
      };
    });

    // Get inode usage for the root mount
    let inodeInfo = null;
    try {
      const { stdout: inodeStdout } = await execAsync('df -i / 2>&1 | tail -1');
      const inodeParts = inodeStdout.trim().split(/\s+/);
      if (inodeParts.length >= 5) {
        inodeInfo = {
          total: parseInt(inodeParts[1], 10) || 0,
          used: parseInt(inodeParts[2], 10) || 0,
          free: parseInt(inodeParts[3], 10) || 0,
          usedPercent: parseInt((inodeParts[4] || '0').replace('%', ''), 10) || 0,
        };
      }
    } catch { /* ignore */ }

    return { mounts, inode: inodeInfo };
  }

  @Get('stats/disk/du')
  @ApiOperation({ summary: 'Get directory sizes for a given path (du)' })
  async getDirectorySizes(@Query('path') path: string) {
    if (!path || !path.startsWith('/')) {
      throw new BadRequestException('Path must be absolute');
    }

    // Security: reject paths with .. or symlink traversal
    const resolved = require('path').resolve(path);
    if (!resolved.startsWith('/')) {
      throw new BadRequestException('Invalid path');
    }

    const { stdout } = await execAsync(`timeout 8 du -ab --max-depth=1 "${resolved}" 2>/dev/null | sort -rn | head -200`);
    const lines = stdout.trim().split('\n').filter(Boolean);

    const items: { name: string; path: string; size: number; isDir: boolean }[] = [];
    let totalSize = 0;

    for (const line of lines) {
      const tabIndex = line.indexOf('\t');
      if (tabIndex === -1) continue;
      const sizeStr = line.substring(0, tabIndex);
      const fullPath = line.substring(tabIndex + 1);
      const size = parseInt(sizeStr, 10);
      if (isNaN(size)) continue;

      // First line is the directory itself (path == resolved)
      if (fullPath === resolved || fullPath === resolved + '/') {
        totalSize = size;
        continue;
      }

      const name = fullPath.replace(resolved, '').replace(/^\//, '');
      if (!name) continue;

      // du with -a lists files too; check if it's a directory by trying to list children
      let isDir = true;
      try {
        const { stdout: lsOut } = await execAsync(`test -d "${fullPath}" && echo dir`);
        isDir = lsOut.trim() === 'dir';
      } catch { isDir = false; }

      items.push({ name, path: fullPath, size, isDir });
    }

    // Also try to count items in the directory for display
    let itemCount = 0;
    try {
      const { stdout: countOut } = await execAsync(`ls -A "${resolved}" 2>/dev/null | wc -l`);
      itemCount = parseInt(countOut.trim(), 10) || 0;
    } catch { /* ignore */ }

    return { path: resolved, totalSize, itemCount, items };
  }

  private async getCpuUsage(): Promise<{ usagePercent: number; cores: number; model: string }> {
    const data = await readFile('/proc/stat', 'utf-8');
    const lines = data.split('\n');

    // Get CPU model from /proc/cpuinfo
    const cpuinfo = await readFile('/proc/cpuinfo', 'utf-8');
    const modelMatch = cpuinfo.match(/model name\s+:\s+(.+)/);
    const cores = (cpuinfo.match(/^processor\s+:/gm) || []).length;

    // Parse first line (aggregate CPU)
    const parts = lines[0].split(/\s+/);
    const user = parseInt(parts[1], 10);
    const nice = parseInt(parts[2], 10);
    const system = parseInt(parts[3], 10);
    const idle = parseInt(parts[4], 10);
    const iowait = parseInt(parts[5], 10) || 0;
    const irq = parseInt(parts[6], 10) || 0;
    const softirq = parseInt(parts[7], 10) || 0;
    const steal = parseInt(parts[8], 10) || 0;

    const now = Date.now();
    let usagePercent = 0;

    if (this.lastCpuTimes) {
      const prevIdle = this.lastCpuTimes.idle + this.lastCpuTimes.iowait;
      const curIdle = idle + iowait;

      const prevTotal = this.lastCpuTimes.user + this.lastCpuTimes.nice + this.lastCpuTimes.system +
        this.lastCpuTimes.idle + this.lastCpuTimes.iowait + this.lastCpuTimes.irq +
        this.lastCpuTimes.softirq + this.lastCpuTimes.steal;
      const curTotal = user + nice + system + idle + iowait + irq + softirq + steal;

      const totalDiff = curTotal - prevTotal;
      const idleDiff = curIdle - prevIdle;

      usagePercent = totalDiff > 0 ? Math.round(((totalDiff - idleDiff) / totalDiff) * 100) : 0;
    }

    this.lastCpuTimes = { user, nice, system, idle, iowait, irq, softirq, steal };
    this.lastCpuSampleTime = now;

    return {
      usagePercent,
      cores,
      model: modelMatch?.[1]?.trim() || 'Unknown',
    };
  }

  private async getMemory(): Promise<{ totalGb: number; usedGb: number; usedPercent: number }> {
    const data = await readFile('/proc/meminfo', 'utf-8');

    const getValue = (key: string): number => {
      const match = data.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match ? parseInt(match[1], 10) : 0;
    };

    const total = getValue('MemTotal');
    const available = getValue('MemAvailable');
    const used = total - available;

    return {
      totalGb: Math.round(total / 1024 / 1024 * 10) / 10,
      usedGb: Math.round(used / 1024 / 1024 * 10) / 10,
      usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
    };
  }

  private async getDisk(): Promise<{ totalGb: number; usedGb: number; usedPercent: number; mount: string }> {
    const { stdout } = await execAsync('df -B1 / 2>&1 | tail -1');
    const parts = stdout.trim().split(/\s+/);

    const total = parseInt(parts[1], 10);
    const used = parseInt(parts[2], 10);
    const percentStr = parts[4];

    return {
      totalGb: Math.round(total / 1024 / 1024 / 1024 * 10) / 10,
      usedGb: Math.round(used / 1024 / 1024 / 1024 * 10) / 10,
      usedPercent: parseInt(percentStr.replace('%', ''), 10) || 0,
      mount: parts[5] || '/',
    };
  }

  private async getTemperature(): Promise<{ celsius: number; zones: { name: string; temp: number }[] } | null> {
    try {
      const { readdir } = await import('fs/promises');
      const thermalDir = '/sys/class/thermal';
      const entries = await readdir(thermalDir);
      const zones: { name: string; temp: number }[] = [];

      let maxTemp = 0;
      for (const entry of entries) {
        if (!entry.startsWith('thermal_zone')) continue;
        try {
          const type = (await readFile(`${thermalDir}/${entry}/type`, 'utf-8')).trim();
          const rawTemp = (await readFile(`${thermalDir}/${entry}/temp`, 'utf-8')).trim();
          const celsius = Math.round(parseInt(rawTemp, 10) / 10) / 100;
          zones.push({ name: type, temp: celsius });
          if (celsius > maxTemp) maxTemp = celsius;
        } catch { /* skip unreadable zones */ }
      }

      return zones.length > 0
        ? { celsius: maxTemp, zones }
        : null;
    } catch {
      return null;
    }
  }
}
