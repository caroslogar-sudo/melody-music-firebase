import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { Share2, Play, Music, Film, User } from 'lucide-react';
import { Track } from '../types';

export const Shared = () => {
  const { library, playTrack, user, users, groups } = useApp();

  // Find tracks shared with current user (directly or via group)
  const sharedTracks = useMemo(() => {
    if (!user) return [];
    const uid = user.uid;

    // Find groups this user belongs to
    const userGroupIds = groups
      .filter(g => g.members.includes(uid))
      .map(g => 'group:' + g.id);

    return library.filter(t => {
      if (!t.sharedWith || t.sharedWith.length === 0) return false;
      if (t.title === '.keep') return false;
      // Check if shared directly with user or via group
      return t.sharedWith.includes(uid) || t.sharedWith.some(s => userGroupIds.includes(s));
    });
  }, [library, user, groups]);

  const audioShared = sharedTracks.filter(t => t.type === 'audio');
  const videoShared = sharedTracks.filter(t => t.type === 'video');
  const covers = useCovers(audioShared);

  const getSharerName = (track: Track) => {
    const u = users.find(x => x.uid === track.addedBy);
    return u?.displayName || 'Desconocido';
  };

  const getSharedWithNames = (track: Track) => {
    if (!track.sharedWith) return '';
    return track.sharedWith.map(s => {
      if (s.startsWith('group:')) {
        const g = groups.find(x => x.id === s.replace('group:', ''));
        return g ? g.name + ' (grupo)' : '';
      }
      const u = users.find(x => x.uid === s);
      return u?.displayName || '';
    }).filter(Boolean).join(', ');
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Share2 size={24} className="text-gold-400" /> Compartidas
      </h2>

      {sharedTracks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 py-20">
          <Share2 size={60} className="mb-4 opacity-30" />
          <p className="text-lg">No hay contenido compartido contigo</p>
          <p className="text-sm text-gray-600 mt-1">Cuando alguien comparta musica o videos contigo, apareceran aqui</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Shared Audio */}
          {audioShared.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Music size={14} /> Canciones compartidas ({audioShared.length})
              </h3>
              <div className="space-y-1">
                {audioShared.map(track => {
                  const coverImg = covers[track.id] || track.coverUrl || '';
                  const fallback = getCoverFallback(track.artist);
                  return (
                    <div key={track.id} onClick={() => playTrack(track)}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
                        <img src={coverImg || fallback} alt="" className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{track.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{track.artist}</p>
                        <p className="text-[10px] text-gold-400/60 flex items-center gap-1">
                          <User size={9} /> Compartido por {getSharerName(track)}
                        </p>
                      </div>
                      <Play size={16} className="text-gold-400 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shared Video */}
          {videoShared.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Film size={14} /> Videos compartidos ({videoShared.length})
              </h3>
              <div className="space-y-1">
                {videoShared.map(track => (
                  <div key={track.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="w-14 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-black flex items-center justify-center">
                      <Film size={16} className="text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{track.title}</p>
                      <p className="text-[10px] text-gold-400/60 flex items-center gap-1">
                        <User size={9} /> Compartido por {getSharerName(track)}
                      </p>
                    </div>
                    <Play size={16} className="text-gold-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};