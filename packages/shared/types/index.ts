// Shared types for Smart Files

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface FileItem {
  id: string;
  userId: string;
  folderId: string | null;
  name: string;
  storageKey: string;
  size: bigint;
  mimeType: string | null;
  createdAt: Date;
}

export interface Folder {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  createdAt: Date;
}

export interface UploadSession {
  id: string;
  userId: string;
  folderId: string | null;
  fileName: string;
  totalSize: bigint;
  chunkSize: number;
  receivedChunkIndexes: number[];
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

// API Types

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface BrowseResponse {
  folders: Folder[];
  files: FileItem[];
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string;
}

export interface RenameFolderRequest {
  name: string;
}

export interface CreateUploadSessionRequest {
  fileName: string;
  totalSize: string;
  chunkSize: number;
  folderId?: string;
}

export interface UploadSessionResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  totalSize: string;
}

export interface CompleteUploadRequest {
  mimeType?: string;
}

// File size in bytes as bigint
export type FileSize = bigint;
