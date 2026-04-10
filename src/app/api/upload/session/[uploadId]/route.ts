import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function totalChunksFor(totalSize: bigint, chunkSize: number): number {
  if (chunkSize <= 0) return 0;
  return Number((totalSize + BigInt(chunkSize) - 1n) / BigInt(chunkSize));
}

export async function GET(_req: Request, ctx: { params: Promise<{ uploadId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uploadId } = await ctx.params;
  const upload = await prisma.uploadSession.findFirst({
    where: { id: uploadId, userId: session.user.id, status: "pending" },
  });

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totalChunks = totalChunksFor(upload.totalSize, upload.chunkSize);
  const receivedIndexes = [...upload.receivedChunkIndexes].sort((a, b) => a - b);

  return NextResponse.json({
    uploadId: upload.id,
    receivedIndexes,
    chunkSize: upload.chunkSize,
    totalChunks,
    fileName: upload.fileName,
    totalSize: upload.totalSize.toString(),
  });
}
