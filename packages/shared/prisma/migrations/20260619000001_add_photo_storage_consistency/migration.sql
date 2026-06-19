-- AlterEnum
ALTER TYPE "PhotoStatus" ADD VALUE 'UPLOADED';
ALTER TYPE "PhotoStatus" ADD VALUE 'THUMBNAILING';
ALTER TYPE "PhotoStatus" ADD VALUE 'THUMBNAIL_FAILED';
ALTER TYPE "PhotoStatus" ADD VALUE 'THUMBNAIL_PERMANENTLY_FAILED';
ALTER TYPE "PhotoStatus" ADD VALUE 'TAGGING';
ALTER TYPE "PhotoStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "PhotoStatus" ADD VALUE 'ORPHANED';

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- AlterTable: File
ALTER TABLE "File" ADD COLUMN "photoId" TEXT;
CREATE UNIQUE INDEX "File_photoId_key" ON "File"("photoId");
ALTER TABLE "File" ADD CONSTRAINT "File_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Photo
DROP INDEX IF EXISTS "Photo_hash_key";
ALTER TABLE "Photo" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Photo" ADD COLUMN "orphanedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN "orphanReason" TEXT;
CREATE UNIQUE INDEX "Photo_userId_hash_key" ON "Photo"("userId", "hash");
CREATE INDEX "Photo_status_updatedAt_idx" ON "Photo"("status", "updatedAt");
