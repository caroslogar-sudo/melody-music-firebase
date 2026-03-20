import {
  collection, doc, addDoc, getDocs, query, where, orderBy, onSnapshot, Unsubscribe, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export interface HistoryEntry {
  id: string;
  uid: string;
  trackId: string;
  playedAt: number;
}

const COL = 'history';
const MAX_HISTORY = 100; // Keep last 100 entries per user

export const addToHistory = async (uid: string, trackId: string): Promise<void> => {
  try {
    await addDoc(collection(db, COL), { uid, trackId, playedAt: Date.now() });
    console.log('[History] Added:', trackId, 'for', uid);
  } catch (err: any) {
    console.error('[History] FAILED. Check Firestore rule for "history" collection. Error:', err.message || err);
  }
};

export const subscribeToHistory = (uid: string, callback: (entries: HistoryEntry[]) => void): Unsubscribe => {
  const q = query(collection(db, COL), where('uid', '==', uid));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as HistoryEntry))
      .sort((a, b) => b.playedAt - a.playedAt)
      .slice(0, MAX_HISTORY);
    callback(entries);
  }, () => callback([]));
};

export const clearHistory = async (uid: string): Promise<void> => {
  try {
    const q = query(collection(db, COL), where('uid', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch {}
};