"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
            const existing = await prisma.file.findFirst({
                where: { photoId: photo.id },
            });
            if (existing) {
                skipped++;
                continue;
            }
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
        }
        catch (err) {
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
//# sourceMappingURL=migrate-photo-files.js.map