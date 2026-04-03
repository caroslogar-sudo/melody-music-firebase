import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Image, Trash2, Download, X, Camera, RotateCw, Sun, Contrast, Crop, FlipHorizontal, Share2 } from 'lucide-react';
import { collection, onSnapshot, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { deleteFile, uploadFile } from '../services/storageService';

interface PhotoEntry {
  id: string;
  uid: string;
  url: string;
  storagePath: string;
  title: string;
  createdAt: number;
}

export const Photos = () => {
  const { user, refreshStorageUsage } = useApp();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [viewing, setViewing] = useState<PhotoEntry | null>(null);
  const [editing, setEditing] = useState<PhotoEntry | null>(null);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [flipH, setFlipH] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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

  // Force download (bypasses CORS issues with Firebase Storage URLs)
  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleShare = async (url: string, title: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `${title}.${ext}`, { type: blob.type });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, files: [file] });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`📸 ${title}\n${url}`)}`, '_blank');
      }
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`📸 ${title}\n${url}`)}`, '_blank');
    }
  };

  // Open editor
  const openEditor = (photo: PhotoEntry) => {
    setEditing(photo);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setFlipH(false);
    setViewing(null);
  };

  // Save edited photo (overwrites original)
  const saveEditedPhoto = async () => {
    if (!editing || !imgRef.current || !canvasRef.current || !user) return;
    setSavingEdit(true);
    try {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      const isRotated = rotation === 90 || rotation === 270;
      canvas.width = isRotated ? img.naturalHeight : img.naturalWidth;
      canvas.height = isRotated ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext('2d')!;

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
      });

      const file = new File([blob], 'edited.jpg', { type: 'image/jpeg' });
      const trackId = 'photo_edit_' + Date.now();
      const { promise } = uploadFile(file, 'cover', trackId, () => {});
      const { url, storagePath } = await promise;

      // Update Firestore doc with new URL
      await updateDoc(doc(db, 'photos', editing.id), { url, storagePath });

      // Delete old file from storage
      if (editing.storagePath) {
        try { await deleteFile(editing.storagePath, 0, 'cover'); } catch {}
      }

      await refreshStorageUsage();
      setEditing(null);
    } catch (err) {
      console.error('[Photos] Save edit error:', err);
      alert('Error al guardar la edicion');
    }
    setSavingEdit(false);
  };

  const editorStyle = editing ? {
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
  } : {};

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

          <div className="flex gap-2 mt-3 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleDownload(viewing.url, viewing.title + '.jpg')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-white rounded-xl text-xs font-bold active:scale-95">
              <Download size={14} /> Descargar
            </button>
            <button onClick={() => handleShare(viewing.url, viewing.title)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-xs font-bold active:scale-95 border border-green-500/20">
              <Share2 size={14} /> Compartir
            </button>
            <button onClick={() => openEditor(viewing)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold active:scale-95 border border-blue-500/20">
              <Sun size={14} /> Editar
            </button>
            <button onClick={() => handleDelete(viewing)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-xs font-bold active:scale-95 border border-red-500/20">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Photo editor */}
      {editing && (
        <div className="fixed inset-0 z-[260] bg-black flex flex-col">
          <canvas ref={canvasRef} className="hidden" />
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-black/80 border-b border-white/10 flex-shrink-0">
            <button onClick={() => setEditing(null)} className="text-gray-400 text-sm px-3 py-1.5 rounded-lg hover:text-white">
              Cancelar
            </button>
            <p className="text-white text-sm font-bold">Editar foto</p>
            <button onClick={saveEditedPhoto} disabled={savingEdit}
              className="bg-gold-500 text-white text-sm px-4 py-1.5 rounded-lg font-bold active:scale-95 disabled:opacity-50">
              {savingEdit ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
            <img ref={imgRef} src={editing.url} alt="" crossOrigin="anonymous"
              className="max-w-full max-h-full object-contain rounded-lg transition-all duration-200"
              style={editorStyle} />
          </div>

          {/* Controls */}
          <div className="bg-[#111] border-t border-white/10 p-4 space-y-3 flex-shrink-0">
            {/* Quick actions */}
            <div className="flex justify-center gap-4">
              <button onClick={() => setRotation((rotation + 90) % 360)}
                className="flex flex-col items-center gap-1 text-gray-400 hover:text-white active:scale-90">
                <RotateCw size={20} />
                <span className="text-[9px]">Rotar</span>
              </button>
              <button onClick={() => setFlipH(!flipH)}
                className={'flex flex-col items-center gap-1 active:scale-90 ' + (flipH ? 'text-gold-400' : 'text-gray-400 hover:text-white')}>
                <FlipHorizontal size={20} />
                <span className="text-[9px]">Voltear</span>
              </button>
            </div>

            {/* Brightness */}
            <div className="flex items-center gap-3">
              <Sun size={14} className="text-yellow-400 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 w-12">Brillo</span>
              <input type="range" min="30" max="200" value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:rounded-full" />
              <span className="text-[10px] text-gray-500 w-8 text-right">{brightness}%</span>
            </div>

            {/* Contrast */}
            <div className="flex items-center gap-3">
              <Contrast size={14} className="text-blue-400 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 w-12">Contraste</span>
              <input type="range" min="30" max="200" value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full" />
              <span className="text-[10px] text-gray-500 w-8 text-right">{contrast}%</span>
            </div>

            {/* Reset */}
            <button onClick={() => { setRotation(0); setBrightness(100); setContrast(100); setFlipH(false); }}
              className="w-full text-center text-[10px] text-gray-500 hover:text-white py-1">
              Restablecer valores originales
            </button>
          </div>
        </div>
      )}
    </div>
  );
};