import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Track } from '../types';
import { deleteFile } from './storageService';

const TRACKS_COL = 'tracks';
const TRASH_COL = 'trash';

// Real-time listener for library tracks
export const subscribeToLibrary = (
  callback: (tracks: Track[]) => void
): Unsubscribe => {
  const q = query(collection(db, TRACKS_COL), orderBy('addedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tracks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Track));
    callback(tracks);
  });
};

// Real-time listener for trash
export const subscribeToTrash = (
  callback: (tracks: Track[]) => void
): Unsubscribe => {
  const q = query(collection(db, TRASH_COL), orderBy('deletedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tracks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Track));
    callback(tracks);
  });
};

// Add a new track
export const addTrackToFirestore = async (track: Omit<Track, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, TRACKS_COL), track);
  return docRef.id;
};

// Update track metadata
export const updateTrackInFirestore = async (trackId: string, updates: Partial<Track>): Promise<void> => {
  await updateDoc(doc(db, TRACKS_COL, trackId), updates);
};

// Move track to trash
export const moveToTrash = async (track: Track, deletedByUid?: string): Promise<void> => {
  const { id, ...trackData } = track;
  await addDoc(collection(db, TRASH_COL), {
    ...trackData,
    originalId: id,
    deletedAt: Date.now(),
    deletedBy: deletedByUid || '',
  });
  await deleteDoc(doc(db, TRACKS_COL, id));
};

// Restore from trash
export const restoreFromTrashFirestore = async (trashId: string, trackData: Track): Promise<void> => {
  const { id, deletedAt, ...rest } = trackData;
  // Remove originalId if present
  const cleanData = { ...rest } as any;
  delete cleanData.originalId;
  // Add back to library
  await addDoc(collection(db, TRACKS_COL), cleanData);
  // Remove from trash
  await deleteDoc(doc(db, TRASH_COL, trashId));
};

// Permanently delete from trash (with Storage cleanup)
export const permanentDelete = async (track: Track): Promise<void> => {
  // Delete the file from Storage
  if (track.storagePath) {
    await deleteFile(track.storagePath, track.fileSize, track.type === 'audio' ? 'audio' : 'video');
  }
  // Delete the Firestore document
  await deleteDoc(doc(db, TRASH_COL, track.id));
};

// Empty entire trash
export const emptyTrashFirestore = async (trashTracks: Track[]): Promise<void> => {
  for (const track of trashTracks) {
    await permanentDelete(track);
  }
};

// Auto-cleanup: delete trash items older than 5 days
export const autoCleanupTrash = async (trashTracks: Track[]): Promise<number> => {
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  for (const track of trashTracks) {
    if (track.deletedAt && (now - track.deletedAt) > FIVE_DAYS) {
      await permanentDelete(track);
      cleaned++;
    }
  }
  return cleaned;
};

// Rename folder (update all tracks in that folder)
export const renameFolderFirestore = async (
  tracks: Track[],
  oldName: string,
  newName: string
): Promise<void> => {
  const batch = writeBatch(db);
  tracks.forEach((track) => {
    const folder = track.folder || 'General';
    if (folder === oldName || folder.startsWith(oldName + '/')) {
      const newFolder = folder === oldName
        ? newName
        : newName + folder.slice(oldName.length);
      batch.update(doc(db, TRACKS_COL, track.id), { folder: newFolder });
    }
  });
  await batch.commit();
};

// Delete folder (move all tracks to trash)
export const deleteFolderFirestore = async (
  tracks: Track[],
  folderName: string
): Promise<void> => {
  const tracksToDelete = tracks.filter((t) => {
    const folder = t.folder || 'General';
    return folder === folderName || folder.startsWith(folderName + '/');
  });

  for (const track of tracksToDelete) {
    await moveToTrash(track);
  }
};