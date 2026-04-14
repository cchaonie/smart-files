import { auth } from "@/auth";
import { getFolderOwnedByUser } from "@/lib/folder-access";
import { sanitizeFolderName } from "@/lib/folder-name";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let body: { name?: unknown; parentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = sanitizeFolderName(String(body.name ?? ""));
  let parentId: string | null = null;
  if (body.parentId !== undefined && body.parentId !== null && String(body.parentId).trim() !== "") {
    const parent = await getFolderOwnedByUser(String(body.parentId).trim(), userId);
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
    parentId = parent.id;
  }

  const existing = await prisma.folder.findFirst({
    where: { userId, parentId, name },
  });
  if (existing) {
    return NextResponse.json({ error: "A folder with this name already exists here" }, { status: 409 });
  }

  const folder = await prisma.folder.create({
    data: { userId, parentId, name },
    select: { id: true, name: true, parentId: true, createdAt: true },
  });

  return NextResponse.json({
    folder: {
      ...folder,
      createdAt: folder.createdAt.toISOString(),
    },
  });
}
