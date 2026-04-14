import { createReadStream } from "fs";
import { Readable } from "stream";

export function parseRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const r = rangeHeader.trim();
  if (!r.toLowerCase().startsWith("bytes=")) return null;
  const spec = r.slice(6).split(",")[0]?.trim() ?? "";
  if (spec.startsWith("-")) {
    const suffix = parseInt(spec.slice(1), 10);
    if (Number.isNaN(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }
  const dash = spec.indexOf("-");
  if (dash < 0) return null;
  const startStr = spec.slice(0, dash);
  const endStr = spec.slice(dash + 1);
  const start = parseInt(startStr, 10);
  if (Number.isNaN(start) || start < 0) return null;
  const end = endStr === "" ? size - 1 : parseInt(endStr, 10);
  if (Number.isNaN(end)) return null;
  if (start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function contentDisposition(fileName: string, mode: "attachment" | "inline"): string {
  const encoded = encodeURIComponent(fileName);
  return `${mode}; filename*=UTF-8''${encoded}`;
}

export function streamUserFileResponse(
  req: Request,
  fullPath: string,
  size: number,
  contentType: string,
  fileName: string,
  disposition: "attachment" | "inline",
  cacheControl?: string,
): Response {
  const disp = contentDisposition(fileName, disposition);
  const headers: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Content-Disposition": disp,
  };
  if (cacheControl) headers["Cache-Control"] = cacheControl;

  const range = req.headers.get("range");
  if (range) {
    const parsed = parseRange(range, size);
    if (!parsed) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const { start, end } = parsed;
    const stream = Readable.toWeb(createReadStream(fullPath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      ...headers,
      "Content-Length": String(size),
    },
  });
}
