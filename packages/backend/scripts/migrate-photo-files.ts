/**
 * Migration Script: Create File records for existing Photo records.
 *
 * After adding the photoId field to the File model, existing photos uploaded
 * via camera roll sync don't have a corresponding File record. This script
 * creates one for each Photo that doesn't already have one.
 *
 * Usage: npx ts-node scripts/migrate-photo-files.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding photos without linked File records...');

  const photos = await prisma.photo.findMany({
    where: {
      file: null,
    },
    include: {
      user: { select: { id: true } },
    },
  });

  console.log(`  Found ${photos.length} photos to migrate.`);

  let created = 0;
  let skipped = 0;

  for (const photo of photos) {
    try {
      // Check if a File already exists with this photoId (edge case)
      const existing = await prisma.file.findFirst({
        where: { photoId: photo.id },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Check if a File with same storageKey exists (dedup by path)
      const dupKey = await prisma.file.findFirst({
        where: { userId: photo.userId, storageKey: photo.storageKey },
      });
      if (dupKey) {
        console.log(`  ⚠️  File exists with same storageKey for photo ${photo.id}, skipping`);
        skipped++;
        continue;
      }

      await prisma.file.create({
        data: {
          userId: photo.userId,
          name: photo.originalName,
          storageKey: photo.storageKey,
          size: BigInt(photo.size),
          mimeType: photo.mimeType,
          photoId: photo.id,
          createdAt: photo.createdAt,
        },
      });
      created++;
    } catch (err) {
      console.error(`  ❌ Failed to create File for photo ${photo.id}:`, err);
    }
  }

  console.log(`\n✅ Migration complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${photos.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
