import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Image, Trash2, Download, X, Camera } from 'lucide-react';
import { collection, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { deleteFile } from '../services/storageService';

interface PhotoEntry {
  id: string;
  uid: string;
  url: string;
  storagePath: string;
  title: string;
  createdAt: number;
}

export const Photos = () => {
  const { user } = useApp();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [viewing, setViewing] = useState<PhotoEntry | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'photos'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as PhotoEntry))
        .sort((a, b) => b.createdAt - a.createdAt);
      setPhotos(items);
    }, () => {});
    return () => unsub();
  }, [user?.uid]);

  const handleDelete = async (photo: PhotoEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Eliminar esta foto?')) return;
    try {
      await deleteDoc(doc(db, 'photos', photo.id));
      if (photo.storagePath) { try { await deleteFile(photo.storagePath, 0, 'cover'); } catch {} }
      if (viewing?.id === photo.id) setViewing(null);
    } catch {}
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Hoy';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer';
    else label = d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    return label + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Image size={24} className="text-gold-400" /> Mis Fotos
        </h2>
        <a href="#/camera"
          className="flex items-center gap-1.5 bg-gold-500 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95">
          <Camera size={14} /> Nueva foto
        </a>
      </div>

      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30">
          <Image size={48} className="mb-3 opacity-30" />
          <p className="text-lg">Sin fotos</p>
          <p className="text-sm text-gray-600 mt-1">Usa la camara para tomar tu primera foto</p>
          <a href="#/camera"
            className="mt-4 bg-gold-500 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95">
            Abrir camara
          </a>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <p className="text-[10px] text-gray-500 mb-2 px-1">{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {photos.map(photo => (
              <div key={photo.id}
                className="relative aspect-square rounded-xl overflow-hidden bg-black/30 cursor-pointer group"
                onClick={() => setViewing(photo)}>
                <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="absolute bottom-1 left-1.5 right-1.5 text-[8px] text-white/70 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatDate(photo.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {viewing && (
        <div className="fixed inset-0 z-[250] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setViewing(null)}>
          <button className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white z-10" onClick={() => setViewing(null)}>
            <X size={24} />
          </button>

          <img src={viewing.url} alt="" className="max-w-full max-h-[75vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()} />

          <p className="text-gray-400 text-sm mt-4">{formatDate(viewing.createdAt)}</p>

          <div className="flex gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
            <a href={viewing.url} download={viewing.title + '.jpg'} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-white rounded-xl text-xs font-bold active:scale-95">
              <Download size={14} /> Descargar
            </a>
            <button onClick={() => handleDelete(viewing)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-xs font-bold active:scale-95 border border-red-500/20">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};