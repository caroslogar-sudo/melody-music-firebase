import {
  collection, doc, addDoc, updateDoc, getDocs, query, where, onSnapshot, Unsubscribe, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage } from '../types';

const CHAT_COL = 'chat';
const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

export const getConvoId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('_');
};

// DM: query by convoId only, sort client-side
export const subscribeToDM = (uid1: string, uid2: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe => {
  const convoId = getConvoId(uid1, uid2);
  const q = query(collection(db, CHAT_COL), where('convoId', '==', convoId));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ChatMessage))
      .sort((a, b) => a.createdAt - b.createdAt);
    callback(msgs);
  }, (err) => { console.warn('DM error:', err.message); callback([]); });
};

// Group chat: query by 'to' only, sort client-side
export const subscribeToGroupChat = (groupId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe => {
  const target = 'group:' + groupId;
  const q = query(collection(db, CHAT_COL), where('to', '==', target));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ChatMessage))
      .sort((a, b) => a.createdAt - b.createdAt);
    callback(msgs);
  }, (err) => { console.warn('Group chat error:', err.message); callback([]); });
};

export const sendChatMessage = async (from: string, to: string, text: string): Promise<string> => {
  const isGroup = to.startsWith('group:');
  const data: Record<string, any> = { from, to, text, createdAt: Date.now(), readBy: [from] };
  if (!isGroup) data.convoId = getConvoId(from, to);
  const ref = await addDoc(collection(db, CHAT_COL), data);
  return ref.id;
};

export const markChatRead = async (msgIds: string[], uid: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    msgIds.forEach(id => { batch.update(doc(db, CHAT_COL, id), { readBy: arrayUnion(uid) }); });
    await batch.commit();
  } catch {}
};

// Auto-cleanup messages older than 5 days (simple: get all, filter client-side)
export const cleanupOldMessages = async (): Promise<number> => {
  try {
    const cutoff = Date.now() - FIVE_DAYS;
    const snap = await getDocs(collection(db, CHAT_COL));
    const old = snap.docs.filter(d => (d.data().createdAt || 0) < cutoff);
    if (old.length === 0) return 0;
    const batch = writeBatch(db);
    old.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return old.length;
  } catch { return 0; }
};

export const setUserOnline = async (uid: string, online: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), { online, lastSeen: Date.now() });
  } catch {}
};