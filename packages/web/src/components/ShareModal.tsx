import { useEffect, useState } from 'react'
import type { FileItem } from '../types'
import { sharesApi } from '../api/shares'
import { useI18n } from '@smart-files/shared/src/i18n'

function ShareModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [shareResult, setShareResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shareUrl = shareResult
    ? `${window.location.origin}/share/${shareResult}`
    : '';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function createShare() {
    setLoading(true);
    setError(null);
    try {
      const expiresMap: Record<string, number | undefined> = {
        never: undefined,
        '1h': 1,
        '24h': 24,
        '7d': 168,
        '30d': 720,
      };
      const result = await sharesApi.create(file.id, {
        password: password.trim() || undefined,
        expiresInHours: expiresMap[expiry],
      });
      setShareResult(result.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create share');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t.shareFile}
        </h3>
        <p className="mb-4 truncate text-sm text-zinc-600 dark:text-zinc-400">
          {file.name}
        </p>

        {!shareResult ? (
          <>
            <div className="mb-4">
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                Password protection (optional)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.noPassword}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                Expires in
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="never">{t.never}</option>
                <option value="1h">{t.oneHour}</option>
                <option value="24h">{t.twentyFourHours}</option>
                <option value="7d">{t.sevenDays}</option>
                <option value="30d">{t.thirtyDays}</option>
              </select>
            </div>

            {error ? (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                onClick={() => void createShare()}
              >
                {loading ? t.creatingLink : t.createLink}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
              <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
                Share link:
              </p>
              <p className="break-all text-sm font-mono text-zinc-900 dark:text-zinc-50">
                {shareUrl}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                onClick={onClose}
              >
                {t.close}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ShareModal
