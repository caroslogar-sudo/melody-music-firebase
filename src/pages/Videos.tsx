import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { UploadProgress } from '../components/ui/UploadProgress';
import { uploadFile, canUpload } from '../services/storageService';
import { addTrackToFirestore } from '../services/trackService';
import { Upload, Play, Trash2, FolderPlus, ArrowLeft, Film, Edit2, FolderInput, X, Clock, Calendar, MapPin, Search, Share2, Users, Download } from 'lucide-react';
import { Track, UserRole } from '../types';

// Generate thumbnail from video first frame using hidden video element
const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.setAttribute('crossorigin', 'anonymous');

    const timeoutId = setTimeout(() => {
      video.src = '';
      resolve('');
    }, 8000);

    video.onloadeddata = () => {
      // Seek to 1 second for a better frame
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          // Check if canvas actually rendered something (not blank)
          if (dataUrl.length > 1000) {
            resolve(dataUrl);
          } else {
            resolve('');
          }
        } else {
          resolve('');
        }
      } catch (err) {
        // CORS error - cannot use canvas
        resolve('VIDEO_ELEMENT');
      }
      video.src = '';
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      resolve('');
    };

    video.src = videoUrl;
    video.load();
  });
};

export const Videos = () => {
  const { library, playQueue, removeTrackToTrash, updateTrack, isPlaying, togglePlay, user, renameFolder, deleteFolder, refreshStorageUsage, groups, users } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<{ old: string; new: string } | null>(null);
  const [movingFolder, setMovingFolder] = useState<string | null>(null);
  const [targetMoveFolderDest, setTargetMoveFolderDest] = useState('');
  const [editingVideo, setEditingVideo] = useState<{ id: string; title: string; artist: string } | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingVideo, setMovingVideo] = useState<Track | null>(null);
  const [targetMoveFolder, setTargetMoveFolder] = useState('');
  const [viewingVideo, setViewingVideo] = useState<Track | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error' | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [shareWith, setShareWith] = useState<string[]>([]);

  const isMaster = user?.role === UserRole.MASTER;
  const isAdmin = user?.role === UserRole.ADMIN || isMaster;

  // Folder access control
  const hasFullAccess = isMaster || !user?.allowedFolders || user.allowedFolders.length === 0 || user.allowedFolders.includes('*');
  const canAccessTrack = (track: Track): boolean => {
    if (hasFullAccess) return true;
    const folder = track.folder || 'General';
    const allowed = user?.allowedFolders || [];
    return allowed.some(af => folder === af || folder.startsWith(af + '/'));
  };

  const videoTracks = useMemo(() => library.filter((t) => t.type === 'video' && canAccessTrack(t)), [library, user]);

  // Search results across ALL video tracks
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return videoTracks.filter(t =>
      t.title !== '.keep' &&
      (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    );
  }, [searchQuery, videoTracks]);

  // Generate thumbnails for videos
  useEffect(() => {
    videoTracks.forEach(async (track) => {
      if (!thumbnails[track.id] && track.src && track.title !== '.keep') {
        const thumb = track.videoThumbnail || await generateVideoThumbnail(track.src);
        if (thumb) setThumbnails((prev) => ({ ...prev, [track.id]: thumb }));
      }
    });
  }, [videoTracks]);

  const { subFolders, currentFiles } = useMemo(() => {
    const foldersMap = new Map<string, Track[]>();
    const files: Track[] = [];
    videoTracks.forEach((track) => {
      const trackPath = track.folder || 'General';
      if (!currentFolder) {
        const root = trackPath.split('/')[0];
        if (!foldersMap.has(root)) foldersMap.set(root, []);
        foldersMap.get(root)!.push(track);
      } else {
        if (trackPath === currentFolder) files.push(track);
        else if (trackPath.startsWith(currentFolder + '/')) {
          const rel = trackPath.slice(currentFolder.length + 1).split('/')[0];
          if (!foldersMap.has(rel)) foldersMap.set(rel, []);
          foldersMap.get(rel)!.push(track);
        }
      }
    });
    return { subFolders: foldersMap, currentFiles: files };
  }, [videoTracks, currentFolder]);

  const existingFolders = useMemo(() => Array.from(new Set(videoTracks.map((t) => t.folder || 'General'))), [videoTracks]);

  // Get all video tracks inside a folder (including subfolders)
  const getAllFolderTracks = (folderPath: string): Track[] => {
    return videoTracks.filter(t => {
      const tp = t.folder || 'General';
      return (tp === folderPath || tp.startsWith(folderPath + '/')) && t.title !== '.keep';
    });
  };

  const playFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tracks = getAllFolderTracks(folderPath);
    if (tracks.length > 0) playQueue(tracks, 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user) return;

    const files = Array.from(fileList);
    let targetPath = folderName.trim() ? (currentFolder && !folderName.includes('/') ? `${currentFolder}/${folderName.trim()}` : folderName.trim()) : (currentFolder || 'General');

    setShowUploadMenu(false);
    setFolderName('');
    setUploadTotal(files.length);
    setUploadCurrent(0);
    setUploadStatus('uploading');
    setUploadWarning('');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setUploadCurrent(i + 1);
      setUploadFileName(f.name);
      setUploadProgress(0);

      const check = await canUpload(f.size);
      if (!check.allowed) { errorCount++; setUploadWarning(check.message); continue; }

      const trackId = Date.now().toString() + '_' + i;
      try {
        const { promise } = uploadFile(f, 'video', trackId, (p) => setUploadProgress(p));
        const { url, storagePath } = await promise;
        const trackData: any = { title: f.name.replace(/\.[^/.]+$/, ''), artist: 'Video Local', folder: targetPath, coverUrl: '', src: url, storagePath, duration: 0, type: 'video', fileSize: f.size, addedAt: Date.now() + i, addedBy: user.uid };
        if (shareWith.length > 0) trackData.sharedWith = shareWith;
        await addTrackToFirestore(trackData);
        successCount++;
      } catch (err) { console.error('Upload error:', f.name, err); errorCount++; }
    }

    setShareWith([]);
    await refreshStorageUsage();
    if (errorCount === 0) {
      setUploadStatus('success');
      setUploadFileName(`${successCount} video${successCount !== 1 ? 's' : ''} subido${successCount !== 1 ? 's' : ''}`);
    } else {
      setUploadStatus('error');
      setUploadFileName(`${successCount} subido${successCount !== 1 ? 's' : ''}, ${errorCount} error${errorCount !== 1 ? 'es' : ''}`);
    }
    setTimeout(() => { setUploadStatus(null); setUploadTotal(0); setUploadCurrent(0); }, 4000);
    e.target.value = '';
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const fullPath = currentFolder ? `${currentFolder}/${newFolderName.trim()}` : newFolderName.trim();
    await addTrackToFirestore({ title: '.keep', artist: 'System', coverUrl: '', src: '', storagePath: '', duration: 0, type: 'video', fileSize: 0, addedAt: Date.now(), addedBy: user.uid, folder: fullPath });
    setShowCreateFolder(false); setNewFolderName('');
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '--:--';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const displayFiles = currentFiles.filter((t) => t.title !== '.keep');

  return (
    <div className="flex flex-col gap-6 h-full relative" onClick={() => showUploadMenu && setShowUploadMenu(false)}>
      {uploadStatus && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
          <div className={'rounded-xl p-3 shadow-2xl border backdrop-blur-xl ' + (
            uploadStatus === 'uploading' ? 'bg-[#0d1525]/95 border-blue-500/30' :
            uploadStatus === 'success' ? 'bg-[#0d1a15]/95 border-green-500/30' :
            'bg-[#1a0d0d]/95 border-red-500/30'
          )}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{uploadFileName}</p>
                {uploadStatus === 'uploading' && uploadTotal > 1 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Archivo {uploadCurrent} de {uploadTotal}</p>
                )}
                {uploadWarning && <p className="text-[10px] text-yellow-400 mt-0.5">{uploadWarning}</p>}
              </div>
              <span className={'text-xs font-bold ' + (
                uploadStatus === 'uploading' ? 'text-blue-400' : uploadStatus === 'success' ? 'text-green-400' : 'text-red-400'
              )}>
                {uploadStatus === 'uploading' ? `${uploadProgress}%` : uploadStatus === 'success' ? 'OK' : 'Error'}
              </span>
            </div>
            {uploadStatus === 'uploading' && (
              <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            {uploadStatus === 'uploading' && uploadTotal > 1 && (
              <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gold-500/60 rounded-full transition-all duration-300" style={{ width: `${(uploadCurrent / uploadTotal) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {viewingVideo && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-10">
              <div><h2 className="text-white text-xl font-bold">{viewingVideo.title}</h2></div>
              <div className="flex items-center gap-2">
                <a href={viewingVideo.src} download={viewingVideo.title + '.webm'} target="_blank" rel="noopener noreferrer"
                  className="p-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-full transition-colors" title="Descargar">
                  <Download size={20} />
                </a>
                <button onClick={() => setViewingVideo(null)} className="p-2 bg-white/10 hover:bg-red-500 text-white rounded-full transition-colors"><X size={24} /></button>
              </div>
            </div>
            <video src={viewingVideo.src} className="w-full h-full object-contain" controls autoPlay />
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-sm bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4"><FolderPlus size={20} className="text-gold-400 inline mr-2" />Nueva Subcarpeta</h3>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nombre" autoFocus className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white placeholder-gray-500" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateFolder(false)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Crear</button>
            </div>
          </GlassCard>
        </div>
      )}

      {editingFolder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-sm bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Renombrar Carpeta</h3>
            <input type="text" value={editingFolder.new} onChange={(e) => setEditingFolder({ ...editingFolder, new: e.target.value })} autoFocus className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingFolder(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={async () => { if (editingFolder.new.trim()) { await renameFolder(editingFolder.old, editingFolder.new.trim()); setEditingFolder(null); }}} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Guardar</button>
            </div>
          </GlassCard>
        </div>
      )}

      {movingFolder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-sm bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FolderInput size={20} className="text-blue-400" /> Mover Carpeta
            </h3>
            <p className="text-xs text-gray-400 mb-4 truncate">Mover: <span className="text-white font-medium">{movingFolder.split('/').pop()}</span></p>
            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Destino</label>
            <input type="text" value={targetMoveFolderDest} onChange={(e) => setTargetMoveFolderDest(e.target.value)}
              placeholder="Ej: Viajes" list="move-vfolder-dest" autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white placeholder-gray-500" />
            <datalist id="move-vfolder-dest">{existingFolders.map((f) => <option key={f} value={f} />)}</datalist>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMovingFolder(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={async () => {
                if (!movingFolder || !targetMoveFolderDest.trim()) return;
                const folderBaseName = movingFolder.includes('/') ? movingFolder.split('/').pop()! : movingFolder;
                const newPath = targetMoveFolderDest.trim() + '/' + folderBaseName;
                await renameFolder(movingFolder, newPath);
                setMovingFolder(null); setTargetMoveFolderDest('');
              }} disabled={!targetMoveFolderDest.trim()} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">Mover</button>
            </div>
          </GlassCard>
        </div>
      )}

      {editingVideo && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Editar Video</h3>
            <div className="space-y-3">
              <div><label className="text-xs uppercase font-bold text-gray-400">Título</label>
                <input type="text" value={editingVideo.title} onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg p-2 outline-none focus:border-gold-400 text-white" /></div>
              <div><label className="text-xs uppercase font-bold text-gray-400">Autor</label>
                <input type="text" value={editingVideo.artist} onChange={(e) => setEditingVideo({ ...editingVideo, artist: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg p-2 outline-none focus:border-gold-400 text-white" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingVideo(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={async () => { if (editingVideo) { await updateTrack(editingVideo.id, { title: editingVideo.title, artist: editingVideo.artist }); setEditingVideo(null); }}} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Guardar</button>
            </div>
          </GlassCard>
        </div>
      )}

      {movingVideo && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-sm bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4"><FolderInput size={20} className="text-gold-400 inline mr-2" />Mover Video</h3>
            <input type="text" value={targetMoveFolder} onChange={(e) => setTargetMoveFolder(e.target.value)} placeholder="Ej: Videos/Favoritos" list="mv-vid" autoFocus className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white placeholder-gray-500" />
            <datalist id="mv-vid">{existingFolders.map((f) => <option key={f} value={f} />)}</datalist>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMovingVideo(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={async () => { if (movingVideo && targetMoveFolder.trim()) { await updateTrack(movingVideo.id, { folder: targetMoveFolder.trim() }); setMovingVideo(null); setTargetMoveFolder(''); }}} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Mover</button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-20">
        <div className="flex items-center gap-2 flex-wrap">
          {currentFolder && <button onClick={() => { const p = currentFolder.split('/'); setCurrentFolder(p.length > 1 ? p.slice(0, -1).join('/') : null); }} className="p-2 bg-white/20 rounded-full text-white flex-shrink-0"><ArrowLeft size={18} /></button>}
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 drop-shadow-md">
            {currentFolder ? (<><span className="text-gold-200 opacity-70 font-normal text-base hidden sm:inline">Videos /</span><span className="truncate max-w-[150px] sm:max-w-none">{currentFolder.split('/').pop()}</span></>) : 'Mis Videos'}
          </h2>
          {isAdmin && <button onClick={() => setShowCreateFolder(!showCreateFolder)} className="p-2 bg-white/10 text-gold-200 rounded-lg flex items-center gap-1 text-xs font-semibold border border-white/10 flex-shrink-0"><FolderPlus size={16} /><span className="hidden sm:inline">Nueva Carpeta</span></button>}
        </div>
        {isAdmin && (
          <div className="relative w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" multiple className="hidden" />
            <button onClick={() => setShowUploadMenu(!showUploadMenu)} className="w-full sm:w-auto bg-elegant-black border border-gold-500/50 text-gold-100 px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg text-sm"><Upload size={16} /><span>Subir Video</span></button>
            {showUploadMenu && (
              <div className="absolute top-full right-0 left-0 sm:left-auto mt-3 w-full sm:w-80 bg-gray-900/95 border border-gold-200 rounded-2xl shadow-2xl p-5 animate-fade-in flex flex-col gap-4 z-50">
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <FolderPlus size={18} className="text-gold-500" /><span>Organizar en carpeta</span>
                  </div>
                </div>
                <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)}
                  placeholder={currentFolder ? 'Nueva subcarpeta...' : 'Ej: Vacaciones'} list="video-folder-suggestions" autoFocus
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400 text-white placeholder-gray-500" />
                <datalist id="video-folder-suggestions">{existingFolders.map((f) => <option key={f} value={f} />)}</datalist>
                <p className="text-[9px] text-gray-500 ml-1">Deja vacio para usar: {currentFolder || 'General'}</p>

                {/* Share with - Master only */}
                {isMaster && (users.length > 1 || groups.length > 0) && (
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center gap-2 text-white font-bold text-xs mb-2"><Share2 size={14} className="text-gold-400" /> Compartir con</div>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {groups.map(g => (
                        <label key={'g_'+g.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer text-xs">
                          <input type="checkbox" checked={shareWith.includes('group:'+g.id)}
                            onChange={() => { const k = 'group:'+g.id; setShareWith(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]); }}
                            className="accent-gold-500 w-3.5 h-3.5" />
                          <Users size={12} className="text-blue-400" /><span className="text-white">{g.name}</span>
                        </label>
                      ))}
                      {users.filter(u => u.role !== UserRole.MASTER).map(u => (
                        <label key={'u_'+u.uid} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer text-xs">
                          <input type="checkbox" checked={shareWith.includes(u.uid)}
                            onChange={() => setShareWith(prev => prev.includes(u.uid) ? prev.filter(x=>x!==u.uid) : [...prev, u.uid])}
                            className="accent-gold-500 w-3.5 h-3.5" />
                          <span className="text-white">{u.displayName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setShowUploadMenu(false); setFolderName(''); setShareWith([]); }}
                    className="flex-1 bg-white/10 text-gray-300 py-2.5 rounded-lg font-bold text-sm border border-white/10 hover:bg-white/20 transition-colors">Cancelar</button>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-gold-400 text-white py-2.5 rounded-lg font-bold text-sm shadow-md">Seleccionar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar videos..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-gold-400 text-white placeholder-gray-500"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search Results */}
        {searchResults !== null ? (
          <div>
            {searchResults.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-400 mb-3">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</p>
                {searchResults.map((track) => {
                  const thumb = thumbnails[track.id] || '';
                  return (
                    <div key={track.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setViewingVideo(track)}>
                      <div className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                        {thumb && thumb !== 'VIDEO_ELEMENT' ? (
                          <img src={thumb} alt="" className="w-full h-full object-contain bg-black" />
                        ) : (
                          <video src={track.src} muted preload="metadata" className="w-full h-full object-contain bg-black pointer-events-none"
                            onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{track.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{track.artist} · {track.folder || 'General'}</p>
                      </div>
                      <Play size={16} className="text-gold-400 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search size={40} className="mx-auto text-white/10 mb-3" />
                <p className="text-white/50 text-sm">No existe en Melody Music</p>
                <p className="text-gray-600 text-xs mt-1">Prueba con otro término de búsqueda</p>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Folders with video thumbnails */}
        {subFolders.size > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {Array.from(subFolders.entries()).map(([subName, tracks]) => {
              const fullPath = currentFolder ? `${currentFolder}/${subName}` : subName;
              const realTracks = tracks.filter((t) => t.title !== '.keep');
              const thumbTracks = realTracks.slice(0, 4);
              return (
                <div key={fullPath} onClick={() => setCurrentFolder(fullPath)} className="group relative cursor-pointer flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                  {/* Folder thumbnail - 2x2 grid of video previews */}
                  <div className="relative w-full aspect-square max-w-[120px] sm:max-w-[140px] rounded-xl overflow-hidden shadow-lg border-2 border-white/10 group-hover:border-gold-400/40 transition-colors">
                    {thumbTracks.length > 0 ? (
                      <div className="grid grid-cols-2 grid-rows-2 w-full h-full bg-black">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="w-full h-full overflow-hidden">
                            {thumbTracks[i] ? (
                              <video
                                src={thumbTracks[i].src}
                                muted
                                preload="metadata"
                                className="w-full h-full object-cover pointer-events-none"
                                onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                <Film size={14} className="text-white/20" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <Film size={32} className="text-gold-600/50" />
                      </div>
                    )}
                  </div>
                  <div className="text-center w-full"><h3 className="font-bold text-white truncate text-xs sm:text-sm drop-shadow-md">{subName}</h3><p className="text-[9px] sm:text-[10px] text-gold-200 uppercase">{realTracks.length} videos</p></div>
                  {/* Play folder button */}
                  {realTracks.length > 0 && (
                    <button onClick={(e) => playFolder(fullPath, e)}
                      className="absolute bottom-[44px] right-2 w-8 h-8 rounded-full bg-gold-500 text-white flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-gold-400 z-20"
                      title={`Reproducir ${realTracks.length} videos`}>
                      <Play size={14} fill="white" className="ml-0.5" />
                    </button>
                  )}
                  {isAdmin && !showUploadMenu && (
                    <div className="absolute top-1 right-1 flex flex-col gap-1 z-30 opacity-0 group-hover:opacity-100 sm:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); setMovingFolder(fullPath); setTargetMoveFolderDest(''); }} className="p-1 bg-white/90 rounded-full text-blue-400 shadow-sm" title="Mover"><FolderInput size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingFolder({ old: fullPath, new: fullPath }); }} className="p-1 bg-white/90 rounded-full text-slate-500 shadow-sm" title="Renombrar"><Edit2 size={10} /></button>
                      <button onClick={async (e) => { e.stopPropagation(); if (window.confirm('Eliminar carpeta y contenido?')) { await deleteFolder(fullPath); if (currentFolder === fullPath) setCurrentFolder(null); }}} className="p-1 bg-white/90 rounded-full text-red-400 shadow-sm" title="Eliminar"><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Video cards with thumbnails */}
        {displayFiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {displayFiles.map((track) => {
              const thumb = thumbnails[track.id] || '';
              const addedDate = new Date(track.addedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
              return (
                <div key={track.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all hover:border-white/20">
                  {/* Thumbnail */}
                  <div
                    onClick={() => { if (isPlaying) togglePlay(); setViewingVideo(track); }}
                    className="aspect-video bg-gray-900 relative cursor-pointer group overflow-hidden">
                    {thumb && thumb !== 'VIDEO_ELEMENT' ? (
                      <img src={thumb} alt="" className="w-full h-full object-contain bg-black" />
                    ) : (
                      <video
                        src={track.src}
                        muted
                        preload="metadata"
                        className="w-full h-full object-contain bg-black pointer-events-none"
                        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <Play size={28} fill="white" className="text-white ml-1" />
                      </div>
                    </div>
                    {track.duration > 0 && (
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">{formatTime(track.duration)}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="font-bold text-white text-sm truncate">{track.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={10} />{addedDate}</span>
                      {track.location && <span className="flex items-center gap-1"><MapPin size={10} />{track.location}</span>}
                      {track.duration > 0 && <span className="flex items-center gap-1"><Clock size={10} />{formatTime(track.duration)}</span>}
                    </div>
                    {/* Admin actions */}
                    {isAdmin && !showUploadMenu && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                        <a href={track.src} download={track.title + '.webm'} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-green-400 hover:bg-green-500/20 rounded text-[10px] flex items-center gap-1"><Download size={12} /><span className="hidden sm:inline">Descargar</span></a>
                        <button onClick={() => setMovingVideo(track)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded text-[10px] flex items-center gap-1"><FolderInput size={12} /><span className="hidden sm:inline">Mover</span></button>
                        <button onClick={() => setEditingVideo({ id: track.id, title: track.title, artist: track.artist })} className="p-1.5 text-gray-400 hover:bg-white/20 rounded text-[10px] flex items-center gap-1"><Edit2 size={12} /><span className="hidden sm:inline">Editar</span></button>
                        <button onClick={() => removeTrackToTrash(track)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded text-[10px] flex items-center gap-1"><Trash2 size={12} /><span className="hidden sm:inline">Eliminar</span></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {displayFiles.length === 0 && subFolders.size === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/50"><Film size={48} className="mb-2 text-gold-500/50" /><p>Carpeta vacía.</p></div>
        )}
        </>
        )}
      </div>
    </div>
  );
};