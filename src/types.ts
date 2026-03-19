export enum UserRole {
  MASTER = 'MASTER',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  approved: boolean;
  createdAt: number;
  online?: boolean;
  lastSeen?: number;
  allowedFolders?: string[]; // ['*'] = all, ['Bachata', 'Salsa/Mixes'] = specific folders
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumYear?: string;
  folder?: string;
  coverUrl: string;
  src: string;
  storagePath: string;
  duration: number;
  type: 'audio' | 'video';
  fileSize: number;
  addedAt: number;
  addedBy: string;
  deletedAt?: number;
  deletedBy?: string;
  location?: string;
  videoThumbnail?: string;
  playCount?: number;
  lastPlayedBy?: string;
  lastPlayedAt?: number;
  sharedWith?: string[];
}

export interface Playlist {
  id: string;
  name: string;
  tracks: string[];
  coverUrl?: string;
  createdBy: string;
  createdAt: number;
  sharedWith?: string[]; // uids or group:id
}

export interface UserGroup {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: number;
}

// Internal mail
export interface MailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: number;
  deletedByFrom?: boolean;
  deletedByTo?: boolean;
}

// Chat message (real-time, auto-delete 5 days)
export interface ChatMessage {
  id: string;
  from: string;
  to: string; // uid or 'group:groupId'
  text: string;
  createdAt: number;
  readBy?: string[];
}

export interface StorageUsage {
  totalBytes: number;
  audioBytes: number;
  videoBytes: number;
  coverBytes: number;
  fileCount: number;
  lastUpdated: number;
}

export interface AiInsight {
  mood: string;
  danceability: string;
  trivia: string;
}

export const STORAGE_LIMITS = {
  TOTAL_BYTES: 5 * 1024 * 1024 * 1024,
  WARN_PERCENT: 80,
  CRITICAL_PERCENT: 95,
  MAX_FILE_SIZE: 150 * 1024 * 1024,
  DAILY_DOWNLOAD_BYTES: 1 * 1024 * 1024 * 1024,
};