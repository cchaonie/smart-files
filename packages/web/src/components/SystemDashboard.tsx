import { useState, useEffect, useCallback } from 'react';
import { systemApi, type SystemStats } from '../api/system';
import { ArrowPathIcon, GearIcon } from './icons';

// SVG arc path helper
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = {
    x: cx + r * Math.cos((startAngle * Math.PI) / 180),
    y: cy + r * Math.sin((startAngle * Math.PI) / 180),
  };
  const end = {
    x: cx + r * Math.cos((endAngle * Math.PI) / 180),
    y: cy + r * Math.sin((endAngle * Math.PI) / 180),
  };
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function Gauge({
  value,
  max,
  label,
  unit,
  color,
  size = 120,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 20) / 2;
  const strokeWidth = 10;
  const startAngle = 210;
  const endAngle = 330;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background arc */}
        <path
          d={describeArc(cx, cy, r, startAngle, 360 + endAngle)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-700"
          strokeLinecap="round"
        />
        {/* Value arc */}
        {(value > 0) && (
          <path
            d={describeArc(cx, cy, r, startAngle, startAngle + ((endAngle - startAngle) * Math.min(value, max)) / max)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        )}
        {/* Center label */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-zinc-900 dark:fill-zinc-100"
          fontSize="22"
          fontWeight="bold"
        >
          {value}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-zinc-500 dark:fill-zinc-400"
          fontSize="11"
        >
          {unit}
        </text>
      </svg>
      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{label}</span>
    </div>
  );
}

function StatBar({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{value}{unit} / {max}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function SystemDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await systemApi.getStats();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load system stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 5s
  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">Loading system stats...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center gap-2 mb-2">
          <GearIcon className="w-5 h-5 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">System Monitor</h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{error || 'No data'}</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <GearIcon className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">System Monitor</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">{stats.hostname}</span>
          <button
            onClick={() => void fetchStats()}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Gauges row */}
      <div className="grid grid-cols-3 gap-2 px-3 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Gauge
          value={stats.cpu.usagePercent}
          max={100}
          label="CPU"
          unit="%"
          color={stats.cpu.usagePercent < 50 ? '#3b82f6' : stats.cpu.usagePercent < 80 ? '#eab308' : '#ef4444'}
        />
        <Gauge
          value={stats.memory.usedPercent}
          max={100}
          label="Memory"
          unit="%"
          color={stats.memory.usedPercent < 50 ? '#22c55e' : stats.memory.usedPercent < 80 ? '#eab308' : '#ef4444'}
        />
        <Gauge
          value={stats.disk.usedPercent}
          max={100}
          label="Disk"
          unit="%"
          color={stats.disk.usedPercent < 50 ? '#22c55e' : stats.disk.usedPercent < 80 ? '#eab308' : '#ef4444'}
        />
      </div>

      {/* Detail bars */}
      <div className="px-4 py-3 space-y-3">
        <StatBar
          label="Memory"
          value={stats.memory.usedGb}
          max={stats.memory.totalGb}
          color={stats.memory.usedPercent < 50 ? '#22c55e' : stats.memory.usedPercent < 80 ? '#eab308' : '#ef4444'}
          unit="GB"
        />
        <StatBar
          label="Disk"
          value={stats.disk.usedGb}
          max={stats.disk.totalGb}
          color={stats.disk.usedPercent < 50 ? '#22c55e' : stats.disk.usedPercent < 80 ? '#eab308' : '#ef4444'}
          unit="GB"
        />
        {stats.temperature && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">CPU Temperature</span>
            <span className={`font-medium ${stats.temperature.celsius < 50 ? 'text-green-500' : stats.temperature.celsius < 70 ? 'text-yellow-500' : 'text-red-500'}`}>
              {stats.temperature.celsius}°C
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600 dark:text-zinc-400">CPU Cores</span>
          <span className="text-zinc-800 dark:text-zinc-200 font-medium">{stats.cpu.cores} × {stats.cpu.model.replace(/.*\(R\)|\(TM\)|CPU @.*/g, '').trim()}</span>
        </div>
      </div>
    </div>
  );
}
