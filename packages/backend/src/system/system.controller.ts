import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { readFile } from 'fs/promises';
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
