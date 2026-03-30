import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask,
  getMetadata,
} from 'firebase/storage';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  getDocs,
} from 'firebase/firestore';
import { storage, db } from './firebase';
import { StorageUsage, STORAGE_LIMITS, Track } from '../types';

// Get current storage usage from Firestore
export const getStorageUsage = async (): Promise<StorageUsage> => {
  const initial: StorageUsage = {
    totalBytes: 0, audioBytes: 0, videoBytes: 0, coverBytes: 0, fileCount: 0, lastUpdated: Date.now(),
  };
  try {
    const docRef = doc(db, 'config', 'storage-usage');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as StorageUsage;
    }
    await setDoc(docRef, initial);
  } catch (err) {
    console.warn('Could not read storage usage:', err);
  }
  return initial;
};

// Check if upload would exceed limits
export const canUpload = async (fileSize: number): Promise<{ allowed: boolean; message: string }> => {
  try {
    const usage = await getStorageUsage();
    const newTotal = usage.totalBytes + fileSize;
    const percent = (newTotal / STORAGE_LIMITS.TOTAL_BYTES) * 100;

    if (percent >= 100) {
      return {
        allowed: false,
        message: 'Almacenamiento lleno! Has alcanzado el limite de 5 GB.',
      };
    }

    if (percent >= STORAGE_LIMITS.CRITICAL_PERCENT) {
      return {
        allowed: true,
        message: `Almacenamiento al ${percent.toFixed(1)}%. Casi lleno!`,
      };
    }

    if (percent >= STORAGE_LIMITS.WARN_PERCENT) {
      return {
        allowed: true,
        message: `Almacenamiento al ${percent.toFixed(1)}%. Considera liberar espacio.`,
      };
    }
  } catch (err) {
    console.warn('Could not check storage usage:', err);
  }

  return { allowed: true, message: '' };
};

// Upload file to Firebase Storage with progress tracking
export const uploadFile = (
  file: File,
  type: 'audio' | 'video' | 'cover',
  trackId: string,
  onProgress: (percent: number) => void
): { task: UploadTask; promise: Promise<{ url: string; storagePath: string }> } => {
  const ext = file.name.split('.').pop() || '';
  const storagePath = `${type}/${trackId}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  const promise = new Promise<{ url: string; storagePath: string }>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(Math.round(percent));
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          // Update storage usage
          await updateStorageUsage(type, file.size);
          resolve({ url, storagePath });
        } catch (err) {
          reject(err);
        }
      }
    );
  });

  return { task, promise };
};

// Update storage usage counter in Firestore
const updateStorageUsage = async (type: 'audio' | 'video' | 'cover', bytes: number): Promise<void> => {
  try {
    const docRef = doc(db, 'config', 'storage-usage');
    const field = type === 'audio' ? 'audioBytes' : type === 'video' ? 'videoBytes' : 'coverBytes';
    await updateDoc(docRef, {
      totalBytes: increment(bytes),
      [field]: increment(bytes),
      fileCount: increment(1),
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.warn('Could not update storage usage:', err);
  }
};

// Delete file from Storage and update usage
export const deleteFile = async (storagePath: string, fileSize: number, type: 'audio' | 'video' | 'cover'): Promise<void> => {
  if (!storagePath) return;
  try {
    const storageRef = ref(storage, storagePath);

    // Get REAL file size from Storage metadata (fileSize param is often 0 for old tracks)
    let realSize = fileSize;
    try {
      const metadata = await getMetadata(storageRef);
      realSize = metadata.size || fileSize;
      console.log(`[Storage] Deleting ${storagePath} (${realSize} bytes)`);
    } catch {
      console.log(`[Storage] Could not get metadata, using provided size: ${fileSize}`);
    }

    await deleteObject(storageRef);

    // Decrease storage usage with the real size
    if (realSize > 0) {
      const docRef = doc(db, 'config', 'storage-usage');
      const field = type === 'audio' ? 'audioBytes' : type === 'video' ? 'videoBytes' : 'coverBytes';
      await updateDoc(docRef, {
        totalBytes: increment(-realSize),
        [field]: increment(-realSize),
        fileCount: increment(-1),
        lastUpdated: Date.now(),
      });
    }
  } catch (err) {
    console.error('Error deleting file:', err);
  }
};

// Recalculate storage usage by scanning all tracks in Firestore
// Call this to fix mismatched counters
export const recalculateStorageUsage = async (): Promise<StorageUsage> => {
  let audioBytes = 0;
  let videoBytes = 0;
  let coverBytes = 0;
  let fileCount = 0;

  try {
    // Scan all tracks in library
    const tracksSnap = await getDocs(collection(db, 'tracks'));
    for (const d of tracksSnap.docs) {
      const track = d.data() as Track;
      let size = track.fileSize || 0;

      // If fileSize is 0, try to get real size from Storage
      if (size === 0 && track.storagePath) {
        try {
          const metadata = await getMetadata(ref(storage, track.storagePath));
          size = metadata.size || 0;
          // Update the track document with the real size
          if (size > 0) {
            await updateDoc(doc(db, 'tracks', d.id), { fileSize: size });
          }
        } catch { /* file might not exist */ }
      }

      if (track.type === 'audio') audioBytes += size;
      else if (track.type === 'video') videoBytes += size;
      fileCount++;
    }

    // Scan trash too
    const trashSnap = await getDocs(collection(db, 'trash'));
    for (const d of trashSnap.docs) {
      const track = d.data() as Track;
      let size = track.fileSize || 0;

      if (size === 0 && track.storagePath) {
        try {
          const metadata = await getMetadata(ref(storage, track.storagePath));
          size = metadata.size || 0;
        } catch {}
      }

      if (track.type === 'audio') audioBytes += size;
      else if (track.type === 'video') videoBytes += size;
      fileCount++;
    }

    // Scan photos
    const photosSnap = await getDocs(collection(db, 'photos'));
    for (const d of photosSnap.docs) {
      const photo = d.data();
      let size = 0;
      if (photo.storagePath) {
        try {
          const metadata = await getMetadata(ref(storage, photo.storagePath));
          size = metadata.size || 0;
        } catch {}
      }
      coverBytes += size;
      fileCount++;
    }

    const totalBytes = audioBytes + videoBytes + coverBytes;
    const usage: StorageUsage = {
      totalBytes, audioBytes, videoBytes, coverBytes, fileCount, lastUpdated: Date.now(),
    };

    // Save recalculated values
    await setDoc(doc(db, 'config', 'storage-usage'), usage);
    console.log('[Storage] Recalculated:', formatBytes(totalBytes), `(${fileCount} files)`);
    return usage;
  } catch (err) {
    console.error('[Storage] Recalculate error:', err);
    return { totalBytes: 0, audioBytes: 0, videoBytes: 0, coverBytes: 0, fileCount: 0, lastUpdated: Date.now() };
  }
};

// Format bytes to human readable
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};