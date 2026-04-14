"use client";

import { isPreviewableImage } from "@/lib/image-file";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024;

type FolderRow = {
  id: string;
  name: string;
  createdAt: string;
};

type FileRow = {
  id: string;
  name: string;
  size: string;
  mimeType: string | null;
  folderId: string | null;
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

function browseUrl(parentId: string | null): string {
  if (!parentId) return "/api/browse";
  return `/api/browse?parentId=${encodeURIComponent(parentId)}`;
}

function PreviewThumb({ file, onOpen }: { file: FileRow; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);

  if (!isPreviewableImage(file.mimeType, file.name)) {
    return <span className="inline-flex h-12 w-12 items-center justify-center text-zinc-400 dark:text-zinc-500">—</span>;
  }

  if (broken) {
    return (
      <div
        className="h-12 w-12 shrink-0 rounded border border-zinc-200 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700"
        title="Preview unavailable"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:focus:ring-zinc-500"
      title="Preview"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/${file.id}/preview`}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    </button>
  );
}

function MoveFileModal({
  file,
  onClose,
  onMoved,
}: {
  file: FileRow;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [modalPath, setModalPath] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const modalParentId = modalPath.length === 0 ? null : modalPath[modalPath.length - 1].id;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchJson<{ folders: FolderRow[] }>(browseUrl(modalParentId));
      setFolders(data.folders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load folders");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [modalParentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sameLocation =
    (file.folderId === null && modalParentId === null) || file.folderId === modalParentId;

  async function confirmMove() {
    setErr(null);
    try {
      await fetchJson(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: modalParentId }),
      });
      onMoved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Move failed");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Move file"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Move file</h3>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{file.name}</p>
        </div>
        <div className="border-b border-zinc-100 px-4 py-2 text-xs dark:border-zinc-800">
          <span className="text-zinc-500">Into: </span>
          <button type="button" className="text-zinc-900 underline dark:text-zinc-100" onClick={() => setModalPath([])}>
            Root
          </button>
          {modalPath.map((seg, i) => (
            <span key={seg.id}>
              <span className="mx-1 text-zinc-400">/</span>
              <button
                type="button"
                className="text-zinc-900 underline dark:text-zinc-100"
                onClick={() => setModalPath(modalPath.slice(0, i + 1))}
              >
                {seg.name}
              </button>
            </span>
          ))}
        </div>
        <div className="max-h-48 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-2 text-sm text-zinc-500">Loading…</p>
          ) : folders.length === 0 ? (
            <p className="px-2 py-2 text-sm text-zinc-500">No subfolders</p>
          ) : (
            <ul className="space-y-1">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => setModalPath((p) => [...p, { id: f.id, name: f.name }])}
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {err ? <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sameLocation}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void confirmMove()}
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileManager() {
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const currentParentId = path.length === 0 ? null : path[path.length - 1].id;

  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newFolderName, setNewFolderName] = useState("");

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const persistKeyRef = useRef<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileRow | null>(null);

  const loadBrowse = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await fetchJson<{ folders: FolderRow[]; files: FileRow[] }>(browseUrl(currentParentId));
      setFolders(data.folders);
      setFiles(data.files);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentParentId]);

  useEffect(() => {
    void loadBrowse();
  }, [loadBrowse]);

  useEffect(() => {
    if (!previewFile) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewFile(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewFile]);

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await fetchJson("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentParentId }),
      });
      setNewFolderName("");
      await loadBrowse();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create folder");
    }
  }

  async function renameFolder(folder: FolderRow) {
    const name = window.prompt("New folder name", folder.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await fetchJson(`/api/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setPath((p) => p.map((seg) => (seg.id === folder.id ? { ...seg, name: trimmed } : seg)));
      await loadBrowse();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function deleteFolder(folder: FolderRow) {
    if (!confirm(`Delete folder "${folder.name}"? Only empty folders can be removed.`)) return;
    try {
      await fetchJson(`/api/folders/${folder.id}`, { method: "DELETE" });
      setPath((p) => p.filter((seg) => seg.id !== folder.id));
      await loadBrowse();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function runUpload(file: File) {
    setUploadError(null);
    pausedRef.current = false;
    abortRef.current = false;
    setUploadLabel(file.name);
    setUploadProgress(0);

    const totalSize = BigInt(file.size);
    const folderKey = currentParentId ?? "root";
    const persistKey = `smart-files-upload:${folderKey}:${file.name}:${file.size}`;
    persistKeyRef.current = persistKey;
    let uploadId: string;
    let chunkSize = CHUNK_SIZE;
    let totalChunks: number;

    const sessionBody = {
      fileName: file.name,
      totalSize: totalSize.toString(),
      chunkSize: CHUNK_SIZE,
      ...(currentParentId ? { folderId: currentParentId } : {}),
    };

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
            body: JSON.stringify(sessionBody),
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
          body: JSON.stringify(sessionBody),
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
      await loadBrowse();
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
      await loadBrowse();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const empty = !loading && folders.length === 0 && files.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your files</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Folders, chunked uploads with resume, and per-directory storage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </header>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        <button type="button" className="font-medium text-zinc-900 underline dark:text-zinc-100" onClick={() => setPath([])}>
          Root
        </button>
        {path.map((seg, i) => (
          <span key={seg.id} className="flex items-center gap-1">
            <span className="text-zinc-400">/</span>
            <button
              type="button"
              className="font-medium text-zinc-900 underline dark:text-zinc-100"
              onClick={() => setPath(path.slice(0, i + 1))}
            >
              {seg.name}
            </button>
          </span>
        ))}
      </nav>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <form className="flex flex-wrap items-end gap-2" onSubmit={createFolder}>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            New folder
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 dark:border-zinc-600 dark:bg-zinc-900/50">
        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Upload into this folder</span>
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
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Contents</h2>
          <button
            type="button"
            onClick={() => void loadBrowse()}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Refresh
          </button>
        </div>
        {listError ? <p className="text-sm text-red-600">{listError}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : empty ? (
          <p className="text-sm text-zinc-500">This folder is empty.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Preview</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Size</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Added</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr key={`d-${folder.id}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2 align-middle text-zinc-400">—</td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                      <span className="mr-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        Folder
                      </span>
                      {folder.name}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">—</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(folder.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-zinc-900 underline dark:text-zinc-100"
                          onClick={() => setPath((p) => [...p, { id: folder.id, name: folder.name }])}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="text-zinc-700 underline dark:text-zinc-300"
                          onClick={() => void renameFolder(folder)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-red-600 underline dark:text-red-400"
                          onClick={() => void deleteFolder(folder)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2 align-middle">
                      <PreviewThumb file={f} onOpen={() => setPreviewFile(f)} />
                    </td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{f.name}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{formatBytes(BigInt(f.size))}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {isPreviewableImage(f.mimeType, f.name) ? (
                          <button
                            type="button"
                            className="text-zinc-900 underline dark:text-zinc-100"
                            onClick={() => setPreviewFile(f)}
                          >
                            Preview
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-zinc-700 underline dark:text-zinc-300"
                          onClick={() => setMoveTarget(f)}
                        >
                          Move
                        </button>
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

      {previewFile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setPreviewFile(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-zinc-800/90 px-3 py-1 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
            onClick={() => setPreviewFile(null)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/${previewFile.id}/preview`}
            alt={previewFile.name}
            className="max-h-[90vh] max-w-full object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {moveTarget ? (
        <MoveFileModal file={moveTarget} onClose={() => setMoveTarget(null)} onMoved={() => void loadBrowse()} />
      ) : null}
    </div>
  );
}
