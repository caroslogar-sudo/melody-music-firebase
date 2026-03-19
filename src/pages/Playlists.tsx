import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Plus, ListMusic, Music, Play, X, Trash2, CheckCircle, Circle, Folder, ArrowLeft, Search, Share2, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { deletePlaylistFirestore, updatePlaylistFirestore } from '../services/playlistService';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { Track, UserRole, Playlist } from '../types';

export const Playlists = () => {
  const { playlists, createPlaylist, library, playTrack, playQueue, addTrackToPlaylist, removeTrackFromPlaylist, user, users, groups } = useApp();

  const isMaster = user?.role === UserRole.MASTER;
  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Desconocido';

  // Playlists visible to current user:
  // - Own playlists
  // - Shared with me (directly or via group)
  // - Master sees ALL
  const myGroupIds = useMemo(() => groups.filter(g => user && g.members.includes(user.uid)).map(g => 'group:' + g.id), [groups, user]);

  const visiblePlaylists = useMemo(() => {
    if (isMaster) return playlists;
    return playlists.filter(p => {
      if (p.createdBy === user?.uid) return true;
      if (p.sharedWith?.includes(user?.uid || '')) return true;
      if (p.sharedWith?.some(s => myGroupIds.includes(s))) return true;
      return false;
    });
  }, [playlists, user, isMaster, myGroupIds]);

  // Group playlists by creator for Master view
  const playlistsByUser = useMemo(() => {
    const map = new Map<string, Playlist[]>();
    visiblePlaylists.forEach(pl => {
      const key = pl.createdBy;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pl);
    });
    return map;
  }, [visiblePlaylists]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedTracksForNew, setSelectedTracksForNew] = useState<Set<string>>(new Set());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showAddMoreModal, setShowAddMoreModal] = useState(false);
  const [additionalTracks, setAdditionalTracks] = useState<Set<string>>(new Set());
  const [showShareModal, setShowShareModal] = useState<Playlist | null>(null);
  const [shareSelections, setShareSelections] = useState<string[]>([]);
  const [collapsedUsers, setCollapsedUsers] = useState<Set<string>>(new Set());

  // Folder navigation state for create/add modals
  const [browseFolder, setBrowseFolder] = useState<string | null>(null);
  const [browseFolder2, setBrowseFolder2] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQuery2, setSearchQuery2] = useState('');
  const [mainSearchQuery, setMainSearchQuery] = useState('');

  const audioTracks = useMemo(() => library.filter(t => t.type === 'audio' && t.title !== '.keep'), [library]);

  const activePlaylist = visiblePlaylists.find(p => p.id === selectedPlaylistId);
  const activeTracks = activePlaylist ? activePlaylist.tracks.map(tid => library.find(t => t.id === tid)).filter(Boolean) as Track[] : [];
  const availableTracks = activePlaylist ? audioTracks.filter(t => !activePlaylist.tracks.includes(t.id)) : [];

  // Centralized cover fetching
  const allTracks = useMemo(() => {
    const combined = [...audioTracks, ...activeTracks];
    return combined.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
  }, [audioTracks, activeTracks]);
  const covers = useCovers(allTracks);

  // Build folder structure from tracks
  const getFolderStructure = (tracks: Track[], currentPath: string | null) => {
    const foldersMap = new Map<string, Track[]>();
    const files: Track[] = [];
    tracks.forEach(track => {
      const trackPath = track.folder || 'General';
      if (!currentPath) {
        const root = trackPath.split('/')[0];
        if (!foldersMap.has(root)) foldersMap.set(root, []);
        foldersMap.get(root)!.push(track);
      } else {
        if (trackPath === currentPath) {
          files.push(track);
        } else if (trackPath.startsWith(currentPath + '/')) {
          const rel = trackPath.slice(currentPath.length + 1).split('/')[0];
          if (!foldersMap.has(rel)) foldersMap.set(rel, []);
          foldersMap.get(rel)!.push(track);
        }
      }
    });
    return { folders: foldersMap, files };
  };

  const handleCreate = async () => {
    if (newPlaylistName.trim()) {
      const newId = await createPlaylist(newPlaylistName, Array.from(selectedTracksForNew));
      setNewPlaylistName(''); setSelectedTracksForNew(new Set()); setShowCreateModal(false);
      setBrowseFolder(null); setSearchQuery('');
      setSelectedPlaylistId(newId);
    }
  };

  const toggle = (id: string, set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setFn(n);
  };

  const handleAddMore = async () => {
    if (selectedPlaylistId && additionalTracks.size > 0) {
      for (const tid of additionalTracks) await addTrackToPlaylist(selectedPlaylistId, tid);
      setAdditionalTracks(new Set()); setShowAddMoreModal(false);
      setBrowseFolder2(null); setSearchQuery2('');
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    const pl = visiblePlaylists.find(p => p.id === playlistId);
    if (!pl) return;
    if (pl.createdBy !== user?.uid && !isMaster) return;
    if (window.confirm('Eliminar esta lista de reproduccion?')) {
      await deletePlaylistFirestore(playlistId);
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null);
    }
  };

  const handleOpenShare = (pl: Playlist) => {
    setShowShareModal(pl);
    setShareSelections(pl.sharedWith || []);
  };

  const handleSaveShare = async () => {
    if (!showShareModal) return;
    try {
      const cleaned = shareSelections.length > 0 ? shareSelections : [];
      await updatePlaylistFirestore(showShareModal.id, { sharedWith: cleaned });
    } catch (err) { console.error(err); }
    setShowShareModal(null);
  };

  const toggleShareItem = (id: string) => {
    setShareSelections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleUserCollapse = (uid: string) => {
    setCollapsedUsers(prev => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  };

  const handlePlayAll = (startIdx: number = 0) => {
    const audio = activeTracks.filter(t => t.type === 'audio');
    if (audio.length > 0) playQueue(audio, Math.min(startIdx, audio.length - 1));
  };

  // Render track item with cover
  const renderTrackItem = (track: Track, isSelected: boolean, onToggle: () => void) => {
    const coverImg = covers[track.id] || '';
    const fallback = getCoverFallback(track.artist);
    return (
      <div key={track.id} onClick={onToggle}
        className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-gold-500/15 border border-gold-400/30' : 'hover:bg-white/5 border border-transparent'}`}>
        {isSelected ? <CheckCircle size={18} className="text-gold-400 flex-shrink-0" /> : <Circle size={18} className="text-gray-600 flex-shrink-0" />}
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-600">
          <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
        </div>
        <div className="overflow-hidden min-w-0">
          <p className="text-xs font-bold text-gray-200 truncate">{track.title}</p>
          <p className="text-[10px] text-gray-500 truncate">{track.artist}</p>
        </div>
      </div>
    );
  };

  // Render folder browser for modals
  const renderFolderBrowser = (
    tracks: Track[],
    folder: string | null,
    setFolder: (f: string | null) => void,
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
    search: string,
    setSearch: (s: string) => void
  ) => {
    const { folders, files } = getFolderStructure(tracks, folder);
    const filteredFiles = search
      ? tracks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.artist.toLowerCase().includes(search.toLowerCase()))
      : files;
    const showFolders = !search;

    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search */}
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar canción..."
            className="w-full bg-[#252b36] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-gold-400 text-white placeholder-gray-500" />
        </div>

        {/* Back button */}
        {folder && !search && (
          <button onClick={() => {
            const parts = folder.split('/');
            setFolder(parts.length > 1 ? parts.slice(0, -1).join('/') : null);
          }} className="flex items-center gap-2 text-gold-300 text-xs mb-2 hover:text-gold-200 px-1">
            <ArrowLeft size={14} /><span>← {folder.split('/').pop()}</span>
          </button>
        )}

        {/* Selected badge */}
        {selected.size > 0 && (
          <div className="bg-gold-500/15 border border-gold-400/30 rounded-lg px-3 py-1.5 mb-2 flex items-center justify-between">
            <span className="text-gold-300 text-xs font-bold">{selected.size} seleccionadas</span>
            <button onClick={() => setSelected(new Set())} className="text-gray-400 text-[10px] hover:text-white">Limpiar</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#0d1117] rounded-xl p-2 space-y-1 border border-white/5">
          {showFolders && Array.from(folders.entries()).map(([name, folderTracks]) => {
            const fullPath = folder ? `${folder}/${name}` : name;
            const realCount = folderTracks.filter(t => t.title !== '.keep').length;
            const thumbUrls = folderTracks.filter(t => t.title !== '.keep').slice(0, 4).map(t => covers[t.id] || '').filter(Boolean);
            return (
              <div key={fullPath} onClick={() => setFolder(fullPath)}
                className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                  {thumbUrls.length >= 1 ? (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full bg-gray-900">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="overflow-hidden">
                          {thumbUrls[i] ? <img src={thumbUrls[i]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gold-500/10" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#F5E6C8] to-[#D4AF37]/40 flex items-center justify-center">
                      <Folder size={18} className="text-gold-600/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gold-200 truncate">{name}</p>
                  <p className="text-[10px] text-gray-500">{realCount} canciones</p>
                </div>
              </div>
            );
          })}

          {filteredFiles.map(track => renderTrackItem(track, selected.has(track.id), () => toggle(track.id, selected, setSelected)))}

          {filteredFiles.length === 0 && (!showFolders || folders.size === 0) && (
            <p className="text-center text-gray-500 py-6 text-xs">No hay canciones aquí.</p>
          )}
        </div>
      </div>
    );
  };

  // Playlist card component
  const renderPlaylistCard = (pl: Playlist) => {
    const plTracks = pl.tracks.map(tid => library.find(t => t.id === tid)).filter(Boolean) as Track[];
    const plCovers = plTracks.slice(0, 4).map(t => covers[t.id] || '').filter(Boolean);
    const isOwner = pl.createdBy === user?.uid;
    const canDelete = isOwner || isMaster;
    const isShared = (pl.sharedWith?.length || 0) > 0;
    return (
      <GlassCard key={pl.id} onClick={() => setSelectedPlaylistId(pl.id)}
        className={`cursor-pointer !p-2.5 md:!p-3 border-l-4 transition-all hover:bg-white/10 mb-1 ${selectedPlaylistId === pl.id ? 'border-gold-400 bg-white/10' : 'border-transparent'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
              {plCovers.length >= 1 ? (
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full bg-gray-900">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="overflow-hidden">
                      {plCovers[i] ? <img src={plCovers[i]} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gold-500/10 flex items-center justify-center"><Music size={8} className="text-gold-400/30" /></div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full h-full bg-gold-500/20 flex items-center justify-center"><ListMusic size={20} className="text-gold-300" /></div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white truncate text-sm">{pl.name}</h4>
              <p className="text-[10px] text-gray-500 truncate">
                {!isOwner && <span className="text-gold-400/60">{getUserName(pl.createdBy)} · </span>}
                {pl.tracks.length} canciones
                {isShared && <span className="text-blue-400/60"> · Compartida</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {isOwner && (
              <button onClick={(e) => { e.stopPropagation(); handleOpenShare(pl); }}
                className={'p-1.5 transition-colors rounded ' + (isShared ? 'text-blue-400' : 'text-gray-600 hover:text-blue-400')} title="Compartir">
                <Share2 size={14} />
              </button>
            )}
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                className="p-1.5 text-red-400/40 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
            )}
          </div>
        </div>
      </GlassCard>
    );
  };

  // Other users and groups for sharing
  const shareableUsers = useMemo(() => users.filter(u => u.uid !== user?.uid), [users, user]);
  const shareableGroups = useMemo(() => groups, [groups]);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 relative">
      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Share2 size={18} className="text-blue-400" /> Compartir lista</h3>
              <button onClick={() => setShowShareModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-400 mb-3 truncate">Lista: <span className="text-white font-medium">{showShareModal.name}</span></p>

            <div className="flex-1 overflow-y-auto space-y-1 mb-4">
              {shareableGroups.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">Grupos</p>
                  {shareableGroups.map(g => {
                    const gid = 'group:' + g.id;
                    const sel = shareSelections.includes(gid);
                    return (
                      <div key={g.id} onClick={() => toggleShareItem(gid)}
                        className={'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ' + (sel ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5')}>
                        {sel ? <CheckCircle size={16} className="text-blue-400 flex-shrink-0" /> : <Circle size={16} className="text-gray-600 flex-shrink-0" />}
                        <Users size={14} className="text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{g.name}</p>
                          <p className="text-[10px] text-gray-500">{g.members.length} miembros</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">Usuarios</p>
              {shareableUsers.map(u => {
                const sel = shareSelections.includes(u.uid);
                return (
                  <div key={u.uid} onClick={() => toggleShareItem(u.uid)}
                    className={'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ' + (sel ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5')}>
                    {sel ? <CheckCircle size={16} className="text-blue-400 flex-shrink-0" /> : <Circle size={16} className="text-gray-600 flex-shrink-0" />}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{u.displayName}</p>
                      <p className="text-[10px] text-gray-500">{u.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button onClick={() => setShowShareModal(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleSaveShare} className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors">
                Guardar {shareSelections.length > 0 && `(${shareSelections.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><ListMusic size={20} className="text-gold-400" /> Nueva Lista</h3>
              <button onClick={() => { setShowCreateModal(false); setBrowseFolder(null); setSearchQuery(''); setSelectedTracksForNew(new Set()); }} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-gray-400">Nombre</label>
              <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="Ej: Favoritos 2024" autoFocus
                className="w-full bg-[#252b36] border border-white/10 rounded-lg p-3 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" />
            </div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Navegar y seleccionar canciones</label>
            {renderFolderBrowser(audioTracks, browseFolder, setBrowseFolder, selectedTracksForNew, setSelectedTracksForNew, searchQuery, setSearchQuery)}
            <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-white/5">
              <button onClick={() => { setShowCreateModal(false); setBrowseFolder(null); setSearchQuery(''); setSelectedTracksForNew(new Set()); }} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!newPlaylistName.trim()} className="px-5 py-2 bg-gold-500/20 text-gold-400 border border-gold-500/50 rounded-lg text-sm font-bold hover:bg-gold-500 hover:text-white transition-all disabled:opacity-50">
                Crear Lista {selectedTracksForNew.size > 0 && `(${selectedTracksForNew.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MORE MODAL */}
      {showAddMoreModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white truncate pr-2">Añadir a "{activePlaylist?.name}"</h3>
              <button onClick={() => { setShowAddMoreModal(false); setBrowseFolder2(null); setSearchQuery2(''); setAdditionalTracks(new Set()); }} className="text-slate-400 hover:text-white flex-shrink-0"><X size={20} /></button>
            </div>
            {renderFolderBrowser(availableTracks, browseFolder2, setBrowseFolder2, additionalTracks, setAdditionalTracks, searchQuery2, setSearchQuery2)}
            <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-white/5">
              <button onClick={() => { setShowAddMoreModal(false); setBrowseFolder2(null); setSearchQuery2(''); setAdditionalTracks(new Set()); }} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleAddMore} disabled={additionalTracks.size === 0} className="px-5 py-2 bg-gold-500/20 text-gold-400 border border-gold-500/50 rounded-lg text-sm font-bold hover:bg-gold-500 hover:text-white transition-all disabled:opacity-50">
                Añadir ({additionalTracks.size})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Listas de Reproduccion</h2>
        <button onClick={() => setShowCreateModal(true)} className="bg-gold-400 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gold-500 shadow-md text-sm"><Plus size={18} /><span>Nueva Lista</span></button>
      </div>

      {/* Search bar for songs */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={mainSearchQuery} onChange={(e) => setMainSearchQuery(e.target.value)}
          placeholder="Buscar canciones para reproducir o agregar..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-gold-400 text-white placeholder-gray-500" />
        {mainSearchQuery && <button onClick={() => setMainSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><X size={16} /></button>}
      </div>

      {/* Search results */}
      {mainSearchQuery.trim() && (() => {
        const q = mainSearchQuery.toLowerCase();
        const results = audioTracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
        return (
          <div className="bg-white/5 rounded-xl p-3 max-h-60 overflow-y-auto border border-white/10">
            {results.length > 0 ? results.map(track => {
              const coverImg = covers[track.id] || track.coverUrl || '';
              const fallback = getCoverFallback(track.artist);
              return (
                <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => playTrack(track)}>
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
                    <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{track.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <Play size={14} className="text-gold-400 flex-shrink-0" />
                </div>
              );
            }) : (
              <div className="text-center py-4">
                <p className="text-white/50 text-sm">No existe en Melody Music</p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-6 overflow-hidden min-h-0">
        {/* Playlists sidebar - grouped by user */}
        <div className="md:w-1/3 max-h-[200px] md:max-h-none overflow-y-auto pr-1 space-y-1 flex-shrink-0">
          {visiblePlaylists.length === 0 && <div className="text-center text-white/50 py-6 text-sm">No hay listas creadas.</div>}

          {isMaster ? (
            /* MASTER: grouped by user */
            Array.from(playlistsByUser.entries()).map(([ownerUid, pls]) => {
              const ownerName = getUserName(ownerUid);
              const isCollapsed = collapsedUsers.has(ownerUid);
              const isMe = ownerUid === user?.uid;
              return (
                <div key={ownerUid} className="mb-2">
                  <button onClick={() => toggleUserCollapse(ownerUid)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    {isCollapsed ? <ChevronRight size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gold-400" />}
                    <Users size={12} className="text-gold-400/60" />
                    <span className="text-xs font-bold text-gray-300 truncate">{ownerName} {isMe && <span className="text-gold-400/50">(Tu)</span>}</span>
                    <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{pls.length}</span>
                  </button>
                  {!isCollapsed && pls.map(pl => renderPlaylistCard(pl))}
                </div>
              );
            })
          ) : (
            /* Non-master: flat list with creator name */
            visiblePlaylists.map(pl => renderPlaylistCard(pl))
          )}
        </div>

        {/* Playlist detail */}
        <div className="flex-1 bg-white/5 rounded-2xl p-3 md:p-6 border border-white/10 overflow-y-auto min-h-0">
          {activePlaylist ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 truncate">
                    <Music size={20} className="text-gold-500 flex-shrink-0" /><span className="truncate">{activePlaylist.name}</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activePlaylist.createdBy !== user?.uid && <span className="text-gold-400/70">Por {getUserName(activePlaylist.createdBy)} · </span>}
                    {activeTracks.length} canciones
                    {(activePlaylist.sharedWith?.length || 0) > 0 && <span className="text-blue-400/70"> · Compartida</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeTracks.filter(t => t.type === 'audio').length > 0 && (
                    <button onClick={() => handlePlayAll(0)}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-gold-400 to-gold-500 text-white px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg active:scale-95 transition-all">
                      <Play size={16} fill="white" /><span className="hidden sm:inline">Reproducir</span>
                    </button>
                  )}
                  {(activePlaylist.createdBy === user?.uid || isMaster) && (
                    <button onClick={() => { setShowAddMoreModal(true); setBrowseFolder2(null); setSearchQuery2(''); }}
                      className="flex items-center gap-1.5 bg-white/10 text-gold-300 px-3 py-2 rounded-xl text-xs md:text-sm font-bold border border-white/10">
                      <Plus size={14} /><span className="hidden sm:inline">Añadir</span>
                    </button>
                  )}
                </div>
              </div>

              {activeTracks.length === 0 ? <div className="text-center text-gray-500 py-8">Lista vacía.</div> :
                <div className="space-y-2">{activeTracks.map((track, idx) => {
                  const coverImg = covers[track.id] || '';
                  const fallback = getCoverFallback(track.artist);
                  return (
                    <div key={`${track.id}-${idx}`} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-gray-500 w-5 text-center font-mono flex-shrink-0">{idx + 1}</span>
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-600">
                          <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                        </div>
                        <div className="text-sm min-w-0"><p className="font-bold text-white truncate">{track.title}</p><p className="text-gray-400 truncate text-xs">{track.artist}</p></div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => {
                          const audio = activeTracks.filter(t => t.type === 'audio');
                          const aIdx = audio.findIndex(t => t.id === track.id);
                          if (aIdx >= 0) playQueue(audio, aIdx); else playTrack(track);
                        }} className="w-8 h-8 rounded-full bg-elegant-black text-white flex items-center justify-center hover:bg-gold-500 transition-colors">
                          <Play size={12} fill="white" className="ml-0.5" />
                        </button>
                        <button onClick={() => removeTrackFromPlaylist(activePlaylist.id, track.id)}
                          className={'p-2 rounded-full transition-colors ' + ((activePlaylist.createdBy === user?.uid || isMaster) ? 'text-red-400/60 hover:text-red-400' : 'hidden')}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                })}</div>
              }
            </>
          ) : <div className="h-full flex items-center justify-center text-gray-500">Selecciona una lista</div>}
        </div>
      </div>
    </div>
  );
};