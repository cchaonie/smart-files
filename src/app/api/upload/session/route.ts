import { auth } from "@/auth";
import { getFolderOwnedByUser } from "@/lib/folder-access";
import { prisma } from "@/lib/prisma";
import { sanitizeFileName } from "@/lib/storage-paths";
import { defaultChunkSize, maxChunkCount, maxFileSizeBytes } from "@/lib/upload-config";
import { NextResponse } from "next/server";

function totalChunksFor(totalSize: bigint, chunkSize: number): number {
  if (chunkSize <= 0) return 0;
  return Number((totalSize + BigInt(chunkSize) - 1n) / BigInt(chunkSize));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fileName?: unknown; totalSize?: unknown; chunkSize?: unknown; folderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let folderId: string | null = null;
  if (body.folderId !== undefined && body.folderId !== null && String(body.folderId).trim() !== "") {
    const folder = await getFolderOwnedByUser(String(body.folderId).trim(), session.user.id);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    folderId = folder.id;
  }

  const fileName = sanitizeFileName(String(body.fileName ?? ""));
  let totalSize: bigint;
  try {
    totalSize = BigInt(String(body.totalSize ?? "0"));
  } catch {
    return NextResponse.json({ error: "Invalid totalSize" }, { status: 400 });
  }

  let chunkSize = Number(body.chunkSize ?? defaultChunkSize());
  if (!Number.isFinite(chunkSize)) chunkSize = defaultChunkSize();
  chunkSize = Math.min(Math.max(Math.floor(chunkSize), 256 * 1024), 32 * 1024 * 1024);

  if (totalSize <= 0n || totalSize > maxFileSizeBytes()) {
    return NextResponse.json({ error: "File size not allowed" }, { status: 400 });
  }

  const totalChunks = totalChunksFor(totalSize, chunkSize);
  if (totalChunks < 1 || totalChunks > maxChunkCount()) {
    return NextResponse.json({ error: "Invalid chunk configuration" }, { status: 400 });
  }

  const upload = await prisma.uploadSession.create({
    data: {
      userId: session.user.id,
      folderId,
      fileName,
      totalSize,
      chunkSize,
      receivedChunkIndexes: [],
      status: "pending",
    },
  });

  return NextResponse.json({
    uploadId: upload.id,
    receivedIndexes: [] as number[],
    chunkSize: upload.chunkSize,
    totalChunks,
    totalSize: upload.totalSize.toString(),
  });
}
