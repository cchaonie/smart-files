import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storedFilePath } from "@/lib/storage-paths";
import { getUploadRoot } from "@/lib/upload-config";
import fs from "fs/promises";
import { NextResponse } from "next/server";

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
