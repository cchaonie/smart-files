import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const files = await prisma.file.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      size: true,
      mimeType: true,
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
