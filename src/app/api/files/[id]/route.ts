import { auth } from "@/auth";
import { getFolderOwnedByUser } from "@/lib/folder-access";
import { prisma } from "@/lib/prisma";
import { storedFilePath } from "@/lib/storage-paths";
import { getUploadRoot } from "@/lib/upload-config";
import fs from "fs/promises";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await ctx.params;

  let body: { folderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!("folderId" in body)) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id, userId },
  });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let targetFolderId: string | null = null;
  if (body.folderId !== null && body.folderId !== undefined && String(body.folderId).trim() !== "") {
    const folder = await getFolderOwnedByUser(String(body.folderId).trim(), userId);
    if (!folder) {
      return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
    }
    targetFolderId = folder.id;
  }

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: { folderId: targetFolderId },
    select: {
      id: true,
      name: true,
      size: true,
      mimeType: true,
      folderId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    file: {
      ...updated,
      size: updated.size.toString(),
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fullPath = storedFilePath(getUploadRoot(), file.userId, file.storageKey);
  await prisma.file.delete({ where: { id: file.id } });
  await fs.unlink(fullPath).catch(() => {});

  return NextResponse.json({ ok: true });
}
