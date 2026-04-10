import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chunkTempDir, ensureDir, storedFilePath } from "@/lib/storage-paths";
import { getUploadRoot } from "@/lib/upload-config";
import { createWriteStream } from "fs";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";

function totalChunksFor(totalSize: bigint, chunkSize: number): number {
  if (chunkSize <= 0) return 0;
  return Number((totalSize + BigInt(chunkSize) - 1n) / BigInt(chunkSize));
}

function chunksComplete(received: number[], totalChunks: number): boolean {
  if (received.length !== totalChunks) return false;
  const sorted = [...received].sort((a, b) => a - b);
  for (let i = 0; i < totalChunks; i++) {
    if (sorted[i] !== i) return false;
  }
  return true;
}

async function mergeChunksToFile(chunkDir: string, totalChunks: number, destPath: string): Promise<void> {
  await ensureDir(path.dirname(destPath));
  const out = createWriteStream(destPath);
  const done = new Promise<void>((resolve, reject) => {
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
  try {
    for (let i = 0; i < totalChunks; i++) {
      const p = path.join(chunkDir, String(i));
      const data = await fs.readFile(p);
      if (!out.write(data)) {
        await new Promise<void>((r) => out.once("drain", r));
      }
    }
    out.end();
    await done;
  } catch (e) {
    out.destroy();
    await fs.unlink(destPath).catch(() => {});
    throw e;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ uploadId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uploadId } = await ctx.params;
  let mimeType: string | null = null;
  const raw = await req.text().catch(() => "");
  if (raw) {
    try {
      const body = JSON.parse(raw) as unknown;
      if (body && typeof body === "object" && "mimeType" in body && typeof (body as { mimeType: unknown }).mimeType === "string") {
        const m = (body as { mimeType: string }).mimeType.slice(0, 200);
        mimeType = m.length > 0 ? m : null;
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const upload = await prisma.uploadSession.findFirst({
    where: { id: uploadId, userId: session.user.id, status: "pending" },
  });

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totalChunks = totalChunksFor(upload.totalSize, upload.chunkSize);
  if (!chunksComplete(upload.receivedChunkIndexes, totalChunks)) {
    return NextResponse.json({ error: "Incomplete upload" }, { status: 400 });
  }

  const root = getUploadRoot();
  const dir = chunkTempDir(root, session.user.id, uploadId);
  for (let i = 0; i < totalChunks; i++) {
    try {
      await fs.stat(path.join(dir, String(i)));
    } catch {
      return NextResponse.json({ error: "Missing chunk on disk" }, { status: 400 });
    }
  }

  const storageKey = randomUUID();
  const dest = storedFilePath(root, session.user.id, storageKey);

  try {
    await mergeChunksToFile(dir, totalChunks, dest);
  } catch {
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }

  const st = await fs.stat(dest);
  if (BigInt(st.size) !== upload.totalSize) {
    await fs.unlink(dest).catch(() => {});
    return NextResponse.json({ error: "Size mismatch after merge" }, { status: 500 });
  }

  const userId = session.user.id;

  const file = await prisma.$transaction(async (tx) => {
    const created = await tx.file.create({
      data: {
        userId,
        name: upload.fileName,
        storageKey,
        size: upload.totalSize,
        mimeType,
      },
    });
    await tx.uploadSession.update({
      where: { id: upload.id },
      data: { status: "completed", receivedChunkIndexes: upload.receivedChunkIndexes },
    });
    return created;
  });

  for (let i = 0; i < totalChunks; i++) {
    await fs.unlink(path.join(dir, String(i))).catch(() => {});
  }
  await fs.rm(dir, { recursive: true }).catch(() => {});

  return NextResponse.json({
    file: {
      id: file.id,
      name: file.name,
      size: file.size.toString(),
      createdAt: file.createdAt.toISOString(),
    },
  });
}
