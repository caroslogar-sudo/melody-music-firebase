import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { AppUser, UserRole } from '../types';

// Master email - this user gets MASTER role (full control)
const MASTER_EMAIL = 'caroslogar@gmail.com';

// Admin emails - these users get ADMIN role automatically
const ADMIN_EMAILS = [
  'mariluz151121@gmail.com',
];

export const loginWithEmail = async (email: string, password: string): Promise<AppUser> => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Get or create user profile in Firestore
  let appUser = await getUserProfile(user.uid);
  if (!appUser) {
    appUser = await createUserProfile(user);
  }

  // Auto-upgrade role if needed (in case it was set before MASTER existed)
  const emailLower = user.email?.toLowerCase() || '';
  if (emailLower === MASTER_EMAIL && appUser.role !== UserRole.MASTER) {
    await updateUserProfile(user.uid, { role: UserRole.MASTER, approved: true });
    appUser.role = UserRole.MASTER;
    appUser.approved = true;
  } else if (ADMIN_EMAILS.includes(emailLower) && appUser.role === UserRole.USER) {
    await updateUserProfile(user.uid, { role: UserRole.ADMIN, approved: true });
    appUser.role = UserRole.ADMIN;
    appUser.approved = true;
  }

  if (!appUser.approved && appUser.role !== UserRole.MASTER && appUser.role !== UserRole.ADMIN) {
    await signOut(auth);
    throw new Error('Tu cuenta aún no ha sido aprobada por un administrador.');
  }

  return appUser;
};

export const registerWithEmail = async (email: string, password: string, displayName: string): Promise<AppUser> => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;
  const emailLower = email.toLowerCase();
  const isMaster = emailLower === MASTER_EMAIL;
  const isAdmin = ADMIN_EMAILS.includes(emailLower);
  const role = isMaster ? UserRole.MASTER : isAdmin ? UserRole.ADMIN : UserRole.USER;

  const appUser: AppUser = {
    uid: user.uid,
    email: user.email || email,
    displayName: displayName || email.split('@')[0],
    role,
    avatarUrl: '',
    approved: false, // Needs master approval (unless master/admin)
    createdAt: Date.now(),
  };

  if (isMaster || isAdmin) appUser.approved = true;

  await setDoc(doc(db, 'users', user.uid), appUser);
  // Sign out after registration - user needs approval first
  await signOut(auth);
  return appUser;
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<AppUser | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as AppUser;
  }
  return null;
};

export const createUserProfile = async (firebaseUser: FirebaseUser): Promise<AppUser> => {
  const emailLower = firebaseUser.email?.toLowerCase() || '';
  const isMaster = emailLower === MASTER_EMAIL;
  const isAdmin = ADMIN_EMAILS.includes(emailLower);
  const displayName = firebaseUser.email?.split('@')[0] || 'Usuario';

  const name = isMaster ? 'Oscar López'
    : emailLower === 'mariluz151121@gmail.com' ? 'Mariluz'
    : displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const role = isMaster ? UserRole.MASTER : isAdmin ? UserRole.ADMIN : UserRole.USER;

  const appUser: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: name,
    role,
    avatarUrl: '',
    approved: isMaster || isAdmin, // Master and Admins auto-approved
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', firebaseUser.uid), appUser);
  return appUser;
};

export const updateUserProfile = async (uid: string, updates: Partial<AppUser>): Promise<void> => {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, updates);
};

export const getAllUsers = async (): Promise<AppUser[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((d) => d.data() as AppUser);
};

export const approveUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { approved: true });
};

export const rejectUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { approved: false });
};

export const changeUserRole = async (uid: string, role: UserRole): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { role });
};

// Delete user from Firestore only (Auth deletion needs Admin SDK or Cloud Function)
// We delete Firestore profile and mark as deleted
export const deleteUserAccount = async (uid: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid));
};

export const subscribeToAuthState = (
  callback: (user: FirebaseUser | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};

// Real-time users subscription (for online status)
export const subscribeToUsers = (callback: (users: AppUser[]) => void): Unsubscribe => {
  return onSnapshot(collection(db, 'users'), (snap) => {
    callback(snap.docs.map(d => d.data() as AppUser));
  }, () => callback([]));
};