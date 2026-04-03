import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Camera, Video, Check, X, Loader2, Image, Film, RotateCcw } from 'lucide-react';
import { uploadFile } from '../services/storageService';
import { addTrackToFirestore } from '../services/trackService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { notifyNewPhoto, notifyNewVideo } from '../services/whatsappService';

export const CameraCapture = () => {
  const { user, refreshStorageUsage } = useApp();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // Handle file captured from native camera
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewFile(file);
    e.target.value = '';
  };

  // Save photo to Firebase (original quality, optimized speed)
  const savePhoto = async () => {
    if (!previewFile || !user) return;
    setSaving(true);
    setUploadProgress(0);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
      const ext = previewFile.name.split('.').pop() || 'jpg';
      const fileName = `foto_${dateStr}_${timeStr}.${ext}`;
      const finalFile = new File([previewFile], fileName, { type: previewFile.type });
      const trackId = 'photo_' + Date.now();

      // Upload with progress
      const { promise } = uploadFile(finalFile, 'cover', trackId, setUploadProgress);
      const { url, storagePath } = await promise;

      // Reset UI immediately — don't wait for Firestore/notifications
      discardPreview();
      setSavedMsg('Foto guardada');
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 2500);

      // Firestore + notifications in background (non-blocking)
      addDoc(collection(db, 'photos'), {
        uid: user.uid, url, storagePath,
        title: `Foto ${dateStr} ${timeStr}`, createdAt: Date.now(),
      }).catch(() => {});
      refreshStorageUsage().catch(() => {});
      notifyNewPhoto(user.displayName, url).catch(() => {});
    } catch (err) {
      console.error('[Camera] Save photo error:', err);
      alert('Error al guardar la foto');
      setSaving(false);
    }
  };

  // Save video to Firebase (optimized)
  const saveVideo = async () => {
    if (!previewFile || !user) return;
    setSaving(true);
    setUploadProgress(0);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const ext = previewFile.name.split('.').pop() || 'mp4';
      const fileName = `grabacion_${dateStr}_${timeStr}.${ext}`;
      const renamedFile = new File([previewFile], fileName, { type: previewFile.type });
      const trackId = 'vidrec_' + Date.now();

      // Get duration IN PARALLEL with upload
      const durationPromise = new Promise<number>((resolve) => {
        const tempVid = document.createElement('video');
        tempVid.preload = 'metadata';
        tempVid.onloadedmetadata = () => { resolve(Math.round(tempVid.duration)); URL.revokeObjectURL(tempVid.src); };
        tempVid.onerror = () => resolve(0);
        tempVid.src = URL.createObjectURL(previewFile);
        setTimeout(() => resolve(0), 3000); // timeout fallback
      });

      // Upload with progress
      const { promise } = uploadFile(renamedFile, 'video', trackId, setUploadProgress);

      // Wait for both in parallel
      const [{ url, storagePath }, duration] = await Promise.all([promise, durationPromise]);

      // Reset UI immediately
      discardPreview();
      setSavedMsg('Video guardado');
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 3000);

      // Firestore + notifications in background (non-blocking)
      addTrackToFirestore({
        title: `Grabacion ${dateStr} ${timeStr}`,
        artist: user.displayName,
        folder: 'Grabaciones en directo',
        coverUrl: '', src: url, storagePath, duration,
        type: 'video', fileSize: previewFile.size,
        addedAt: Date.now(), addedBy: user.uid,
      }).catch(() => {});
      refreshStorageUsage().catch(() => {});
      notifyNewVideo(user.displayName, `Grabacion ${dateStr} ${timeStr}`, url).catch(() => {});
    } catch (err) {
      console.error('[Camera] Save video error:', err);
      alert('Error al guardar el video');
      setSaving(false);
    }
  };

  // Discard preview
  const discardPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Camera size={24} className="text-gold-400" /> Camara
      </h2>

      {/* Hidden native camera inputs */}
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleCapture} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" capture="environment"
        onChange={handleCapture} className="hidden" />

      {/* Mode selector */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 flex-shrink-0">
        <button onClick={() => { setMode('photo'); discardPreview(); }}
          className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ' + (mode === 'photo' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Image size={16} /> Foto
        </button>
        <button onClick={() => { setMode('video'); discardPreview(); }}
          className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ' + (mode === 'video' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Film size={16} /> Video
        </button>
      </div>

      {savedMsg && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
          <p className="text-green-400 text-xs font-bold">{savedMsg}</p>
        </div>
      )}

      {/* Preview area */}
      {previewUrl ? (
        <>
          <div className="relative bg-black rounded-2xl overflow-hidden flex-shrink-0">
            {mode === 'photo' ? (
              <img src={previewUrl} alt="Preview" className="w-full max-h-[50vh] object-contain" />
            ) : (
              <video src={previewUrl} controls playsInline className="w-full max-h-[50vh] object-contain" />
            )}
          </div>

          {/* File info */}
          {previewFile && (
            <p className="text-[10px] text-gray-500 text-center">
              {previewFile.name} · {formatSize(previewFile.size)}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 flex-shrink-0">
            {!saving && (
              <button onClick={() => { discardPreview(); (mode === 'photo' ? photoInputRef : videoInputRef).current?.click(); }}
                className="p-3 bg-white/10 text-gray-300 rounded-full active:scale-90" title="Repetir">
                <RotateCcw size={22} />
              </button>
            )}
            <button onClick={mode === 'photo' ? savePhoto : saveVideo} disabled={saving}
              className="px-6 py-3 bg-gold-500 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? `${uploadProgress}%` : mode === 'photo' ? 'Guardar foto' : 'Guardar video'}
            </button>
            {!saving && (
              <button onClick={discardPreview}
                className="p-3 bg-red-500/10 text-red-400 rounded-full active:scale-90" title="Descartar">
                <X size={22} />
              </button>
            )}
          </div>

          {/* Upload progress bar */}
          {saving && (
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gold-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </>
      ) : (
        /* No preview — show capture buttons */
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
            {mode === 'photo' ? <Camera size={48} className="text-gray-600" /> : <Video size={48} className="text-gray-600" />}
          </div>

          <button onClick={() => (mode === 'photo' ? photoInputRef : videoInputRef).current?.click()}
            className="bg-gold-500 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 flex items-center gap-2">
            {mode === 'photo' ? <><Camera size={18} /> Tomar foto</> : <><Video size={18} /> Grabar video</>}
          </button>

          <p className="text-xs text-gray-600 text-center px-8">
            Se abrira la camara de tu telefono con todas sus funciones.
            {mode === 'photo' ? ' La foto se mostrara aqui para revisarla antes de guardar.' : ' El video se mostrara aqui para revisarlo antes de guardar.'}
          </p>
        </div>
      )}
    </div>
  );
};