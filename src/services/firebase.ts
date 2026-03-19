import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC5xYQkRZG48Qc7dKhXX9Zh-KjiytvvfHk",
  authDomain: "melodi-music-d0dc9.firebaseapp.com",
  projectId: "melodi-music-d0dc9",
  storageBucket: "melodi-music-d0dc9.firebasestorage.app",
  messagingSenderId: "469715235089",
  appId: "1:469715235089:web:c7e9224accc0fcd4eb1cb0",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
