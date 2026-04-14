import { auth } from "@/auth";
import { getFolderOwnedByUser } from "@/lib/folder-access";
import { sanitizeFolderName } from "@/lib/folder-name";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await ctx.params;
  const folder = await getFolderOwnedByUser(id, userId);
  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = sanitizeFolderName(String(body.name ?? ""));
  const dup = await prisma.folder.findFirst({
    where: {
      userId,
      parentId: folder.parentId,
      name,
      NOT: { id: folder.id },
    },
  });
  if (dup) {
    return NextResponse.json({ error: "A folder with this name already exists here" }, { status: 409 });
  }

  const updated = await prisma.folder.update({
    where: { id: folder.id },
    data: { name },
    select: { id: true, name: true, parentId: true, createdAt: true },
  });

  return NextResponse.json({
    folder: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await ctx.params;
  const folder = await getFolderOwnedByUser(id, userId);
  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [childCount, fileCount] = await Promise.all([
    prisma.folder.count({ where: { userId, parentId: folder.id } }),
    prisma.file.count({ where: { userId, folderId: folder.id } }),
  ]);

  if (childCount > 0 || fileCount > 0) {
    return NextResponse.json({ error: "Folder is not empty" }, { status: 409 });
  }

  await prisma.folder.delete({ where: { id: folder.id } });
  return NextResponse.json({ ok: true });
}
