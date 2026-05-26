ALTER TABLE "File" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "File_userId_deletedAt_idx" ON "File"("userId", "deletedAt");
