import { faker } from '@faker-js/faker';

export type FileItem = {
  id: string;
  name: string;
  size: string;
  mimeType: string | null;
  folderId: string | null;
  createdAt: string;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

export const createFile = (overrides: Partial<FileItem> = {}): FileItem => ({
  id: faker.string.uuid(),
  name: faker.system.fileName(),
  size: String(faker.number.int({ min: 1024, max: 1073741824 })), // 1KB to 1GB
  mimeType: faker.system.mimeType(),
  folderId: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createFolder = (overrides: Partial<Folder> = {}): Folder => ({
  id: faker.string.uuid(),
  name: faker.system.directoryPath().split('/').pop() || 'folder',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createImageFile = (overrides: Partial<FileItem> = {}): FileItem =>
  createFile({
    name: faker.system.fileName({ extensionCount: 1 }) + '.jpg',
    mimeType: 'image/jpeg',
    ...overrides,
  });
