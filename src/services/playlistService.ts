import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  arrayUnion,
  arrayRemove,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import { Playlist } from '../types';

const PLAYLISTS_COL = 'playlists';

export const subscribeToPlaylists = (
  callback: (playlists: Playlist[]) => void
): Unsubscribe => {
  const q = query(collection(db, PLAYLISTS_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const playlists = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Playlist));
    callback(playlists);
  });
};

export const createPlaylistFirestore = async (playlist: Omit<Playlist, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, PLAYLISTS_COL), playlist);
  return docRef.id;
};

export const addTrackToPlaylistFirestore = async (playlistId: string, trackId: string): Promise<void> => {
  await updateDoc(doc(db, PLAYLISTS_COL, playlistId), {
    tracks: arrayUnion(trackId),
  });
};

export const removeTrackFromPlaylistFirestore = async (playlistId: string, trackId: string): Promise<void> => {
  await updateDoc(doc(db, PLAYLISTS_COL, playlistId), {
    tracks: arrayRemove(trackId),
  });
};

export const deletePlaylistFirestore = async (playlistId: string): Promise<void> => {
  await deleteDoc(doc(db, PLAYLISTS_COL, playlistId));
};

export const updatePlaylistFirestore = async (playlistId: string, updates: Partial<Playlist>): Promise<void> => {
  await updateDoc(doc(db, PLAYLISTS_COL, playlistId), updates);
};