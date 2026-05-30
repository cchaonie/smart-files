import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useI18n, tFormat } from '@smart-files/shared/src/i18n'
import { sharesApi, ShareInfo } from '../api/shares';
import { formatBytes } from '@smart-files/shared/src/utils';

export function SharePage() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState(searchParams.get('password') || '');
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadInfo();
  }, [token]);

  async function loadInfo() {
    setLoading(true);
    setError(null);
    try {
      const data = await sharesApi.getShareInfo(token!);
      setInfo(data);
      if (!data.hasPassword) setVerified(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shareNotFound);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      await sharesApi.verifyShare(token!, password || undefined);
      setVerified(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.verificationFailed);
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">{t.loading}</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t.linkUnavailable}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {info?.fileName}
          </h1>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {t.passwordProtected}
          </p>

          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
            placeholder={t.enterPassword}
            className="mb-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
          />

          {error ? (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={verifying || !password.trim()}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void verify()}
          >
            {verifying ? t.verifying : t.verify}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="mb-1 truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {info?.fileName}
        </h1>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {info?.fileSize ? formatBytes(BigInt(info.fileSize)) : ''}
          {info?.expiresAt ? ` · ${tFormat(t.expiresPrefix, { date: new Date(info.expiresAt).toLocaleDateString() })}` : ''}
        </p>

        <a
          href={sharesApi.shareDownloadUrl(token!, password || undefined)}
          className="block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          download={info?.fileName}
        >
          {t.downloadFile}
        </a>

        <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {t.appName}
        </p>
      </div>
    </div>
  );
}