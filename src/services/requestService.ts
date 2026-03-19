import {
  collection, doc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface SongRequest {
  id: string;
  title: string;
  artist: string;
  notes?: string;
  requestedBy: string; // uid
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'uploaded';
  resolvedBy?: string; // uid of admin/master who resolved
  resolvedAt?: number;
  response?: string; // admin response message
}

const REQ_COL = 'songRequests';

export const subscribeToRequests = (callback: (reqs: SongRequest[]) => void): Unsubscribe => {
  return onSnapshot(collection(db, REQ_COL), (snap) => {
    const reqs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as SongRequest))
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(reqs);
  }, () => callback([]));
};

export const createRequest = async (title: string, artist: string, notes: string, uid: string): Promise<string> => {
  const ref = await addDoc(collection(db, REQ_COL), {
    title, artist, notes: notes || '', requestedBy: uid, createdAt: Date.now(), status: 'pending',
  });
  return ref.id;
};

export const updateRequestStatus = async (
  id: string, status: SongRequest['status'], resolvedBy: string, response?: string
): Promise<void> => {
  const updates: any = { status, resolvedBy, resolvedAt: Date.now() };
  if (response) updates.response = response;
  await updateDoc(doc(db, REQ_COL, id), updates);
};

export const deleteRequest = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, REQ_COL, id));
};