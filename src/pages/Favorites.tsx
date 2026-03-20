import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Heart, Play, Trash2, Music, BarChart3 } from 'lucide-react';
import { subscribeFavorites, toggleFavorite } from '../services/favoritesService';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { Track } from '../types';

export const Favorites = () => {
  const { user, library, playTrack, playQueue } = useApp();
  const [favIds, setFavIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeFavorites(user.uid, setFavIds);
    return () => unsub();
  }, [user?.uid]);

  const favTracks = useMemo(() => {
    return favIds.map(id => library.find(t => t.id === id)).filter(Boolean) as Track[];
  }, [favIds, library]);

  const audioFavs = favTracks.filter(t => t.type === 'audio');
  const covers = useCovers(favTracks);

  const uniqueArtists = new Set(favTracks.map(t => t.artist)).size;

  const topArtists = useMemo(() => {
    const map = new Map<string, number>();
    favTracks.forEach(t => map.set(t.artist, (map.get(t.artist) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [favTracks]);

  const handlePlayAll = () => {
    if (audioFavs.length > 0) playQueue(audioFavs, 0);
  };

  const handleRemove = async (trackId: string) => {
    if (!user) return;
    await toggleFavorite(user.uid, trackId);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Heart size={24} className="text-red-400 fill-red-400" /> Mis Favoritos
        </h2>
        <div className="flex items-center gap-2">
          {audioFavs.length > 0 && (
            <button onClick={handlePlayAll}
              className="flex items-center gap-1.5 bg-gold-500 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95">
              <Play size={14} fill="white" /> Reproducir todo
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {favTracks.length > 0 && (
        <div className="grid grid-cols-3 gap-3 flex-shrink-0">
          <GlassCard className="bg-red-500/10 border-red-500/20 !p-3 text-center">
            <p className="text-xl font-bold text-white">{favTracks.length}</p>
            <p className="text-[10px] text-gray-400">Favoritos</p>
          </GlassCard>
          <GlassCard className="bg-green-500/10 border-green-500/20 !p-3 text-center">
            <p className="text-xl font-bold text-white">{audioFavs.length}</p>
            <p className="text-[10px] text-gray-400">Canciones</p>
          </GlassCard>
          <GlassCard className="bg-gold-500/10 border-gold-500/20 !p-3 text-center">
            <p className="text-xl font-bold text-white">{uniqueArtists}</p>
            <p className="text-[10px] text-gray-400">Artistas</p>
          </GlassCard>
        </div>
      )}

      {/* Top artists */}
      {topArtists.length > 0 && (
        <GlassCard className="bg-white/5 border-white/10 !p-3 flex-shrink-0">
          <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 flex items-center gap-1"><BarChart3 size={12} /> Artistas favoritos</p>
          <div className="flex flex-wrap gap-2">
            {topArtists.map(([artist, count]) => (
              <span key={artist} className="bg-red-500/10 text-red-300 text-xs px-2.5 py-1 rounded-full border border-red-500/20 font-medium">
                {artist} <span className="text-gray-500">({count})</span>
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Favorites list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {favTracks.length === 0 ? (
          <div className="text-center text-white/30 py-16">
            <Heart size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">Sin favoritos</p>
            <p className="text-sm text-gray-600 mt-1">Pulsa el corazon en cualquier cancion para anadirla</p>
          </div>
        ) : favTracks.map((track, idx) => {
          const coverImg = covers[track.id] || track.coverUrl || '';
          const fallback = getCoverFallback(track.artist);
          return (
            <div key={track.id}
              onClick={() => track.type === 'audio' && playTrack(track)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors active:scale-[0.98]">
              <span className="text-[10px] text-gray-600 w-6 text-right flex-shrink-0 font-mono">{idx + 1}</span>
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
                <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{track.title}</p>
                <p className="text-[10px] text-gray-400 truncate">{track.artist}{track.folder ? ` · ${track.folder}` : ''}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleRemove(track.id); }}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg active:scale-90 flex-shrink-0" title="Quitar de favoritos">
                <Heart size={16} fill="currentColor" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};