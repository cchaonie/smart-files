import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chunkTempDir, ensureDir } from "@/lib/storage-paths";
import { getUploadRoot } from "@/lib/upload-config";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

function totalChunksFor(totalSize: bigint, chunkSize: number): number {
  if (chunkSize <= 0) return 0;
  return Number((totalSize + BigInt(chunkSize) - 1n) / BigInt(chunkSize));
}

function expectedChunkLength(totalSize: bigint, chunkSize: number, index: number, totalChunks: number): number {
  if (index === totalChunks - 1) {
    const rem = Number(totalSize - BigInt(index) * BigInt(chunkSize));
    return rem > 0 ? rem : chunkSize;
  }
  return chunkSize;
}

export async function PUT(req: Request, ctx: { params: Promise<{ uploadId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uploadId } = await ctx.params;
  const url = new URL(req.url);
  const indexRaw = url.searchParams.get("index");
  const index = indexRaw !== null ? parseInt(indexRaw, 10) : NaN;
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 });
  }

  const upload = await prisma.uploadSession.findFirst({
    where: { id: uploadId, userId: session.user.id, status: "pending" },
  });

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totalChunks = totalChunksFor(upload.totalSize, upload.chunkSize);
  if (index >= totalChunks) {
    return NextResponse.json({ error: "Index out of range" }, { status: 400 });
  }

  const expectedLen = expectedChunkLength(upload.totalSize, upload.chunkSize, index, totalChunks);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length !== expectedLen) {
    return NextResponse.json({ error: "Chunk size mismatch" }, { status: 400 });
  }

  const root = getUploadRoot();
  const dir = chunkTempDir(root, session.user.id, uploadId);
  await ensureDir(dir);
  const chunkPath = path.join(dir, String(index));
  await fs.writeFile(chunkPath, buf);

  const nextIndexes = [...new Set([...upload.receivedChunkIndexes, index])].sort((a, b) => a - b);
  await prisma.uploadSession.update({
    where: { id: upload.id },
    data: { receivedChunkIndexes: nextIndexes },
  });

  return NextResponse.json({ ok: true, receivedIndexes: nextIndexes });
}
