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

export interface UploadSession {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  totalSize: string;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}
