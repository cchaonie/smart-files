import { auth } from "@/auth";
import { isPreviewableImage, previewImageContentType } from "@/lib/image-file";
import { prisma } from "@/lib/prisma";
import { streamUserFileResponse } from "@/lib/serve-user-file";
import { storedFilePath } from "@/lib/storage-paths";
import { getUploadRoot } from "@/lib/upload-config";
import { statSync } from "fs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  if (!isPreviewableImage(file.mimeType, file.name)) {
    return new Response("Not found", { status: 404 });
  }

  const fullPath = storedFilePath(getUploadRoot(), file.userId, file.storageKey);
  let size: number;
  try {
    size = statSync(fullPath).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const type = previewImageContentType(file.mimeType, file.name);

  return streamUserFileResponse(req, fullPath, size, type, file.name, "inline", "private, max-age=3600");
}
