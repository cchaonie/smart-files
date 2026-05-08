import { faker } from '@faker-js/faker';

export type FileItem = {
  id: string;
  userId: string;
  folderId: string | null;
  name: string;
  storageKey: string;
  size: bigint;
  mimeType: string | null;
  createdAt: Date;
};

export type Folder = {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  createdAt: Date;
};

export const createFile = (userId: string, overrides: Partial<FileItem> = {}): FileItem => ({
  id: faker.string.uuid(),
  userId,
  folderId: null,
  name: faker.system.fileName(),
  storageKey: `files/${userId}/${faker.string.uuid()}`,
  size: BigInt(faker.number.int({ min: 1024, max: 1073741824 })),
  mimeType: faker.system.mimeType(),
  createdAt: new Date(),
  ...overrides,
});

export const createFolder = (userId: string, overrides: Partial<Folder> = {}): Folder => ({
  id: faker.string.uuid(),
  userId,
  parentId: null,
  name: faker.system.directoryPath().split('/').pop() || 'folder',
  createdAt: new Date(),
  ...overrides,
});

export const createImageFile = (userId: string, overrides: Partial<FileItem> = {}): FileItem =>
  createFile(userId, {
    name: `${faker.system.fileName({ extensionCount: 0 })}.jpg`,
    mimeType: 'image/jpeg',
    ...overrides,
  });
