import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface WhatsAppConfig {
  phone: string;    // Master's phone with country code
  apiKey: string;   // CallMeBot API key
  enabled: boolean;
}

// Get WhatsApp config from Firestore
export const getWhatsAppConfig = async (): Promise<WhatsAppConfig | null> => {
  try {
    const snap = await getDoc(doc(db, 'config', 'whatsapp'));
    if (snap.exists()) {
      const data = snap.data() as WhatsAppConfig;
      if (data.phone && data.apiKey && data.enabled) return data;
    }
  } catch {}
  return null;
};

// Save WhatsApp config
export const saveWhatsAppConfig = async (config: WhatsAppConfig): Promise<void> => {
  await setDoc(doc(db, 'config', 'whatsapp'), config);
};

// Send WhatsApp message via CallMeBot to Master
const sendToMaster = async (message: string): Promise<boolean> => {
  const config = await getWhatsAppConfig();
  if (!config) return false;

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(config.phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(config.apiKey)}`;
    const res = await fetch(url);
    if (res.ok) {
      console.log('[WhatsApp] Message sent to Master');
      return true;
    }
    console.warn('[WhatsApp] Failed:', res.status);
    return false;
  } catch (err) {
    console.error('[WhatsApp] Error:', err);
    return false;
  }
};

// Notify new photo
export const notifyNewPhoto = async (uploaderName: string, photoUrl: string): Promise<void> => {
  await sendToMaster(`📸 *Melody Music*\n\n${uploaderName} ha subido una nueva foto.\n\n👉 ${photoUrl}`);
};

// Notify new video
export const notifyNewVideo = async (uploaderName: string, title: string, videoUrl: string): Promise<void> => {
  await sendToMaster(`🎬 *Melody Music*\n\n${uploaderName} ha subido un nuevo video: *${title}*\n\n👉 ${videoUrl}`);
};

// Notify new music
export const notifyNewMusic = async (uploaderName: string, title: string, folder: string): Promise<void> => {
  await sendToMaster(`🎵 *Melody Music*\n\n${uploaderName} ha subido nueva musica:\n*${title}*\nCarpeta: ${folder}`);
};