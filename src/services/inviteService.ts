import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs, query, where, deleteDoc, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Invitation {
  id: string;
  code: string;
  createdBy: string; // master uid
  createdAt: number;
  email?: string; // optional: target email
  used: boolean;
  usedBy?: string; // uid of who registered
  usedAt?: number;
  expiresAt: number;
}

const INV_COL = 'invitations';

const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

export const createInvitation = async (createdBy: string, email?: string): Promise<Invitation> => {
  const code = generateCode();
  const data = {
    code,
    createdBy,
    createdAt: Date.now(),
    email: email || '',
    used: false,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const ref = await addDoc(collection(db, INV_COL), data);
  return { id: ref.id, ...data };
};

export const validateInvitationCode = async (code: string): Promise<Invitation | null> => {
  const q = query(collection(db, INV_COL), where('code', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc0 = snap.docs[0];
  const inv = { id: doc0.id, ...doc0.data() } as Invitation;
  if (inv.used) return null;
  if (inv.expiresAt < Date.now()) return null;
  return inv;
};

export const markInvitationUsed = async (id: string, uid: string): Promise<void> => {
  await updateDoc(doc(db, INV_COL, id), { used: true, usedBy: uid, usedAt: Date.now() });
};

export const subscribeToInvitations = (callback: (invs: Invitation[]) => void): Unsubscribe => {
  return onSnapshot(collection(db, INV_COL), (snap) => {
    const invs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Invitation))
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(invs);
  }, () => callback([]));
};

export const deleteInvitation = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, INV_COL, id));
};

export const getInviteUrl = (code: string): string => {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/register?code=${code}`;
};

export const getWhatsAppShareUrl = (code: string, appName: string = 'Melody Music'): string => {
  const url = getInviteUrl(code);
  const text = encodeURIComponent(
    `Te invito a unirte a ${appName}! Usa este enlace para registrarte:\n\n${url}\n\nCodigo: ${code}`
  );
  return `https://wa.me/?text=${text}`;
};

export const getEmailShareUrl = (code: string, targetEmail?: string): string => {
  const url = getInviteUrl(code);
  const subject = encodeURIComponent('Invitacion a Melody Music');
  const body = encodeURIComponent(
    `Hola!\n\nTe invito a unirte a Melody Music, nuestra plataforma de musica privada.\n\nRegistrate aqui: ${url}\n\nCodigo de invitacion: ${code}\n\nEl codigo expira en 7 dias.`
  );
  const to = targetEmail ? encodeURIComponent(targetEmail) : '';
  return `mailto:${to}?subject=${subject}&body=${body}`;
};