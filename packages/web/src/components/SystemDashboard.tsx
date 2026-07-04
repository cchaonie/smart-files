import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@smart-files/shared/src/i18n';
import { systemApi, type SystemStats } from '../api/system';
import { ArrowPathIcon } from './icons';

// SVG arc path helper — draws clockwise from startAngle to endAngle
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = {
    x: cx + r * Math.cos((startAngle * Math.PI) / 180),
    y: cy + r * Math.sin((startAngle * Math.PI) / 180),
  };
  const end = {
    x: cx + r * Math.cos((endAngle * Math.PI) / 180),
    y: cy + r * Math.sin((endAngle * Math.PI) / 180),
  };
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function Gauge({
  value,
  max,
  label,
  unit,
  color,
  size = 140,
  onClick,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
  onClick?: () => void;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 30) / 2;
  const strokeWidth = 12;
  const startAngle = 225;
  const sweep = 270;

  const pct = Math.min(Math.max(value, 0), max);
  const valueEnd = startAngle + sweep * (pct / max);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 ${onClick ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors p-2 -m-2' : ''}`}
      disabled={!onClick}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={describeArc(cx, cy, r, startAngle, startAngle + sweep)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-800"
          strokeLinecap="round"
        />
        {value > 0 && (
          <path
            d={describeArc(cx, cy, r, startAngle, valueEnd)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out drop-shadow-sm"
            style={{ filter: `drop-shadow(0 0 3px ${color}44)` }}
          />
        )}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-zinc-900 dark:fill-zinc-100"
          fontSize="28"
          fontWeight="bold"
        >
          {value}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-zinc-500 dark:fill-zinc-400"
          fontSize="12"
        >
          {unit}
        </text>
      </svg>
      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium -mt-1">{label}</span>
    </button>
  );
}

function StatBar({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-zinc-800 dark:text-zinc-200 font-mono font-medium">{value}{unit} / {max}{unit}</span>
      </div>
      <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function SystemDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await systemApi.getStats();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.systemNoData);
    } finally {
      setLoading(false);
    }
  }, [t.systemNoData]);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8">
        <p className="text-sm text-zinc-400 text-center">{t.systemLoading}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{t.systemMonitor}</h2>
        <p className="text-xs text-zinc-400">{error || t.systemNoData}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.systemMonitor}</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 font-mono">{stats.hostname}</span>
          <button
            onClick={() => void fetchStats()}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={t.systemRefresh}
          >
            <ArrowPathIcon className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Gauges (2×2) */}
      <div className="grid grid-cols-2 gap-4 px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
        <Gauge
          value={stats.cpu.usagePercent}
          max={100}
          label={t.systemCpu}
          unit="%"
          color={stats.cpu.usagePercent < 50 ? '#3b82f6' : stats.cpu.usagePercent < 80 ? '#eab308' : '#ef4444'}
        />
        <Gauge
          value={stats.memory.usedPercent}
          max={100}
          label={t.systemMemory}
          unit="%"
          color={stats.memory.usedPercent < 50 ? '#22c55e' : stats.memory.usedPercent < 80 ? '#eab308' : '#ef4444'}
          onClick={() => navigate('/settings/monitor/memory')}
        />
        <Gauge
          value={stats.disk.usedPercent}
          max={100}
          label={t.systemDisk}
          unit="%"
          color={stats.disk.usedPercent < 50 ? '#22c55e' : stats.disk.usedPercent < 80 ? '#eab308' : '#ef4444'}
          onClick={() => navigate('/settings/monitor/disk')}
        />
        {stats.temperature ? (
          <Gauge
            value={Math.round(stats.temperature.celsius)}
            max={100}
            label={t.systemCpuTemp}
            unit="°C"
            color={stats.temperature.celsius < 50 ? '#22c55e' : stats.temperature.celsius < 70 ? '#eab308' : '#ef4444'}
          />
        ) : (
          <Gauge
            value={0}
            max={100}
            label={t.systemCpuTemp}
            unit="N/A"
            color="#71717a"
          />
        )}
      </div>

      {/* Detail Bars */}
      <div className="px-5 py-4 space-y-3.5">
        <button
          onClick={() => navigate('/settings/monitor/memory')}
          className="w-full text-left group"
        >
          <StatBar
            label={t.systemMemory}
            value={stats.memory.usedGb}
            max={stats.memory.totalGb}
            color={stats.memory.usedPercent < 50 ? '#22c55e' : stats.memory.usedPercent < 80 ? '#eab308' : '#ef4444'}
            unit="GB"
          />
        </button>
        <button
          onClick={() => navigate('/settings/monitor/disk')}
          className="w-full text-left group"
        >
          <StatBar
            label={`${t.systemDisk} (${stats.disk.mount})`}
            value={stats.disk.usedGb}
            max={stats.disk.totalGb}
            color={stats.disk.usedPercent < 50 ? '#22c55e' : stats.disk.usedPercent < 80 ? '#eab308' : '#ef4444'}
            unit="GB"
          />
        </button>
        {stats.temperature && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-zinc-500 dark:text-zinc-400">{t.systemCpuTemp}</span>
            <span className={`font-mono font-medium ${stats.temperature.celsius < 50 ? 'text-green-500' : stats.temperature.celsius < 70 ? 'text-yellow-500' : 'text-red-500'}`}>
              {stats.temperature.celsius}°C
            </span>
          </div>
        )}
        <div className="text-xs text-zinc-400 pt-0.5">
          <span className="text-zinc-500 dark:text-zinc-400">{t.systemCpu}: </span>
          <span className="text-zinc-700 dark:text-zinc-300">
            {stats.cpu.cores} {t.systemCpuCores} · {stats.cpu.model.replace(/.*\(R\)|\(TM\)|CPU @.*/g, '').trim()}
          </span>
        </div>
      </div>
    </div>
  );
}
