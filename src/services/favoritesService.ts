import {
  doc, getDoc, setDoc, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// Store favorites as a single doc per user with array of trackIds
// This avoids creating thousands of small documents

export const subscribeFavorites = (uid: string, callback: (trackIds: string[]) => void): Unsubscribe => {
  return onSnapshot(doc(db, 'favorites', uid), (snap) => {
    if (snap.exists()) {
      callback(snap.data().trackIds || []);
    } else {
      callback([]);
    }
  }, () => callback([]));
};

export const toggleFavorite = async (uid: string, trackId: string): Promise<boolean> => {
  const ref = doc(db, 'favorites', uid);
  try {
    const snap = await getDoc(ref);
    const current: string[] = snap.exists() ? (snap.data().trackIds || []) : [];
    const isFav = current.includes(trackId);
    const updated = isFav ? current.filter(id => id !== trackId) : [...current, trackId];
    await setDoc(ref, { trackIds: updated, updatedAt: Date.now() });
    return !isFav; // returns new state: true = now favorite, false = removed
  } catch (err: any) {
    console.error('[Favorites] Error:', err.message || err);
    return false;
  }
};