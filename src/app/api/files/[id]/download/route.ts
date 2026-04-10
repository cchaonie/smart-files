import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storedFilePath } from "@/lib/storage-paths";
import { getUploadRoot } from "@/lib/upload-config";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";

function parseRange(rangeHeader: string, size: number): { start: number; end: number } | null {
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

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const fullPath = storedFilePath(getUploadRoot(), file.userId, file.storageKey);
  let size: number;
  try {
    size = statSync(fullPath).size;
  } catch {
    return new Response("File missing", { status: 404 });
  }

  const type = file.mimeType ?? "application/octet-stream";
  const disp = `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`;

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
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": type,
        "Content-Disposition": disp,
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Length": String(size),
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Content-Disposition": disp,
    },
  });
}
