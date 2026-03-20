import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { UploadProgress } from '../components/ui/UploadProgress';
import { uploadFile, canUpload } from '../services/storageService';
import { addTrackToFirestore } from '../services/trackService';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { Upload, Play, Trash2, FolderPlus, ArrowLeft, Music as MusicIcon, Edit2, Folder, FolderInput, Search, X, Share2, Users, Heart } from 'lucide-react';
import { Track, UserRole } from '../types';
import { subscribeFavorites, toggleFavorite } from '../services/favoritesService';

export const Music = () => {
  const { library, playTrack, playQueue, removeTrackToTrash, updateTrack, currentTrack, isPlaying, user, renameFolder, deleteFolder, refreshStorageUsage, groups, users } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<{ old: string; new: string } | null>(null);
  const [editingTrack, setEditingTrack] = useState<{ id: string; title: string; artist: string } | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingTrack, setMovingTrack] = useState<Track | null>(null);
  const [targetMoveFolder, setTargetMoveFolder] = useState('');
  const [movingFolder, setMovingFolder] = useState<string | null>(null);
  const [targetMoveFolderDest, setTargetMoveFolderDest] = useState('');

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error' | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  // Subscribe to user favorites
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeFavorites(user.uid, (ids) => setFavIds(new Set(ids)));
    return () => unsub();
  }, [user?.uid]);

  const handleToggleFav = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) toggleFavorite(user.uid, trackId);
  };

  const isMaster = user?.role === UserRole.MASTER;
  const isAdmin = user?.role === UserRole.ADMIN || isMaster;

  // Folder access control
  const hasFullAccess = isMaster || !user?.allowedFolders || user.allowedFolders.length === 0 || user.allowedFolders.includes('*');
  const canAccessFolder = (folder: string): boolean => {
    if (hasFullAccess) return true;
    const allowed = user?.allowedFolders || [];
    return allowed.some(af => folder === af || folder.startsWith(af + '/') || af.startsWith(folder + '/'));
  };
  const canAccessTrack = (track: Track): boolean => {
    if (hasFullAccess) return true;
    const folder = track.folder || 'General';
    const allowed = user?.allowedFolders || [];
    return allowed.some(af => folder === af || folder.startsWith(af + '/'));
  };

  const audioTracks = useMemo(() => library.filter((t) => t.type === 'audio' && canAccessTrack(t)), [library, user]);

  // Search results across ALL audio tracks
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return audioTracks.filter(t =>
      t.title !== '.keep' &&
      (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    );
  }, [searchQuery, audioTracks]);

  const { subFolders, currentFiles } = useMemo(() => {
    const foldersMap = new Map<string, Track[]>();
    const files: Track[] = [];
    audioTracks.forEach((track) => {
      const trackPath = track.folder || 'General';
      if (!currentFolder) {
        const parts = trackPath.split('/');
        const rootFolder = parts[0];
        if (!foldersMap.has(rootFolder)) foldersMap.set(rootFolder, []);
        foldersMap.get(rootFolder)!.push(track);
      } else {
        if (trackPath === currentFolder) {
          files.push(track);
        } else if (trackPath.startsWith(currentFolder + '/')) {
          const rel = trackPath.slice(currentFolder.length + 1).split('/')[0];
          if (!foldersMap.has(rel)) foldersMap.set(rel, []);
          foldersMap.get(rel)!.push(track);
        }
      }
    });
    return { subFolders: foldersMap, currentFiles: files };
  }, [audioTracks, currentFolder]);

  const existingFolders = useMemo(() => {
    const paths = new Set<string>();
    audioTracks.forEach((t) => paths.add(t.folder || 'General'));
    return Array.from(paths);
  }, [audioTracks]);

  // Get all audio tracks inside a folder (including subfolders)
  const getAllFolderTracks = (folderPath: string): Track[] => {
    return audioTracks.filter(t => {
      const tp = t.folder || 'General';
      return (tp === folderPath || tp.startsWith(folderPath + '/')) && t.title !== '.keep';
    });
  };

  const playFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tracks = getAllFolderTracks(folderPath);
    if (tracks.length > 0) playQueue(tracks, 0);
  };

  // Multi-upload state
  const [multiUpload, setMultiUpload] = useState<{ total: number; done: number; current: string } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user) return;
    const files = Array.from(fileList);

    setShowUploadMenu(false);

    let targetPath = '';
    if (folderName.trim()) {
      targetPath = currentFolder && !folderName.includes('/') ? `${currentFolder}/${folderName.trim()}` : folderName.trim();
    } else {
      targetPath = currentFolder || 'General';
    }

    const total = files.length;
    let done = 0;
    let failed = 0;

    setMultiUpload({ total, done: 0, current: files[0].name });

    for (const file of files) {
      // Check storage limits
      const check = await canUpload(file.size);
      if (!check.allowed) {
        failed++;
        done++;
        setMultiUpload({ total, done, current: file.name });
        continue;
      }

      setUploadFileName(file.name);
      setUploadStatus('uploading');
      setUploadProgress(0);
      setMultiUpload({ total, done, current: file.name });

      const trackId = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      try {
        const { promise } = uploadFile(file, 'audio', trackId, setUploadProgress);
        const { url, storagePath } = await promise;

        const trackData: any = {
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Artista Local',
          folder: targetPath,
          coverUrl: '',
          src: url,
          storagePath,
          duration: 0,
          type: 'audio',
          fileSize: file.size,
          addedAt: Date.now(),
          addedBy: user.uid,
        };
        if (shareWith.length > 0) trackData.sharedWith = shareWith;
        await addTrackToFirestore(trackData);
        done++;
      } catch (err) {
        console.error('Upload error:', file.name, err);
        failed++;
        done++;
      }

      setMultiUpload({ total, done, current: '' });
    }

    // Finished all
    setShareWith([]);
    setFolderName('');
    await refreshStorageUsage();

    if (failed === 0) {
      setUploadStatus('success');
      setUploadFileName(`${total} cancion${total !== 1 ? 'es' : ''} subida${total !== 1 ? 's' : ''}`);
    } else {
      setUploadStatus('error');
      setUploadFileName(`${done - failed} subidas, ${failed} fallida${failed !== 1 ? 's' : ''}`);
    }

    setMultiUpload(null);
    setTimeout(() => setUploadStatus(null), 4000);
    e.target.value = '';
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const fullPath = currentFolder ? `${currentFolder}/${newFolderName.trim()}` : newFolderName.trim();
    await addTrackToFirestore({
      title: '.keep', artist: 'System', coverUrl: '', src: '', storagePath: '',
      duration: 0, type: 'audio', fileSize: 0, addedAt: Date.now(), addedBy: user.uid, folder: fullPath,
    });
    setShowCreateFolder(false);
    setNewFolderName('');
  };

  const handleMoveTrack = async () => {
    if (movingTrack && targetMoveFolder.trim()) {
      await updateTrack(movingTrack.id, { folder: targetMoveFolder.trim() });
      setMovingTrack(null);
      setTargetMoveFolder('');
    }
  };

  const handleRenameFolder = async () => {
    if (editingFolder?.new.trim()) {
      await renameFolder(editingFolder.old, editingFolder.new.trim());
      setEditingFolder(null);
    }
  };

  const handleDeleteFolder = async (fullPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Eliminar la carpeta y todo su contenido?')) {
      await deleteFolder(fullPath);
      if (currentFolder === fullPath) setCurrentFolder(null);
    }
  };

  const handleMoveFolder = async () => {
    if (!movingFolder || !targetMoveFolderDest.trim()) return;
    const oldPath = movingFolder;
    const folderBaseName = oldPath.includes('/') ? oldPath.split('/').pop()! : oldPath;
    const newPath = targetMoveFolderDest.trim() + '/' + folderBaseName;
    await renameFolder(oldPath, newPath);
    setMovingFolder(null);
    setTargetMoveFolderDest('');
  };

  const handleSaveTrack = async () => {
    if (editingTrack) {
      await updateTrack(editingTrack.id, { title: editingTrack.title, artist: editingTrack.artist });
      setEditingTrack(null);
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '--:--';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const displayFiles = currentFiles.filter((t) => t.title !== '.keep');

  // Collect all visible tracks for cover fetching
  const allVisibleTracks = useMemo(() => {
    const all: Track[] = [...displayFiles];
    subFolders.forEach((tracks) => {
      tracks.filter(t => t.title !== '.keep').forEach(t => all.push(t));
    });
    return all;
  }, [displayFiles, subFolders]);

  const covers = useCovers(allVisibleTracks);

  return (
    <div className="flex flex-col gap-6 h-full relative" onClick={() => showUploadMenu && setShowUploadMenu(false)}>
      {/* Upload progress toast */}
      {uploadStatus && (
        <UploadProgress progress={uploadProgress} fileName={uploadFileName} status={uploadStatus} storageWarning={uploadWarning} />
      )}

      {/* Multi-upload global progress */}
      {multiUpload && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] w-[320px] max-w-[calc(100vw-32px)] bg-[#161b22]/95 border border-gold-500/30 rounded-xl p-4 shadow-2xl backdrop-blur-xl"
          style={{ animation: 'nSlide 0.3s ease-out' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-white">Subiendo archivos</p>
            <p className="text-xs text-gold-400 font-mono">{multiUpload.done}/{multiUpload.total}</p>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-300 rounded-full"
              style={{ width: `${(multiUpload.done / multiUpload.total) * 100}%` }} />
          </div>
          {multiUpload.current && (
            <p className="text-[10px] text-gray-400 truncate">{multiUpload.current}</p>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
          <GlassCard className="w-80 bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FolderPlus size={20} className="text-gold-400" /> Nueva Subcarpeta
            </h3>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta" autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white placeholder-gray-500" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateFolder(false)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Crear</button>
            </div>
          </GlassCard>
        </div>
      )}

      {movingTrack && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
          <GlassCard className="w-80 bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FolderInput size={20} className="text-gold-400" /> Mover Canción
            </h3>
            <input type="text" value={targetMoveFolder} onChange={(e) => setTargetMoveFolder(e.target.value)}
              placeholder="Ej: Bachata/Mixes" list="move-folder-suggestions" autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white placeholder-gray-500" />
            <datalist id="move-folder-suggestions">{existingFolders.map((f) => <option key={f} value={f} />)}</datalist>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMovingTrack(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleMoveTrack} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Mover</button>
            </div>
          </GlassCard>
        </div>
      )}

      {editingFolder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
          <GlassCard className="w-80 bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Renombrar Carpeta</h3>
            <input type="text" value={editingFolder.new} onChange={(e) => setEditingFolder({ ...editingFolder, new: e.target.value })} autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingFolder(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleRenameFolder} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Guardar</button>
            </div>
          </GlassCard>
        </div>
      )}

      {movingFolder && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
          <GlassCard className="w-80 bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FolderInput size={20} className="text-blue-400" /> Mover Carpeta
            </h3>
            <p className="text-xs text-gray-400 mb-4 truncate">Mover: <span className="text-white font-medium">{movingFolder.split('/').pop()}</span></p>
            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Destino</label>
            <input type="text" value={targetMoveFolderDest} onChange={(e) => setTargetMoveFolderDest(e.target.value)}
              placeholder="Ej: Latina" list="move-folder-dest-suggestions" autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 mb-4 outline-none focus:border-gold-400 text-white placeholder-gray-500" />
            <datalist id="move-folder-dest-suggestions">{existingFolders.map((f) => <option key={f} value={f} />)}</datalist>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMovingFolder(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleMoveFolder} disabled={!targetMoveFolderDest.trim()} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">Mover</button>
            </div>
          </GlassCard>
        </div>
      )}

      {editingTrack && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
          <GlassCard className="w-96 bg-gray-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Editar Canción</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-bold text-gray-400">Título</label>
                <input type="text" value={editingTrack.title} onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg p-2 outline-none focus:border-gold-400 text-white" />
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-gray-400">Artista</label>
                <input type="text" value={editingTrack.artist} onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg p-2 outline-none focus:border-gold-400 text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingTrack(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleSaveTrack} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold">Guardar</button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-20">
        <div className="flex items-center gap-2 flex-wrap">
          {currentFolder && (
            <button onClick={() => {
              const parts = currentFolder.split('/');
              setCurrentFolder(parts.length > 1 ? parts.slice(0, -1).join('/') : null);
            }} className="p-2 bg-white/20 rounded-full text-white shadow-sm flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 drop-shadow-md">
            {currentFolder ? (
              <><span className="text-gold-200 opacity-70 font-normal text-base hidden sm:inline">Música /</span><span className="truncate max-w-[150px] sm:max-w-none">{currentFolder.split('/').pop()}</span></>
            ) : 'Mi Música'}
          </h2>
          {isAdmin && (
            <button onClick={() => setShowCreateFolder(!showCreateFolder)}
              className="p-2 bg-white/10 text-gold-200 rounded-lg flex items-center gap-1 text-xs font-semibold border border-white/10 flex-shrink-0">
              <FolderPlus size={16} /> <span className="hidden sm:inline">Nueva Carpeta</span>
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="relative w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" multiple className="hidden" />
            <button onClick={() => setShowUploadMenu(!showUploadMenu)}
              className="w-full sm:w-auto bg-elegant-black border border-gold-500/50 text-gold-100 px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg text-sm">
              <Upload size={16} /> <span>Subir Canciones</span>
            </button>
            {showUploadMenu && (
              <div className="absolute top-full right-0 left-0 sm:left-auto mt-3 w-full sm:w-80 bg-gray-900/95 border border-gold-200 rounded-2xl shadow-2xl p-5 animate-fade-in flex flex-col gap-4 z-50">
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <FolderPlus size={18} className="text-gold-500" /><span>Organizar en carpeta</span>
                  </div>
                </div>
                <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)}
                  placeholder={currentFolder ? 'Nueva subcarpeta...' : 'Ej: Bachata'} list="folder-suggestions" autoFocus
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400 text-white placeholder-gray-500" />
                <datalist id="folder-suggestions">{existingFolders.map((f) => <option key={f} value={f} />)}</datalist>
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
                          <span className="text-gray-500">({g.members.length})</span>
                        </label>
                      ))}
                      {users.filter(u => u.role !== UserRole.MASTER).map(u => (
                        <label key={'u_'+u.uid} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer text-xs">
                          <input type="checkbox" checked={shareWith.includes(u.uid)}
                            onChange={() => setShareWith(prev => prev.includes(u.uid) ? prev.filter(x=>x!==u.uid) : [...prev, u.uid])}
                            className="accent-gold-500 w-3.5 h-3.5" />
                          <span className="text-white">{u.displayName}</span>
                          <span className="text-gray-500 text-[10px]">{u.role}</span>
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
          placeholder="Buscar canciones..."
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
                <p className="text-xs text-gray-400 mb-3">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}</p>
                {searchResults.map((track) => {
                  const coverImg = covers[track.id] || track.coverUrl || '';
                  const fallbackImg = getCoverFallback(track.artist);
                  const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;
                  return (
                    <div key={track.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => playTrack(track)}>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-600 relative">
                        <img src={coverImg || fallbackImg} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }} />
                        {isCurrentPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="flex gap-0.5 items-end h-3">
                              <span className="w-0.5 bg-gold-400 animate-bounce" style={{height:'8px',animationDelay:'0s'}}/>
                              <span className="w-0.5 bg-gold-400 animate-bounce" style={{height:'12px',animationDelay:'0.15s'}}/>
                              <span className="w-0.5 bg-gold-400 animate-bounce" style={{height:'6px',animationDelay:'0.3s'}}/>
                            </div>
                          </div>
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
        {/* Folders with cover thumbnails */}
        {subFolders.size > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {Array.from(subFolders.entries()).map(([subName, tracks]) => {
              const fullPath = currentFolder ? `${currentFolder}/${subName}` : subName;
              const realTracks = tracks.filter((t) => t.title !== '.keep');
              // Get up to 4 cover images for the folder thumbnail grid
              const thumbTracks = realTracks.slice(0, 4);
              const thumbUrls = thumbTracks.map(t => covers[t.id] || '').filter(Boolean);
              return (
                <div key={fullPath} onClick={() => setCurrentFolder(fullPath)}
                  className="group relative cursor-pointer flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                  {/* Folder thumbnail - 2x2 grid or icon */}
                  <div className="relative w-full aspect-square max-w-[120px] sm:max-w-[140px] rounded-xl overflow-hidden shadow-lg border-2 border-white/10 group-hover:border-gold-400/40 transition-colors">
                    {thumbUrls.length >= 4 ? (
                      <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                        {thumbUrls.slice(0, 4).map((url, i) => (
                          <img key={i} src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ))}
                      </div>
                    ) : thumbUrls.length > 0 ? (
                      <div className="grid grid-cols-2 grid-rows-2 w-full h-full bg-gradient-to-br from-gray-800 to-gray-900">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="w-full h-full overflow-hidden">
                            {thumbUrls[i] ? (
                              <img src={thumbUrls[i]} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gold-500/20 to-gold-600/10 flex items-center justify-center">
                                <MusicIcon size={14} className="text-gold-400/40" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#F5E6C8] to-[#D4AF37]/40 flex items-center justify-center">
                        <MusicIcon size={32} className="text-gold-600/50" />
                      </div>
                    )}
                  </div>
                  {/* Folder name */}
                  <div className="text-center w-full">
                    <h3 className="font-bold text-white truncate text-xs sm:text-sm drop-shadow-md">{subName}</h3>
                    <p className="text-[9px] sm:text-[10px] text-gold-200 uppercase tracking-wide">{realTracks.length} items</p>
                  </div>
                  {/* Play folder button */}
                  {realTracks.length > 0 && (
                    <button onClick={(e) => playFolder(fullPath, e)}
                      className="absolute bottom-[52px] right-2 w-8 h-8 rounded-full bg-gold-500 text-white flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-gold-400 z-20"
                      title={`Reproducir ${realTracks.length} canciones`}>
                      <Play size={14} fill="white" className="ml-0.5" />
                    </button>
                  )}
                  {/* Admin actions - hidden when upload menu is open */}
                  {isAdmin && !showUploadMenu && (
                    <div className="absolute top-1 right-1 flex flex-col gap-1 z-30 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setMovingFolder(fullPath); setTargetMoveFolderDest(''); }}
                        className="p-1 bg-white/90 rounded-full text-blue-400 shadow-sm" title="Mover"><FolderInput size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingFolder({ old: fullPath, new: fullPath }); }}
                        className="p-1 bg-white/90 rounded-full text-slate-500 shadow-sm" title="Renombrar"><Edit2 size={10} /></button>
                      <button onClick={(e) => handleDeleteFolder(fullPath, e)}
                        className="p-1 bg-white/90 rounded-full text-red-400 shadow-sm" title="Eliminar"><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Files - Rich cards */}
        {displayFiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {displayFiles.map((track) => {
              const isTrackPlaying = currentTrack?.id === track.id;
              const coverImg = covers[track.id] || track.coverUrl || '';
              const fallbackImg = getCoverFallback(track.artist);
              const addedDate = new Date(track.addedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
              return (
                <div key={track.id}
                  className={`flex gap-3 p-3 rounded-xl transition-all ${isTrackPlaying ? 'bg-white/20 border border-gold-400/40 shadow-lg' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                  {/* Cover image */}
                  <div
                    onClick={() => playTrack(track)}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer relative group bg-gradient-to-br from-gold-300 to-gold-600">
                    <img src={coverImg || fallbackImg} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }} />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isTrackPlaying && isPlaying ? (
                        <div className="flex gap-0.5 items-end h-4">
                          <div className="w-1 bg-white animate-[bounce_1s_infinite] h-2 rounded" />
                          <div className="w-1 bg-white animate-[bounce_1.2s_infinite] h-4 rounded" />
                          <div className="w-1 bg-white animate-[bounce_0.8s_infinite] h-3 rounded" />
                        </div>
                      ) : <Play size={24} fill="white" className="text-white ml-0.5" />}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <p className={`font-bold text-sm truncate ${isTrackPlaying ? 'text-gold-300' : 'text-white'}`}>{track.title}</p>
                      <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                      {track.album && <p className="text-[10px] text-gold-200/70 truncate mt-0.5">{track.album}{track.albumYear ? ` · ${track.albumYear}` : ''}</p>}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{formatTime(track.duration)}</span>
                        <span>·</span>
                        <span>{addedDate}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={(e) => handleToggleFav(track.id, e)}
                          className={'p-1 rounded active:scale-90 transition-transform ' + (favIds.has(track.id) ? 'text-red-400' : 'text-gray-600 hover:text-red-400')}>
                          <Heart size={13} fill={favIds.has(track.id) ? 'currentColor' : 'none'} />
                        </button>
                        {isAdmin && !showUploadMenu && (
                          <>
                            <button onClick={() => setMovingTrack(track)} className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"><FolderInput size={13} /></button>
                            <button onClick={() => setEditingTrack({ id: track.id, title: track.title, artist: track.artist })} className="p-1 text-gray-400 hover:bg-white/20 rounded"><Edit2 size={13} /></button>
                            <button onClick={() => removeTrackToTrash(track)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {displayFiles.length === 0 && subFolders.size === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/50">
            <MusicIcon size={48} className="mb-2 text-gold-500/50" />
            <p>Carpeta vacía.</p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};