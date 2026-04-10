"use client";

import { signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024;

type FileRow = {
  id: string;
  name: string;
  size: string;
  mimeType: string | null;
  createdAt: string;
};

function formatBytes(n: bigint): string {
  if (n < 1024n) return `${n} B`;
  const kb = 1024n;
  const mb = kb * kb;
  const gb = mb * kb;
  if (n < mb) return `${(Number(n) / Number(kb)).toFixed(1)} KB`;
  if (n < gb) return `${(Number(n) / Number(mb)).toFixed(1)} MB`;
  return `${(Number(n) / Number(gb)).toFixed(2)} GB`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data as T;
}

export function FileManager() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const persistKeyRef = useRef<string | null>(null);

  const loadFiles = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await fetchJson<{ files: FileRow[] }>("/api/files");
      setFiles(data.files);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function runUpload(file: File) {
    setUploadError(null);
    pausedRef.current = false;
    abortRef.current = false;
    setUploadLabel(file.name);
    setUploadProgress(0);

    const totalSize = BigInt(file.size);
    const persistKey = `smart-files-upload:${file.name}:${file.size}`;
    persistKeyRef.current = persistKey;
    let uploadId: string;
    let chunkSize = CHUNK_SIZE;
    let totalChunks: number;

    try {
      const existingId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(persistKey) : null;
      if (existingId) {
        try {
          const existing = await fetchJson<{
            receivedIndexes: number[];
            totalChunks: number;
            chunkSize: number;
          }>(`/api/upload/session/${existingId}`);
          uploadId = existingId;
          chunkSize = existing.chunkSize;
          totalChunks = existing.totalChunks;
        } catch {
          sessionStorage.removeItem(persistKey);
          const created = await fetchJson<{
            uploadId: string;
            chunkSize: number;
            totalChunks: number;
          }>("/api/upload/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              totalSize: totalSize.toString(),
              chunkSize: CHUNK_SIZE,
            }),
          });
          uploadId = created.uploadId;
          chunkSize = created.chunkSize;
          totalChunks = created.totalChunks;
          sessionStorage.setItem(persistKey, uploadId);
        }
      } else {
        const created = await fetchJson<{
          uploadId: string;
          chunkSize: number;
          totalChunks: number;
        }>("/api/upload/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            totalSize: totalSize.toString(),
            chunkSize: CHUNK_SIZE,
          }),
        });
        uploadId = created.uploadId;
        chunkSize = created.chunkSize;
        totalChunks = created.totalChunks;
        sessionStorage.setItem(persistKey, uploadId);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Session failed");
      setUploadProgress(null);
      setUploadLabel(null);
      return;
    }

    const uploadAllChunks = async () => {
      for (;;) {
        if (abortRef.current) throw new Error("Aborted");

        while (pausedRef.current) {
          await new Promise((r) => setTimeout(r, 200));
          if (abortRef.current) throw new Error("Aborted");
        }

        const status = await fetchJson<{
          receivedIndexes: number[];
          totalChunks: number;
        }>(`/api/upload/session/${uploadId}`);

        const received = new Set(status.receivedIndexes);
        const missing: number[] = [];
        for (let i = 0; i < status.totalChunks; i++) {
          if (!received.has(i)) missing.push(i);
        }

        if (missing.length === 0) break;

        let doneCount = received.size;

        for (const index of missing) {
          while (pausedRef.current) {
            await new Promise((r) => setTimeout(r, 200));
            if (abortRef.current) throw new Error("Aborted");
          }

          const start = index * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const blob = file.slice(start, end);
          const buf = await blob.arrayBuffer();

          await fetch(`/api/upload/session/${uploadId}/chunk?index=${index}`, {
            method: "PUT",
            credentials: "include",
            body: buf,
          }).then(async (res) => {
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(j.error ?? `Chunk ${index} failed`);
            }
          });

          doneCount += 1;
          setUploadProgress(Math.round((doneCount / totalChunks) * 100));
        }
      }
    };

    try {
      await uploadAllChunks();

      await fetchJson<{ file: { id: string } }>(`/api/upload/session/${uploadId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: file.type || null }),
      });

      sessionStorage.removeItem(persistKey);
      persistKeyRef.current = null;
      setUploadProgress(100);
      await loadFiles();
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      }
    } finally {
      persistKeyRef.current = null;
      setUploadProgress(null);
      setUploadLabel(null);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void runUpload(f);
  }

  async function removeFile(id: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await fetchJson(`/api/files/${id}`, { method: "DELETE" });
      await loadFiles();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your files</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Chunked uploads with resume (pause, then choose the same file to continue).</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </header>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 dark:border-zinc-600 dark:bg-zinc-900/50">
        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Drop or select a file to upload</span>
          <span className="text-xs text-zinc-500">Chunks: {CHUNK_SIZE / (1024 * 1024)} MB · Pause/resume supported</span>
          <input type="file" className="sr-only" onChange={onFileChange} />
          <span className="mt-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            Choose file
          </span>
        </label>
        {uploadLabel ? (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span className="truncate pr-2">{uploadLabel}</span>
              {uploadProgress !== null ? <span>{uploadProgress}%</span> : null}
            </div>
            {uploadProgress !== null ? (
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full bg-zinc-800 transition-all dark:bg-zinc-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                onClick={() => {
                  pausedRef.current = !pausedRef.current;
                }}
              >
                Pause / resume
              </button>
              <button
                type="button"
                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
                onClick={() => {
                  abortRef.current = true;
                  pausedRef.current = false;
                  const k = persistKeyRef.current;
                  if (k) sessionStorage.removeItem(k);
                  persistKeyRef.current = null;
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {uploadError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{uploadError}</p> : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">All files</h2>
          <button
            type="button"
            onClick={() => void loadFiles()}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Refresh
          </button>
        </div>
        {listError ? <p className="text-sm text-red-600">{listError}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-zinc-500">No files yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Size</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Added</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{f.name}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{formatBytes(BigInt(f.size))}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/files/${f.id}/download`}
                          className="text-zinc-900 underline dark:text-zinc-100"
                          download={f.name}
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          className="text-red-600 underline dark:text-red-400"
                          onClick={() => void removeFile(f.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
