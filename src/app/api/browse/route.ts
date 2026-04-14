import { auth } from "@/auth";
import { getFolderOwnedByUser } from "@/lib/folder-access";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  const rawParent = url.searchParams.get("parentId");
  let parentId: string | null = null;

  if (rawParent !== null && rawParent.trim() !== "") {
    const folder = await getFolderOwnedByUser(rawParent.trim(), userId);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    parentId = folder.id;
  }

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { userId, parentId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.file.findMany({
      where: { userId, folderId: parentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        folderId: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    folders: folders.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
    files: files.map((f) => ({
      ...f,
      size: f.size.toString(),
      createdAt: f.createdAt.toISOString(),
    })),
  });
}
