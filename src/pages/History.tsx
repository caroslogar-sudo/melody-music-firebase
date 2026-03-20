import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Clock, Play, Trash2, Music, BarChart3 } from 'lucide-react';
import { subscribeToHistory, clearHistory, HistoryEntry } from '../services/historyService';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { Track } from '../types';

export const History = () => {
  const { user, library, playTrack, playQueue } = useApp();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToHistory(user.uid, setEntries);
    return () => unsub();
  }, [user?.uid]);

  // Resolve tracks from library
  const historyTracks = useMemo(() => {
    return entries.map(e => {
      const track = library.find(t => t.id === e.trackId);
      return track ? { ...e, track } : null;
    }).filter(Boolean) as (HistoryEntry & { track: Track })[];
  }, [entries, library]);

  // Unique tracks for cover fetching
  const uniqueTracks = useMemo(() => {
    const map = new Map<string, Track>();
    historyTracks.forEach(h => map.set(h.track.id, h.track));
    return Array.from(map.values());
  }, [historyTracks]);
  const covers = useCovers(uniqueTracks);

  // Stats
  const totalPlays = historyTracks.length;
  const uniqueArtists = new Set(historyTracks.map(h => h.track.artist)).size;
  const uniqueSongs = new Set(historyTracks.map(h => h.track.id)).size;

  // Top artists
  const topArtists = useMemo(() => {
    const map = new Map<string, number>();
    historyTracks.forEach(h => {
      map.set(h.track.artist, (map.get(h.track.artist) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [historyTracks]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, (HistoryEntry & { track: Track })[]>();
    historyTracks.forEach(h => {
      const d = new Date(h.playedAt);
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let label: string;
      if (d.toDateString() === today.toDateString()) label = 'Hoy';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer';
      else label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(h);
    });
    return Array.from(groups.entries());
  }, [historyTracks]);

  const handlePlayAll = () => {
    const tracks = historyTracks.map(h => h.track).filter(t => t.type === 'audio');
    // Deduplicate keeping order
    const seen = new Set<string>();
    const unique: Track[] = [];
    tracks.forEach(t => { if (!seen.has(t.id)) { seen.add(t.id); unique.push(t); } });
    if (unique.length > 0) playQueue(unique, 0);
  };

  const handleClear = async () => {
    if (!user) return;
    if (window.confirm('Borrar todo el historial de reproduccion?')) {
      await clearHistory(user.uid);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock size={24} className="text-gold-400" /> Mi Historial
        </h2>
        <div className="flex items-center gap-2">
          {historyTracks.length > 0 && (
            <>
              <button onClick={handlePlayAll}
                className="flex items-center gap-1.5 bg-gold-500 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95">
                <Play size={14} fill="white" /> Reproducir todo
              </button>
              <button onClick={handleClear}
                className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {historyTracks.length > 0 && (
        <div className="grid grid-cols-3 gap-3 flex-shrink-0">
          <GlassCard className="bg-blue-500/10 border-blue-500/20 !p-3 text-center">
            <p className="text-xl font-bold text-white">{totalPlays}</p>
            <p className="text-[10px] text-gray-400">Reproducciones</p>
          </GlassCard>
          <GlassCard className="bg-green-500/10 border-green-500/20 !p-3 text-center">
            <p className="text-xl font-bold text-white">{uniqueSongs}</p>
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
          <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 flex items-center gap-1"><BarChart3 size={12} /> Artistas mas escuchados</p>
          <div className="flex flex-wrap gap-2">
            {topArtists.map(([artist, count]) => (
              <span key={artist} className="bg-gold-500/10 text-gold-400 text-xs px-2.5 py-1 rounded-full border border-gold-500/20 font-medium">
                {artist} <span className="text-gray-500">({count})</span>
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* History list grouped by date */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {groupedByDate.length === 0 ? (
          <div className="text-center text-white/30 py-16">
            <Music size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">Sin historial</p>
            <p className="text-sm text-gray-600 mt-1">Reproduce canciones para ver tu historial aqui</p>
          </div>
        ) : groupedByDate.map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">{dateLabel}</p>
            <div className="space-y-1">
              {items.map((h, idx) => {
                const coverImg = covers[h.track.id] || h.track.coverUrl || '';
                const fallback = getCoverFallback(h.track.artist);
                return (
                  <div key={h.id}
                    onClick={() => playTrack(h.track)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors active:scale-[0.98]">
                    <span className="text-[10px] text-gray-600 w-10 text-right flex-shrink-0 font-mono">{formatTime(h.playedAt)}</span>
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
                      <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{h.track.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">{h.track.artist}</p>
                    </div>
                    <Play size={14} className="text-gold-400/50 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};