import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@smart-files/shared/src/i18n';
import { systemApi, type MemoryDetail } from '../api/system';
import { ChevronLeftIcon } from '../components/icons';

function MemoryBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-24 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-28 text-right text-xs font-mono text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">
        {value.toFixed(1)} GB
      </span>
    </div>
  );
}

function MemoryCategory({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

export function MemoryDetailPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState<MemoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const d = await systemApi.getMemoryDetail();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/settings/monitor')}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t.systemMemoryDetail}</h1>
      </div>

      {loading && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8">
          <p className="text-sm text-zinc-400 text-center">{t.systemLoading}</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Overview Card */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.systemMemory}</span>
              <span className="text-xs font-mono text-zinc-400">{data.usedPercent}% used</span>
            </div>
            <div className="h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${data.usedPercent}%`,
                  backgroundColor: data.usedPercent < 50 ? '#22c55e' : data.usedPercent < 80 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-zinc-500">
              <span>{data.used.gb.toFixed(1)} GB {t.systemMemUsed}</span>
              <span>{data.total.gb.toFixed(1)} GB {t.systemMemTotal}</span>
            </div>
          </div>

          {/* Memory Breakdown */}
          <MemoryCategory title={t.systemMemUsed}>
            <MemoryBar label={t.systemMemAvailable} value={data.available.gb} total={data.total.gb} color="#22c55e" />
            <MemoryBar label={t.systemMemBuffers} value={data.buffers.gb} total={data.total.gb} color="#3b82f6" />
            <MemoryBar label={t.systemMemCached} value={data.cached.gb} total={data.total.gb} color="#8b5cf6" />
            <MemoryBar label={t.systemMemShared} value={data.shared.gb} total={data.total.gb} color="#f59e0b" />
            <MemoryBar label={t.systemMemFree} value={data.free.gb} total={data.total.gb} color="#10b981" />
          </MemoryCategory>

          {/* Swap */}
          <MemoryCategory title="Swap">
            <MemoryBar label={t.systemMemSwapUsed} value={data.swap.used.gb} total={data.swap.total.gb || 1} color="#ef4444" />
            <MemoryBar label={t.systemMemSwapFree} value={data.swap.free.gb} total={data.swap.total.gb || 1} color="#10b981" />
          </MemoryCategory>
        </div>
      )}
    </div>
  );
}
