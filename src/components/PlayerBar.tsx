import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, X, Maximize2, Minimize2, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlassCard } from './ui/GlassCard';
import { useCovers, getCoverFallback } from '../hooks/useCovers';

export const PlayerBar = () => {
  const {
    currentTrack, isPlaying, togglePlay, closePlayer, volume, setVolume,
    nextTrack, prevTrack, shuffle, toggleShuffle, repeatMode, toggleRepeat,
    onTrackEnded, queue,
  } = useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const trackArray = useMemo(() => currentTrack ? [currentTrack] : [], [currentTrack]);
  const covers = useCovers(trackArray);
  const coverUrl = currentTrack ? (covers[currentTrack.id] || currentTrack.coverUrl || '') : '';
  const coverFallback = currentTrack ? getCoverFallback(currentTrack.artist) : '';

  // Play/pause control
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    if (isPlaying) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isPlaying, volume]);

  // When track changes, load new source and play
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack) return;
    el.src = currentTrack.src;
    el.load();
    setCurrentTime(0);
    setDuration(0);
    if (isPlaying) {
      el.play().catch(() => {});
    }
  }, [currentTrack]);

  // Audio events
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => {
      if (repeatMode === 'one') {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        onTrackEnded();
      }
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
    };
  }, [repeatMode, onTrackEnded]);

  // ===== MEDIA SESSION API (Bluetooth car controls + lock screen) =====
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    const artworkUrl = coverUrl || coverFallback;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || currentTrack.folder || 'Melody Music',
      artwork: artworkUrl ? [
        { src: artworkUrl, sizes: '96x96', type: 'image/png' },
        { src: artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: artworkUrl, sizes: '384x384', type: 'image/png' },
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
      ] : [],
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('stop', () => closePlayer());

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audioRef.current && details.seekTime != null) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset || 10));
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + (details.seekOffset || 10));
        }
      });
    } catch { /* some browsers don't support seek actions */ }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      } catch {}
    };
  }, [currentTrack, isPlaying, coverUrl, coverFallback, duration]);

  // Update position state for Media Session (car screen progress bar)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration),
      });
    } catch {}
  }, [currentTime, duration]);

  if (!currentTrack || currentTrack.type === 'video') return null;

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (el) el.currentTime = parseFloat(e.target.value);
  };

  const hasQueue = queue.length > 1;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  // Minimized view
  if (isMinimized) {
    return (
      <GlassCard className="!p-2 !rounded-2xl flex items-center justify-center gap-2 bg-white/80 shadow-2xl backdrop-blur-2xl border-white/60 w-fit mx-auto">
        <audio ref={audioRef} />
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
          <img src={coverUrl || coverFallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = coverFallback; }} />
        </div>
        {hasQueue && (
          <button onClick={prevTrack} className="p-1.5 text-elegant-gray active:scale-90"><SkipBack size={16} fill="currentColor" /></button>
        )}
        <button onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-gold-300 to-gold-500 text-white flex items-center justify-center shadow-lg">
          {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-0.5" />}
        </button>
        {hasQueue && (
          <button onClick={nextTrack} className="p-1.5 text-elegant-gray active:scale-90"><SkipForward size={16} fill="currentColor" /></button>
        )}
        <button onClick={() => setIsMinimized(false)} className="p-1.5 text-elegant-gray"><Maximize2 size={16} /></button>
        <button onClick={closePlayer} className="p-1.5 text-red-500"><X size={16} /></button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="!p-3 !rounded-2xl md:!rounded-3xl bg-white/80 shadow-2xl backdrop-blur-2xl border-white/60 w-full overflow-hidden">
      <audio ref={audioRef} />

      <div className="flex flex-col gap-2">
        {/* Row 1: Track info + min/close */}
        <div className="flex items-center gap-2">
          {/* Cover */}
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl overflow-hidden shadow-lg border border-gold-100 flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
            <img src={coverUrl || coverFallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = coverFallback; }} />
          </div>

          {/* Title / Artist */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-elegant-black truncate text-sm md:text-base">{currentTrack.title}</h4>
            <p className="text-xs text-elegant-gray truncate">{currentTrack.artist}</p>
          </div>

          {/* Volume - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            <Volume2 size={16} className="text-elegant-gray" />
            <input type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 lg:w-20 h-1 bg-gold-100 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:rounded-full" />
          </div>

          {/* Min/Close */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={() => setIsMinimized(true)} className="p-1 rounded-full text-elegant-gray"><Minimize2 size={14} /></button>
            <button onClick={closePlayer} className="p-1 rounded-full text-red-500"><X size={14} /></button>
          </div>
        </div>

        {/* Row 2: Transport controls - centered */}
        <div className="flex items-center justify-center gap-2 md:gap-3">
          <button onClick={toggleShuffle}
            className={`p-1.5 rounded-full transition-colors ${shuffle ? 'text-gold-500 bg-gold-100' : 'text-gray-400 hover:text-elegant-black'}`}>
            <Shuffle size={15} />
          </button>
          <button onClick={prevTrack} className="p-1.5 text-elegant-gray hover:text-elegant-black active:scale-90 transition-transform">
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button onClick={togglePlay}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-gold-300 to-gold-500 text-white flex items-center justify-center shadow-lg border border-gold-200 flex-shrink-0">
            {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-0.5" />}
          </button>
          <button onClick={nextTrack} className="p-1.5 text-elegant-gray hover:text-elegant-black active:scale-90 transition-transform">
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button onClick={toggleRepeat}
            className={`p-1.5 rounded-full transition-colors relative ${repeatMode !== 'off' ? 'text-gold-500 bg-gold-100' : 'text-gray-400 hover:text-elegant-black'}`}>
            <RepeatIcon size={15} />
            {repeatMode === 'all' && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gold-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold">∞</span>
            )}
          </button>
        </div>

        {/* Row 2: Progress bar */}
        <div className="flex items-center gap-2 text-[10px] text-elegant-gray font-medium px-1">
          <span className="w-8 text-right">{formatTime(currentTime)}</span>
          <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-gold-100 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:rounded-full" />
          <span className="w-8">{formatTime(duration)}</span>
        </div>

        {/* Queue info */}
        {hasQueue && (
          <div className="text-center text-[9px] text-gray-400 -mt-1">
            {shuffle ? '🔀 ' : ''}Canción {queue.findIndex(t => t.id === currentTrack.id) + 1} de {queue.length}
            {repeatMode === 'all' && ' · 🔁 Repetir lista'}
            {repeatMode === 'one' && ' · 🔂 Repetir canción'}
          </div>
        )}
      </div>
    </GlassCard>
  );
};