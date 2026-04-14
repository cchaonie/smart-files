import { prisma } from "@/lib/prisma";

export async function getFolderOwnedByUser(folderId: string, userId: string) {
  return prisma.folder.findFirst({
    where: { id: folderId, userId },
  });
}
