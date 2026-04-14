import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const folderParam = url.searchParams.get("folderId");
  let folderId: string | null | undefined = undefined;
  if (folderParam !== null) {
    folderId = folderParam.trim() === "" ? null : folderParam.trim();
  }

  const files = await prisma.file.findMany({
    where: {
      userId: session.user.id,
      ...(folderId !== undefined ? { folderId } : {}),
    },
    orderBy: { createdAt: "desc" },
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
    files: files.map((f) => ({
      ...f,
      size: f.size.toString(),
      createdAt: f.createdAt.toISOString(),
    })),
  });
}
