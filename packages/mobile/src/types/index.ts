export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
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
  uri?: string;
  mimeType?: string;
}

export interface PhotoTag {
  tag: string;
  confidence: number | null;
}

export interface Photo {
  id: string;
  thumbnailPath: string;
  previewPath: string;
  originalName: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  mimeType: string;
  capturedAt: string | null;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  tags: PhotoTag[];
}

export interface Album {
  id: string;
  name: string;
  description: string | null;
  coverPhotoId: string | null;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShareEntry {
  userId: string;
  userName: string | null;
  role: string;
}

export interface PhotoTimelineResponse {
  photos: Photo[];
  nextCursor: string | null;
  total: number;
}
