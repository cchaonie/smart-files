export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface FileItem {
  id: string;
  name: string;
  size: string;
  mimeType: string | null;
  folderId: string | null;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface BrowseResponse {
  folders: Folder[];
  files: FileItem[];
}

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

export interface CreateFolderRequest {
  name: string;
  parentId?: string;
}

export interface UploadSession {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  totalSize: string;
}

export interface UploadProgress {
  id: number;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export interface UploadQueueItem {
  id: number;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'done' | 'error';
  error?: string;
  folderId?: string;
  folderName?: string;
}

export interface UploadHistoryItem {
  id: number;
  name: string;
  size: number;
  folderId?: string;
  folderName?: string;
  completedAt: string;
}
