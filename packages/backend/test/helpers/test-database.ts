import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanDatabase() {
  // Delete in order to respect foreign keys
  await prisma.file.deleteMany();
  await prisma.uploadSession.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export { prisma };
