import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@smart-files/shared/src/i18n';
import type { I18nStrings } from '@smart-files/shared/src/i18n/types';
import { systemApi, type DiskDetail, type DiskDuResult } from '../api/system';
import { ChevronLeftIcon, FolderIcon, FolderOpenIcon, ImageIcon } from '../components/icons';

function formatSize(bytes: number): string {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + ' TB';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}

// Get dir param from current URL
function getDirFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('dir') || null;
}

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split('/').filter(Boolean);
  const crumbs = [{ label: '/', path: '/' }];
  let acc = '';
  for (const p of parts) {
    acc += '/' + p;
    crumbs.push({ label: p, path: acc });
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 overflow-x-auto pb-2 scrollbar-none">
      {crumbs.map((c, i) => (
        <span key={c.path} className="flex items-center gap-1 shrink-0">
          {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">/</span>}
          <button
            onClick={() => onNavigate(c.path)}
            className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors truncate max-w-[120px]"
          >
            {c.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function SizeBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-1 max-w-[120px]">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          backgroundColor: pct < 50 ? '#22c55e' : pct < 80 ? '#eab308' : '#ef4444',
        }}
      />
    </div>
  );
}

// ── Mount List Mode ──
function MountListView({
  data,
  t,
  onEnterDir,
}: {
  data: DiskDetail;
  t: I18nStrings;
  onEnterDir: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      {data.mounts
        .filter(m => m.total.gb > 0)
        .map((mount) => (
          <button
            key={mount.mount}
            onClick={() => onEnterDir(mount.mount)}
            className="w-full text-left border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpenIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {mount.mount}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono truncate hidden sm:inline">
                    {mount.filesystem}
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-500 shrink-0 ml-2">{mount.usedPercent}%</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5 sm:hidden truncate">{mount.filesystem}</p>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${mount.usedPercent}%`,
                    backgroundColor: mount.usedPercent < 50 ? '#22c55e' : mount.usedPercent < 80 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-zinc-400">{t.systemDiskTotal}</p>
                  <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                    {mount.total.gb.toFixed(1)} GB
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400">{t.systemDiskUsed}</p>
                  <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                    {mount.used.gb.toFixed(1)} GB
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400">{t.systemDiskFree}</p>
                  <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                    {mount.free.gb.toFixed(1)} GB
                  </p>
                </div>
              </div>
            </div>
          </button>
        ))}

      {/* Inode info */}
      {data.inode && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            {t.systemDiskInodes} (/)
          </h3>
          <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${data.inode.usedPercent}%`,
                backgroundColor: data.inode.usedPercent < 50 ? '#22c55e' : data.inode.usedPercent < 80 ? '#eab308' : '#ef4444',
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] text-zinc-400">{t.systemDiskTotal}</p>
              <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">{data.inode.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">{t.systemDiskUsed}</p>
              <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">{data.inode.used.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">{t.systemDiskFree}</p>
              <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">{data.inode.free.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Directory Browser Mode ──
function DirectoryBrowserView({
  duData,
  onNavigate,
}: {
  duData: DiskDuResult;
  onNavigate: (path: string) => void;
}) {
  const maxSize = duData.items.length > 0 ? duData.items[0].size : 1;

  return (
    <div className="space-y-2">
      {/* Path summary */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpenIcon className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">{duData.path}</span>
          </div>
          <span className="text-xs text-zinc-500 shrink-0 ml-2">
            {formatSize(duData.totalSize)} · {duData.itemCount} items
          </span>
        </div>
      </div>

      {/* Items */}
      {duData.items.length === 0 && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-8">
          <p className="text-sm text-zinc-400 text-center">Empty directory</p>
        </div>
      )}

      <div className="space-y-1">
        {duData.items.map((item) => {
          const pct = maxSize > 0 ? (item.size / maxSize) * 100 : 0;
          return (
            <button
              key={item.path}
              onClick={() => item.isDir && onNavigate(item.path)}
              disabled={!item.isDir}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${
                item.isDir
                  ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer'
                  : 'cursor-default'
              } transition-colors`}
            >
              {/* Icon */}
              <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                {item.isDir ? (
                  <FolderIcon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                )}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {item.name}
                  </span>
                  <span className="text-xs font-mono text-zinc-500 shrink-0 tabular-nums">
                    {formatSize(item.size)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <SizeBar used={item.size} total={maxSize} />
                  <span className="text-[10px] text-zinc-400 w-8 text-right tabular-nums">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──
export function DiskDetailPage() {
  const { t } = useI18n();
  const location = useLocation();

  // Read dir from URL (on mount and on popstate via location changes)
  const dirParam = getDirFromURL();
  const isDirView = dirParam !== null && dirParam !== '';
  const currentPath = isDirView ? dirParam : '/';

  // Data
  const [mountData, setMountData] = useState<DiskDetail | null>(null);
  const [duData, setDuData] = useState<DiskDuResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch mount data
  const fetchMounts = useCallback(async () => {
    try {
      const d = await systemApi.getDiskDetail();
      setMountData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch directory sizes
  const fetchDu = useCallback(async (path: string) => {
    setLoading(true);
    setDuData(null);
    try {
      const d = await systemApi.getDirectorySizes(path);
      setDuData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load directory');
      setDuData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when URL param changes (includes mount, navigation, and popstate)
  useEffect(() => {
    const dir = getDirFromURL();
    if (!dir) {
      void fetchMounts();
    } else {
      void fetchDu(dir);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Auto-refresh mount list
  useEffect(() => {
    if (isDirView) return;
    const interval = setInterval(() => void fetchMounts(), 10000);
    return () => clearInterval(interval);
  }, [isDirView, fetchMounts]);

  // Enter a directory — use History API pushState to keep React Router layer clean
  const enterDir = useCallback((path: string) => {
    const base = '/settings/monitor/disk';
    const newURL = `${base}?dir=${encodeURIComponent(path)}`;
    window.history.pushState({ dir: path }, '', newURL);

    // Manually dispatch to same URL pattern as location change
    // (useLocation won't fire for pushState, so we fetch directly)
    void fetchDu(path);
  }, [fetchDu]);

  // Navigate breadcrumb
  const navigateTo = useCallback((path: string) => {
    if (path === '/') {
      // Go back to mount list — replaceState to keep clean history
      const base = '/settings/monitor/disk';
      window.history.pushState({ dir: null }, '', base);
      void fetchMounts();
    } else {
      enterDir(path);
    }
  }, [enterDir, fetchMounts]);

  // Back button on the page header
  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  // Sync loading state when mount data is already cached
  const [initialLoad, setInitialLoad] = useState(true);
  useEffect(() => {
    if (mountData || duData || error) {
      setInitialLoad(false);
    }
  }, [mountData, duData, error]);

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={goBack}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {isDirView ? currentPath : t.systemDiskDetail}
        </h1>
      </div>

      {/* Breadcrumb (dir mode) */}
      {isDirView && (
        <div className="mb-4">
          <Breadcrumb path={currentPath} onNavigate={navigateTo} />
        </div>
      )}

      {/* Loading */}
      {loading && initialLoad && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8">
          <p className="text-sm text-zinc-400 text-center">{t.systemLoading}</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Mount List */}
      {!initialLoad && !isDirView && mountData && (
        <MountListView data={mountData} t={t} onEnterDir={enterDir} />
      )}

      {/* Directory Browser */}
      {!initialLoad && isDirView && duData && (
        <DirectoryBrowserView duData={duData} onNavigate={enterDir} />
      )}
    </div>
  );
}
