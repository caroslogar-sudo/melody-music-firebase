import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AppUser, Track, UserRole, Playlist, UserGroup, StorageUsage, STORAGE_LIMITS } from '../types';
import {
  loginWithEmail, logoutUser, getUserProfile, subscribeToAuthState,
  getAllUsers, subscribeToUsers, updateUserProfile, approveUser, rejectUser, changeUserRole, deleteUserAccount,
} from '../services/authService';
import {
  subscribeToLibrary, subscribeToTrash, moveToTrash, restoreFromTrashFirestore,
  emptyTrashFirestore, updateTrackInFirestore, renameFolderFirestore,
  deleteFolderFirestore, autoCleanupTrash,
} from '../services/trackService';
import {
  subscribeToPlaylists, createPlaylistFirestore,
  addTrackToPlaylistFirestore, removeTrackFromPlaylistFirestore,
} from '../services/playlistService';
import {
  subscribeToGroups, createGroupFirestore, updateGroupFirestore, deleteGroupFirestore,
} from '../services/groupService';
import { setUserOnline } from '../services/chatService';
import { startSession, endSession, heartbeatSession } from '../services/sessionService';
import { getStorageUsage } from '../services/storageService';

export type RepeatMode = 'off' | 'all' | 'one';

interface AppContextProps {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string;

  users: AppUser[];
  refreshUsers: () => Promise<void>;
  approveUserAction: (uid: string) => Promise<void>;
  rejectUserAction: (uid: string) => Promise<void>;
  changeUserRoleAction: (uid: string, role: UserRole) => Promise<void>;
  deleteUserAction: (uid: string) => Promise<void>;
  updateUserProfileAction: (uid: string, updates: Partial<AppUser>) => Promise<void>;

  // Player
  currentTrack: Track | null;
  isPlaying: boolean;
  playTrack: (track: Track) => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  closePlayer: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  volume: number;
  setVolume: (vol: number) => void;
  shuffle: boolean;
  toggleShuffle: () => void;
  repeatMode: RepeatMode;
  toggleRepeat: () => void;
  queue: Track[];
  queueIndex: number;
  onTrackEnded: () => void;

  library: Track[];
  trash: Track[];
  removeTrackToTrash: (track: Track) => Promise<void>;
  restoreFromTrash: (trashTrack: Track) => Promise<void>;
  emptyTrash: () => Promise<void>;
  updateTrack: (trackId: string, updates: Partial<Track>) => Promise<void>;
  renameFolder: (oldName: string, newName: string) => Promise<void>;
  deleteFolder: (folderName: string) => Promise<void>;

  playlists: Playlist[];
  createPlaylist: (name: string, trackIds: string[]) => Promise<string>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;

  storageUsage: StorageUsage | null;
  refreshStorageUsage: () => Promise<void>;

  groups: UserGroup[];
  createGroup: (name: string, members: string[]) => Promise<string>;
  updateGroup: (id: string, updates: Partial<UserGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  theme: 'glass' | 'dark' | 'light';
  setTheme: (theme: 'glass' | 'dark' | 'light') => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  const [library, setLibrary] = useState<Track[]>([]);
  const [trash, setTrash] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  // Player state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffledQueue, setShuffledQueue] = useState<number[]>([]);
  const [shuffledPos, setShuffledPos] = useState(-1);

  const [theme, setTheme] = useState<'glass' | 'dark' | 'light'>('glass');

  // Generate shuffled indices
  const generateShuffledIndices = useCallback((length: number, currentIdx: number): number[] => {
    const indices = Array.from({ length }, (_, i) => i).filter(i => i !== currentIdx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return [currentIdx, ...indices];
  }, []);

  // Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const profile = await getUserProfile(fbUser.uid);
        if (profile && profile.approved) setUser(profile);
        else setUser(null);
      } else setUser(null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];
    unsubs.push(subscribeToLibrary(setLibrary));
    unsubs.push(subscribeToTrash((trashTracks) => {
      setTrash(trashTracks);
      autoCleanupTrash(trashTracks).catch(console.error);
    }));
    unsubs.push(subscribeToPlaylists(setPlaylists));
    unsubs.push(subscribeToGroups(setGroups));
    unsubs.push(subscribeToUsers(setUsers));
    getStorageUsage().then(setStorageUsage).catch(console.error);

    // Set online status
    setUserOnline(user.uid, true).catch(() => {});
    const handleBeforeUnload = () => { setUserOnline(user.uid, false); };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Session tracking
    let sessionId = '';
    startSession(user.uid).then(id => { sessionId = id; }).catch(() => {});
    const heartbeatInterval = setInterval(() => {
      if (sessionId) heartbeatSession(sessionId).catch(() => {});
    }, 60000); // every 60 seconds

    const handleSessionEnd = () => { if (sessionId) endSession(sessionId); };
    window.addEventListener('beforeunload', handleSessionEnd);

    return () => {
      unsubs.forEach((fn) => fn());
      setUserOnline(user.uid, false).catch(() => {});
      handleSessionEnd();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleSessionEnd);
      clearInterval(heartbeatInterval);
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    setLoginError('');
    try {
      const appUser = await loginWithEmail(email, password);
      setUser(appUser);
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' ? 'Email o contraseña incorrectos.'
        : err.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera unos minutos.'
        : err.message || 'Error al iniciar sesión.';
      setLoginError(msg);
      throw err;
    }
  };

  const logout = async () => {
    setIsPlaying(false); setCurrentTrack(null); setQueue([]); setQueueIndex(-1);
    if (user) await setUserOnline(user.uid, false).catch(() => {});
    await logoutUser();
    setUser(null); setLibrary([]); setTrash([]); setPlaylists([]);
  };

  // ===== PLAYER =====

  // Play single track (no queue)
  const playTrack = (track: Track) => {
    setQueue([track]);
    setQueueIndex(0);
    setCurrentTrack(track);
    setIsPlaying(true);
    if (shuffle) {
      setShuffledQueue([0]);
      setShuffledPos(0);
    }
    // Increment play count
    updateTrackInFirestore(track.id, {
      playCount: (track.playCount || 0) + 1,
      lastPlayedBy: user?.uid || '',
      lastPlayedAt: Date.now(),
    }).catch(() => {});
  };

  // Play a list of tracks starting from startIndex
  const playQueue = (tracks: Track[], startIndex: number = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    setQueueIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
    setIsPlaying(true);
    if (shuffle) {
      const shuffled = generateShuffledIndices(tracks.length, startIndex);
      setShuffledQueue(shuffled);
      setShuffledPos(0);
    }
    // Increment play count
    const t = tracks[startIndex];
    if (t) {
      updateTrackInFirestore(t.id, {
        playCount: (t.playCount || 0) + 1,
        lastPlayedBy: user?.uid || '',
        lastPlayedAt: Date.now(),
      }).catch(() => {});
    }
  };

  const togglePlay = () => {
    if (currentTrack) setIsPlaying(!isPlaying);
  };

  const closePlayer = () => {
    setIsPlaying(false); setCurrentTrack(null); setQueue([]); setQueueIndex(-1);
  };

  const getNextIndex = useCallback((): number | null => {
    if (queue.length === 0) return null;

    if (shuffle) {
      const nextPos = shuffledPos + 1;
      if (nextPos < shuffledQueue.length) return shuffledQueue[nextPos];
      if (repeatMode === 'all') return shuffledQueue[0];
      return null;
    }

    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) return nextIdx;
    if (repeatMode === 'all') return 0;
    return null;
  }, [queue, queueIndex, shuffle, shuffledQueue, shuffledPos, repeatMode]);

  const getPrevIndex = useCallback((): number | null => {
    if (queue.length === 0) return null;

    if (shuffle) {
      const prevPos = shuffledPos - 1;
      if (prevPos >= 0) return shuffledQueue[prevPos];
      if (repeatMode === 'all') return shuffledQueue[shuffledQueue.length - 1];
      return null;
    }

    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) return prevIdx;
    if (repeatMode === 'all') return queue.length - 1;
    return null;
  }, [queue, queueIndex, shuffle, shuffledQueue, shuffledPos, repeatMode]);

  const nextTrack = useCallback(() => {
    const nextIdx = getNextIndex();
    if (nextIdx !== null && queue[nextIdx]) {
      setQueueIndex(nextIdx);
      setCurrentTrack(queue[nextIdx]);
      setIsPlaying(true);
      if (shuffle) setShuffledPos((p) => (p + 1) % shuffledQueue.length);
    } else {
      // End of queue, no repeat
      setIsPlaying(false);
    }
  }, [getNextIndex, queue, shuffle, shuffledQueue]);

  const prevTrack = useCallback(() => {
    const prevIdx = getPrevIndex();
    if (prevIdx !== null && queue[prevIdx]) {
      setQueueIndex(prevIdx);
      setCurrentTrack(queue[prevIdx]);
      setIsPlaying(true);
      if (shuffle) setShuffledPos((p) => Math.max(0, p - 1));
    }
  }, [getPrevIndex, queue, shuffle]);

  // Called when audio element fires 'ended'
  const onTrackEnded = useCallback(() => {
    if (repeatMode === 'one') {
      // Repeat same track - player will handle restarting
      setIsPlaying(true);
      return;
    }
    nextTrack();
  }, [repeatMode, nextTrack]);

  const toggleShuffle = () => {
    setShuffle((prev) => {
      const next = !prev;
      if (next && queue.length > 0) {
        const shuffled = generateShuffledIndices(queue.length, queueIndex);
        setShuffledQueue(shuffled);
        setShuffledPos(0);
      }
      return next;
    });
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  // Library actions
  const removeTrackToTrash = async (track: Track) => {
    if (currentTrack?.id === track.id) closePlayer();
    await moveToTrash(track, user?.uid);
  };
  const restoreFromTrashAction = async (trashTrack: Track) => { await restoreFromTrashFirestore(trashTrack.id, trashTrack); };
  const emptyTrashAction = async () => { await emptyTrashFirestore(trash); };
  const updateTrack = async (trackId: string, updates: Partial<Track>) => { await updateTrackInFirestore(trackId, updates); };
  const renameFolder = async (oldName: string, newName: string) => { await renameFolderFirestore(library, oldName, newName); };
  const deleteFolder = async (folderName: string) => { await deleteFolderFirestore(library, folderName); };

  const createPlaylist = async (name: string, trackIds: string[]): Promise<string> => {
    return await createPlaylistFirestore({ name, tracks: trackIds, createdBy: user?.uid || '', createdAt: Date.now() });
  };
  const addTrackToPlaylist = async (playlistId: string, trackId: string) => { await addTrackToPlaylistFirestore(playlistId, trackId); };
  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => { await removeTrackFromPlaylistFirestore(playlistId, trackId); };

  const refreshUsers = async () => { setUsers(await getAllUsers()); };
  const approveUserAction = async (uid: string) => { await approveUser(uid); await refreshUsers(); };
  const rejectUserAction = async (uid: string) => { await rejectUser(uid); await refreshUsers(); };
  const changeUserRoleAction = async (uid: string, role: UserRole) => { await changeUserRole(uid, role); await refreshUsers(); };
  const deleteUserAction = async (uid: string) => { await deleteUserAccount(uid); await refreshUsers(); };
  const updateUserProfileAction = async (uid: string, updates: Partial<AppUser>) => {
    await updateUserProfile(uid, updates);
    if (uid === user?.uid) setUser((prev) => prev ? { ...prev, ...updates } : prev);
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) await refreshUsers();
  };
  const refreshStorageUsage = async () => { setStorageUsage(await getStorageUsage()); };

  const createGroup = async (name: string, members: string[]): Promise<string> => {
    return await createGroupFirestore({ name, members, createdBy: user?.uid || '', createdAt: Date.now() });
  };
  const updateGroup = async (id: string, updates: Partial<UserGroup>) => { await updateGroupFirestore(id, updates); };
  const deleteGroup = async (id: string) => { await deleteGroupFirestore(id); };

  return (
    <AppContext.Provider
      value={{
        user, firebaseUser, authLoading, login, logout, loginError,
        users, refreshUsers, approveUserAction, rejectUserAction, changeUserRoleAction, deleteUserAction, updateUserProfileAction,
        currentTrack, isPlaying, playTrack, playQueue, togglePlay, closePlayer,
        nextTrack, prevTrack, volume, setVolume,
        shuffle, toggleShuffle, repeatMode, toggleRepeat,
        queue, queueIndex, onTrackEnded,
        library, trash, removeTrackToTrash, restoreFromTrash: restoreFromTrashAction, emptyTrash: emptyTrashAction,
        updateTrack, renameFolder, deleteFolder,
        playlists, createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist,
        storageUsage, refreshStorageUsage,
        groups, createGroup, updateGroup, deleteGroup,
        theme, setTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};