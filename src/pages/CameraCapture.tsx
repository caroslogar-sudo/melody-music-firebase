import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Camera, Video, Square, RotateCcw, Check, X, Loader2, Image, Film, SwitchCamera } from 'lucide-react';
import { uploadFile, deleteFile } from '../services/storageService';
import { addTrackToFirestore } from '../services/trackService';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface PhotoEntry {
  id: string;
  uid: string;
  url: string;
  storagePath: string;
  title: string;
  createdAt: number;
}

export const CameraCapture = () => {
  const { user, refreshStorageUsage } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<PhotoEntry | null>(null);
  const [capturedVideoBlob, setCapturedVideoBlob] = useState<Blob | null>(null);
  const [capturedVideoUrl, setCapturedVideoUrl] = useState<string | null>(null);
  const [capturedVideoDuration, setCapturedVideoDuration] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to user photos
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

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === 'video',
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setCapturedPhoto(null);
      setCapturedBlob(null);
    } catch (err: any) {
      console.error('[Camera] Error:', err);
      alert('No se pudo acceder a la camara. Verifica los permisos.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setIsRecordingVideo(false);
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  };

  // Switch camera
  const switchCamera = () => {
    stopCamera();
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    setTimeout(() => startCamera(), 300);
  };

  // Restart when mode changes
  useEffect(() => {
    if (cameraActive) { stopCamera(); setTimeout(() => startCamera(), 200); }
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  // Take photo
  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(dataUrl);

    canvas.toBlob((blob) => {
      if (blob) setCapturedBlob(blob);
    }, 'image/jpeg', 0.9);

    stopCamera();
  };

  // Start video recording
  const startVideoRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
    });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecordingVideo(true);
    setRecordTime(0);
    recordTimerRef.current = setInterval(() => setRecordTime(p => p + 1), 1000);
  };

  // Stop video recording
  const stopVideoRecording = () => {
    return new Promise<Blob>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(new Blob()); return; }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        resolve(blob);
      };
      recorder.stop();
      if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
      setIsRecordingVideo(false);
      stopCamera();
    });
  };

  // Save photo
  const savePhoto = async () => {
    if (!capturedBlob || !user) return;
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
      const fileName = `foto_${dateStr}_${timeStr}.jpg`;
      const file = new File([capturedBlob], fileName, { type: 'image/jpeg' });
      const trackId = 'photo_' + Date.now();

      const { promise } = uploadFile(file, 'cover', trackId, () => {});
      const { url, storagePath } = await promise;

      await addDoc(collection(db, 'photos'), {
        uid: user.uid,
        url,
        storagePath,
        title: `Foto ${dateStr} ${timeStr}`,
        createdAt: Date.now(),
      });

      await refreshStorageUsage();
      setCapturedPhoto(null);
      setCapturedBlob(null);
      setSavedMsg('Foto guardada');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (err) {
      console.error('[Camera] Save photo error:', err);
      alert('Error al guardar la foto');
    }
    setSaving(false);
  };

  // Stop video recording → show preview (don't save yet)
  const handleStopVideo = async () => {
    const blob = await stopVideoRecording();
    if (blob.size === 0) return;
    setCapturedVideoDuration(recordTime);
    setCapturedVideoBlob(blob);
    setCapturedVideoUrl(URL.createObjectURL(blob));
  };

  // Save video after preview
  const saveVideo = async () => {
    if (!capturedVideoBlob || !user) return;
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const fileName = `grabacion_${dateStr}_${timeStr}.webm`;
      const file = new File([capturedVideoBlob], fileName, { type: 'video/webm' });
      const trackId = 'vidrec_' + Date.now();

      const { promise } = uploadFile(file, 'video', trackId, () => {});
      const { url, storagePath } = await promise;

      await addTrackToFirestore({
        title: `Grabacion ${dateStr} ${timeStr}`,
        artist: user.displayName,
        folder: 'Grabaciones en directo',
        coverUrl: '',
        src: url,
        storagePath,
        duration: capturedVideoDuration,
        type: 'video',
        fileSize: capturedVideoBlob.size,
        addedAt: Date.now(),
        addedBy: user.uid,
      });

      await refreshStorageUsage();
      discardVideo();
      setSavedMsg('Video guardado en Videos/Grabaciones en directo');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      console.error('[Camera] Save video error:', err);
      alert('Error al guardar el video');
    }
    setSaving(false);
  };

  // Discard captured video
  const discardVideo = () => {
    if (capturedVideoUrl) URL.revokeObjectURL(capturedVideoUrl);
    setCapturedVideoBlob(null);
    setCapturedVideoUrl(null);
    setCapturedVideoDuration(0);
  };

  // Delete photo
  const deletePhoto = async (photo: PhotoEntry) => {
    if (!window.confirm('Eliminar esta foto?')) return;
    try {
      await deleteDoc(doc(db, 'photos', photo.id));
      if (photo.storagePath) {
        try { await deleteFile(photo.storagePath, 0, 'cover'); } catch {}
      }
      if (viewingPhoto?.id === photo.id) setViewingPhoto(null);
    } catch {}
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Camera size={24} className="text-gold-400" /> Camara
      </h2>

      {/* Mode selector */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 flex-shrink-0">
        <button onClick={() => setMode('photo')}
          className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ' + (mode === 'photo' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Image size={16} /> Foto
        </button>
        <button onClick={() => setMode('video')}
          className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ' + (mode === 'video' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Film size={16} /> Video
        </button>
      </div>

      {savedMsg && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
          <p className="text-green-400 text-xs font-bold">{savedMsg}</p>
        </div>
      )}

      {/* Camera viewfinder */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] flex-shrink-0">
        <video ref={videoRef} playsInline muted autoPlay className={'w-full h-full object-cover ' + (capturedPhoto || capturedVideoUrl ? 'hidden' : '')} />
        <canvas ref={canvasRef} className="hidden" />

        {/* Photo preview */}
        {capturedPhoto && (
          <img src={capturedPhoto} alt="Captura" className="w-full h-full object-cover" />
        )}

        {/* Video preview */}
        {capturedVideoUrl && (
          <video src={capturedVideoUrl} controls playsInline className="w-full h-full object-cover" />
        )}

        {!cameraActive && !capturedPhoto && !capturedVideoUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              {mode === 'photo' ? <Camera size={32} className="text-gray-600" /> : <Video size={32} className="text-gray-600" />}
            </div>
            <button onClick={startCamera}
              className="bg-gold-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-95">
              Abrir camara
            </button>
          </div>
        )}

        {/* Recording indicator */}
        {isRecordingVideo && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-bold font-mono">{fmtTime(recordTime)}</span>
          </div>
        )}

        {/* Switch camera button */}
        {cameraActive && !capturedPhoto && !capturedVideoUrl && (
          <button onClick={switchCamera}
            className="absolute top-3 right-3 p-2 bg-black/50 rounded-full text-white active:scale-90">
            <SwitchCamera size={18} />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 flex-shrink-0">
        {/* PHOTO MODE */}
        {mode === 'photo' && cameraActive && !capturedPhoto && (
          <button onClick={takePhoto}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
        )}

        {mode === 'photo' && capturedPhoto && (
          <>
            <button onClick={() => { setCapturedPhoto(null); setCapturedBlob(null); startCamera(); }}
              className="p-3 bg-white/10 text-gray-300 rounded-full active:scale-90">
              <RotateCcw size={22} />
            </button>
            <button onClick={savePhoto} disabled={saving}
              className="px-6 py-3 bg-gold-500 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Guardando...' : 'Guardar foto'}
            </button>
            <button onClick={() => { setCapturedPhoto(null); setCapturedBlob(null); }}
              className="p-3 bg-red-500/10 text-red-400 rounded-full active:scale-90">
              <X size={22} />
            </button>
          </>
        )}

        {/* VIDEO MODE */}
        {mode === 'video' && cameraActive && !isRecordingVideo && !capturedVideoUrl && (
          <button onClick={startVideoRecording}
            className="w-16 h-16 rounded-full border-4 border-red-500 bg-red-500/20 flex items-center justify-center active:scale-90 transition-transform">
            <div className="w-12 h-12 rounded-full bg-red-500" />
          </button>
        )}

        {mode === 'video' && isRecordingVideo && (
          <button onClick={handleStopVideo}
            className="w-16 h-16 rounded-full border-4 border-red-500 bg-red-500/20 flex items-center justify-center active:scale-90 transition-transform">
            <Square size={24} fill="white" className="text-white" />
          </button>
        )}

        {mode === 'video' && capturedVideoUrl && !saving && (
          <>
            <button onClick={() => { discardVideo(); startCamera(); }}
              className="p-3 bg-white/10 text-gray-300 rounded-full active:scale-90">
              <RotateCcw size={22} />
            </button>
            <button onClick={saveVideo} disabled={saving}
              className="px-6 py-3 bg-gold-500 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Guardando...' : 'Guardar video'}
            </button>
            <button onClick={discardVideo}
              className="p-3 bg-red-500/10 text-red-400 rounded-full active:scale-90">
              <X size={22} />
            </button>
          </>
        )}

        {mode === 'video' && saving && (
          <div className="flex items-center gap-2 px-4 py-3 bg-gold-500/10 rounded-xl">
            <Loader2 size={16} className="animate-spin text-gold-400" />
            <span className="text-gold-400 text-sm font-bold">Guardando video...</span>
          </div>
        )}

        {/* Close camera */}
        {cameraActive && !capturedPhoto && !isRecordingVideo && !capturedVideoUrl && (
          <button onClick={stopCamera}
            className="absolute right-6 p-2 bg-black/50 text-white rounded-full active:scale-90">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Photo gallery */}
      {mode === 'photo' && photos.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">Mis Fotos ({photos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-black/30 cursor-pointer group"
                onClick={() => setViewingPhoto(photo)}>
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo viewer modal */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[250] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
          <img src={viewingPhoto.url} alt="" className="max-w-full max-h-[70vh] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <p className="text-gray-400 text-xs mt-3">{viewingPhoto.title}</p>
          <div className="flex gap-3 mt-3">
            <a href={viewingPhoto.url} download={viewingPhoto.title + '.jpg'} onClick={(e) => e.stopPropagation()}
              className="px-4 py-2 bg-gold-500 text-white rounded-xl text-xs font-bold active:scale-95">
              Descargar
            </a>
            <button onClick={(e) => { e.stopPropagation(); deletePhoto(viewingPhoto); }}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-xs font-bold active:scale-95">
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};