import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, Unsubscribe, orderBy, query,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserGroup } from '../types';

const GROUPS_COL = 'groups';

export const subscribeToGroups = (callback: (groups: UserGroup[]) => void): Unsubscribe => {
  const q = query(collection(db, GROUPS_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserGroup)));
  }, (error) => {
    console.warn('Groups subscription error (may need Firestore rules for groups collection):', error.message);
    callback([]);
  });
};

export const createGroupFirestore = async (group: Omit<UserGroup, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, GROUPS_COL), group);
  return ref.id;
};

export const updateGroupFirestore = async (id: string, updates: Partial<UserGroup>): Promise<void> => {
  await updateDoc(doc(db, GROUPS_COL, id), updates);
};

export const deleteGroupFirestore = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, GROUPS_COL, id));
};