import {
  collection, doc, addDoc, updateDoc, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserSession {
  id: string;
  uid: string;
  loginAt: number;
  logoutAt?: number;
  duration?: number;
  date: string;
}

const COL = 'sessions';

export const startSession = async (uid: string): Promise<string> => {
  const now = Date.now();
  const d = new Date(now);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  try {
    const ref = await addDoc(collection(db, COL), {
      uid,
      loginAt: now,
      date,
      active: true,
      lastHeartbeat: now,
    });
    console.log('[Session] Started:', ref.id, 'uid:', uid, 'date:', date);
    return ref.id;
  } catch (err: any) {
    console.error('[Session] FAILED to start. Firestore rule for "sessions" collection may be missing. Error:', err.message || err);
    return '';
  }
};

export const endSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  try {
    await updateDoc(doc(db, COL, sessionId), { logoutAt: Date.now(), active: false });
  } catch {}
};

export const heartbeatSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  try {
    await updateDoc(doc(db, COL, sessionId), { lastHeartbeat: Date.now() });
  } catch {}
};

export const subscribeToSessions = (callback: (sessions: UserSession[]) => void): Unsubscribe => {
  return onSnapshot(collection(db, COL), (snap) => {
    const sessions = snap.docs.map(d => {
      const data = d.data();
      const loginAt = data.loginAt || 0;
      const logoutAt = data.logoutAt || (data.active ? (data.lastHeartbeat || Date.now()) : loginAt);
      const duration = Math.max(0, Math.round((logoutAt - loginAt) / 60000));
      return {
        id: d.id,
        uid: data.uid || '',
        loginAt,
        logoutAt: data.logoutAt || undefined,
        duration,
        date: data.date || '',
      } as UserSession;
    }).sort((a, b) => b.loginAt - a.loginAt);
    callback(sessions);
  }, (err) => {
    console.error('[Session] Subscribe error:', err.message);
    callback([]);
  });
};