import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { AppUser } from '../types';

// Send WhatsApp message via CallMeBot API (free, personal use)
const sendWhatsApp = async (phone: string, apiKey: string, message: string): Promise<boolean> => {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (res.ok) {
      console.log(`[WhatsApp] Message sent to ${phone}`);
      return true;
    }
    console.warn(`[WhatsApp] Failed to send to ${phone}:`, res.status);
    return false;
  } catch (err) {
    console.error(`[WhatsApp] Error sending to ${phone}:`, err);
    return false;
  }
};

// Get all users with WhatsApp configured (phone + apiKey)
const getWhatsAppUsers = async (): Promise<{ phone: string; apiKey: string; name: string }[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users: { phone: string; apiKey: string; name: string }[] = [];
    snap.docs.forEach(d => {
      const u = d.data() as AppUser;
      if (u.phone && u.callmebotApiKey && u.approved) {
        users.push({ phone: u.phone, apiKey: u.callmebotApiKey, name: u.displayName });
      }
    });
    return users;
  } catch {
    return [];
  }
};

// Notify all users about a new photo
export const notifyNewPhoto = async (uploaderName: string, photoUrl: string): Promise<void> => {
  const users = await getWhatsAppUsers();
  if (users.length === 0) return;

  const message = `📸 *Melody Music*\n\n${uploaderName} ha subido una nueva foto.\n\n👉 Ver: ${photoUrl}`;

  for (const u of users) {
    await sendWhatsApp(u.phone, u.apiKey, message);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
};

// Notify all users about a new video
export const notifyNewVideo = async (uploaderName: string, title: string, videoUrl: string): Promise<void> => {
  const users = await getWhatsAppUsers();
  if (users.length === 0) return;

  const message = `🎬 *Melody Music*\n\n${uploaderName} ha subido un nuevo video: *${title}*\n\n👉 Ver: ${videoUrl}`;

  for (const u of users) {
    await sendWhatsApp(u.phone, u.apiKey, message);
    await new Promise(r => setTimeout(r, 1000));
  }
};

// Notify all users about a new music track
export const notifyNewMusic = async (uploaderName: string, title: string, artist: string): Promise<void> => {
  const users = await getWhatsAppUsers();
  if (users.length === 0) return;

  const message = `🎵 *Melody Music*\n\n${uploaderName} ha subido nueva musica:\n*${title}* - ${artist}`;

  for (const u of users) {
    await sendWhatsApp(u.phone, u.apiKey, message);
    await new Promise(r => setTimeout(r, 1000));
  }
};

// Generic notification
export const notifyAllUsers = async (message: string): Promise<void> => {
  const users = await getWhatsAppUsers();
  for (const u of users) {
    await sendWhatsApp(u.phone, u.apiKey, message);
    await new Promise(r => setTimeout(r, 1000));
  }
};