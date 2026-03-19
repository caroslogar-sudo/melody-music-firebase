import {
  collection, doc, addDoc, updateDoc, query, where, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { MailMessage } from '../types';

const MAIL_COL = 'mail';

export const subscribeToInbox = (uid: string, callback: (msgs: MailMessage[]) => void): Unsubscribe => {
  const q = query(collection(db, MAIL_COL), where('to', '==', uid));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MailMessage))
      .filter(m => !m.deletedByTo)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(msgs);
  }, (err) => { console.warn('Inbox error:', err.message); callback([]); });
};

export const subscribeToSent = (uid: string, callback: (msgs: MailMessage[]) => void): Unsubscribe => {
  const q = query(collection(db, MAIL_COL), where('from', '==', uid));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MailMessage))
      .filter(m => !m.deletedByFrom)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(msgs);
  }, (err) => { console.warn('Sent error:', err.message); callback([]); });
};

export const sendMail = async (from: string, to: string, subject: string, body: string): Promise<string> => {
  const ref = await addDoc(collection(db, MAIL_COL), { from, to, subject, body, read: false, createdAt: Date.now() });
  return ref.id;
};

export const markMailRead = async (id: string): Promise<void> => {
  try { await updateDoc(doc(db, MAIL_COL, id), { read: true }); } catch {}
};

export const deleteMailForUser = async (id: string, uid: string, msg: MailMessage): Promise<void> => {
  try {
    if (msg.from === uid) await updateDoc(doc(db, MAIL_COL, id), { deletedByFrom: true });
    if (msg.to === uid) await updateDoc(doc(db, MAIL_COL, id), { deletedByTo: true });
  } catch {}
};