-- CreateUniqueConstraint
CREATE UNIQUE INDEX "File_userId_storageKey_key" ON "File"("userId", "storageKey");
