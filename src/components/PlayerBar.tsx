import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, X, Maximize2, Minimize2, Shuffle, Repeat, Repeat1, Heart, Moon, AlignLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlassCard } from './ui/GlassCard';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { subscribeFavorites, toggleFavorite } from '../services/favoritesService';
import { getLyrics } from '../services/geminiService';

export const PlayerBar = () => {
  const {
    currentTrack, isPlaying, togglePlay, closePlayer, volume, setVolume,
    nextTrack, prevTrack, shuffle, toggleShuffle, repeatMode, toggleRepeat,
    onTrackEnded, queue, user,
  } = useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0); // 0 = off
  const [sleepRemaining, setSleepRemaining] = useState(0); // seconds remaining
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [lyricsTrackId, setLyricsTrackId] = useState('');

  // Sleep timer countdown
  useEffect(() => {
    if (sleepRemaining <= 0) {
      if (sleepIntervalRef.current) { clearInterval(sleepIntervalRef.current); sleepIntervalRef.current = null; }
      return;
    }
    sleepIntervalRef.current = setInterval(() => {
      setSleepRemaining(prev => {
        if (prev <= 1) {
          // Time's up - pause music
          togglePlay();
          setSleepMinutes(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current); };
  }, [sleepRemaining > 0]);

  const startSleepTimer = (minutes: number) => {
    setSleepMinutes(minutes);
    setSleepRemaining(minutes * 60);
    setShowSleepMenu(false);
  };

  const cancelSleepTimer = () => {
    setSleepMinutes(0);
    setSleepRemaining(0);
    setShowSleepMenu(false);
  };

  const formatSleepRemaining = () => {
    const m = Math.floor(sleepRemaining / 60);
    const s = sleepRemaining % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Lyrics
  const handleShowLyrics = async () => {
    if (!currentTrack) return;
    if (showLyrics && lyricsTrackId === currentTrack.id) {
      setShowLyrics(false);
      return;
    }
    // If track changed, fetch new lyrics
    if (lyricsTrackId !== currentTrack.id) {
      setLyrics('');
      setLoadingLyrics(true);
      setShowLyrics(true);
      setLyricsTrackId(currentTrack.id);
      const result = await getLyrics(currentTrack.artist, currentTrack.title);
      setLyrics(result);
      setLoadingLyrics(false);
    } else {
      setShowLyrics(true);
    }
  };

  // Subscribe to favorites
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeFavorites(user.uid, (ids) => {
      setIsFav(currentTrack ? ids.includes(currentTrack.id) : false);
    });
    return () => unsub();
  }, [user?.uid, currentTrack?.id]);

  const handleToggleFav = () => {
    if (user && currentTrack) toggleFavorite(user.uid, currentTrack.id);
  };

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
      const p = el.play();
      if (p) p.catch((err: any) => {
        console.warn('[Player] Play blocked:', err.message);
        // Retry after a short delay (mobile autoplay policy)
        setTimeout(() => {
          el.play().catch(() => {});
        }, 200);
      });
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
    // Create AudioContext for interrupt recovery (only once)
    if (!(window as any).__melodyAudioCtx) {
      try { (window as any).__melodyAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch {}
    }
    if (isPlaying) {
      const p = el.play();
      if (p) p.catch(() => {
        setTimeout(() => { el.play().catch(() => {}); }, 300);
      });
    }
  }, [currentTrack?.id]);

  // Audio events - use refs to avoid stale closures
  const onTrackEndedRef = useRef(onTrackEnded);
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => { onTrackEndedRef.current = onTrackEnded; }, [onTrackEnded]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => {
      if (repeatModeRef.current === 'one') {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        onTrackEndedRef.current();
      }
    };
    const onError = () => {
      console.warn('[Player] Audio error, attempting next track');
      setTimeout(() => onTrackEndedRef.current(), 500);
    };
    const onStalled = () => {
      console.warn('[Player] Audio stalled');
      setTimeout(() => {
        if (el.paused && isPlaying) el.play().catch(() => {});
      }, 1000);
    };
    // CRITICAL: Detect when system pauses audio (phone call, other app)
    // and sync React state so the play button in car/lock screen works
    const onSystemPause = () => {
      if (isPlayingRef.current) {
        console.log('[Player] System paused audio (phone call?) - syncing state');
        togglePlay(); // Set isPlaying = false in React
      }
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('stalled', onStalled);
    el.addEventListener('pause', onSystemPause);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('stalled', onStalled);
      el.removeEventListener('pause', onSystemPause);
    };
  }, []); // Empty deps - uses refs for everything

  // Keep refs in sync for Media Session handlers
  const isPlayingRef = useRef(isPlaying);
  const currentTrackRef = useRef(currentTrack);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // ===== MEDIA SESSION API (Bluetooth car controls + lock screen) =====
  // Robust: re-registers handlers on visibility change to survive phone call interruptions
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    const registerHandlers = () => {
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

      navigator.mediaSession.playbackState = isPlayingRef.current ? 'playing' : 'paused';

      // Play handler: robust recovery after phone calls and system interruptions
      navigator.mediaSession.setActionHandler('play', async () => {
        const el = audioRef.current;
        if (!el) { togglePlay(); return; }

        console.log('[Player] Media Session play triggered');

        // Step 1: Resume AudioContext if suspended (Chrome Android requirement after interruption)
        try {
          const ctx = (window as any).__melodyAudioCtx;
          if (ctx && ctx.state === 'suspended') {
            await ctx.resume();
            console.log('[Player] AudioContext resumed');
          }
        } catch {}

        // Step 2: Ensure src is loaded
        if (!el.src || el.src === '' || el.src === window.location.href) {
          if (currentTrackRef.current) {
            el.src = currentTrackRef.current.src;
            el.load();
            console.log('[Player] Reloaded audio src after interruption');
          }
        }

        // Step 3: Try to play with retries
        const tryPlay = async (attempt: number): Promise<boolean> => {
          try {
            await el.play();
            console.log('[Player] Play succeeded on attempt', attempt);
            return true;
          } catch (err) {
            console.warn('[Player] Play attempt', attempt, 'failed:', err);
            if (attempt < 3) {
              // Reload src and retry
              if (currentTrackRef.current) {
                const savedTime = el.currentTime;
                el.src = currentTrackRef.current.src;
                el.load();
                await new Promise(r => setTimeout(r, 300));
                el.currentTime = savedTime;
                return tryPlay(attempt + 1);
              }
            }
            return false;
          }
        };

        const success = await tryPlay(1);
        if (!isPlayingRef.current) togglePlay(); // Sync React state
        if (success) {
          navigator.mediaSession.playbackState = 'playing';
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        const el = audioRef.current;
        if (el && !el.paused) el.pause();
        togglePlay();
      });

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
      } catch {}
    };

    // Register immediately
    registerHandlers();

    // Re-register when app comes back from background (after phone call)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Player] App resumed from background');
        // Small delay to let the system settle after phone call
        setTimeout(() => {
          registerHandlers();
          const el = audioRef.current;
          if (el) {
            if (!el.paused) {
              navigator.mediaSession.playbackState = 'playing';
            } else if (el.src && el.currentTime > 0) {
              // Audio was paused by system (phone call)
              navigator.mediaSession.playbackState = 'paused';
              // Sync React state if needed
              if (isPlayingRef.current) {
                togglePlay(); // Set to paused in React
              }
            }
          }
        }, 500);
      }
    };

    const onFocus = () => {
      registerHandlers();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
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
    <>
    <GlassCard className="!p-3 !rounded-2xl md:!rounded-3xl bg-white/80 shadow-2xl backdrop-blur-2xl border-white/60 w-full overflow-hidden">
      <audio ref={audioRef} />

      <div className="flex flex-col gap-2">
        {/* Row 1: Track info + min/close */}
        <div className="flex items-center gap-2">
          {/* Cover */}
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl overflow-hidden shadow-lg border border-gold-100 flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
            <img src={coverUrl || coverFallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = coverFallback; }} />
          </div>

          {/* Title / Artist + Lyrics + Fav */}
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-elegant-black truncate text-sm md:text-base">{currentTrack.title}</h4>
              <p className="text-xs text-elegant-gray truncate">{currentTrack.artist}</p>
            </div>
            <button onClick={handleShowLyrics}
              className={'p-1.5 rounded-full active:scale-90 transition-all flex-shrink-0 ' + (showLyrics ? 'text-gold-500 bg-gold-100' : 'text-gray-400 hover:text-gold-500')}>
              <AlignLeft size={15} />
            </button>
            <button onClick={handleToggleFav}
              className={'p-1.5 rounded-full active:scale-90 transition-all flex-shrink-0 ' + (isFav ? 'text-red-500' : 'text-gray-400 hover:text-red-400')}>
              <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
            </button>
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
          <div className="relative">
            <button onClick={() => setShowSleepMenu(!showSleepMenu)}
              className={`p-1.5 rounded-full transition-colors relative ${sleepMinutes > 0 ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-400 hover:text-elegant-black'}`}>
              <Moon size={15} />
              {sleepRemaining > 0 && (
                <span className="absolute -top-1 -right-2 text-[8px] text-indigo-400 font-bold whitespace-nowrap">{formatSleepRemaining()}</span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Progress bar */}
        <div className="flex items-center gap-2 text-[10px] text-elegant-gray font-medium px-1">

        {/* Sleep timer menu - rendered via portal outside player container */}
        {showSleepMenu && createPortal(
          <>
            <div className="fixed inset-0 z-[299] bg-black/40" onClick={() => setShowSleepMenu(false)} />
            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[300] bg-[#1a1a2e] border border-white/15 rounded-2xl shadow-2xl p-3 w-52">
              <p className="text-[10px] uppercase font-bold text-gray-500 px-2 mb-2 tracking-wider">Temporizador de sueno</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[5, 10, 15, 30, 45, 60, 90, 120].map(m => (
                  <button key={m} onClick={() => startSleepTimer(m)}
                    className={'px-3 py-2.5 text-xs rounded-xl transition-colors text-center ' + (sleepMinutes === m ? 'bg-indigo-500/30 text-indigo-300 font-bold border border-indigo-500/30' : 'text-gray-300 hover:bg-white/10 bg-white/5')}>
                    {m < 60 ? `${m} min` : `${m / 60}h`}
                  </button>
                ))}
              </div>
              {sleepMinutes > 0 && (
                <button onClick={cancelSleepTimer}
                  className="w-full text-center px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl mt-2 border border-red-500/20">
                  Cancelar ({formatSleepRemaining()})
                </button>
              )}
            </div>
          </>,
          document.body
        )}
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

    {/* Lyrics modal - via portal */}
    {showLyrics && createPortal(
      <>
        <div className="fixed inset-0 z-[298] bg-black/50" onClick={() => setShowLyrics(false)} />
        <div className="fixed inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[480px] top-4 bottom-36 z-[299] bg-[#111318] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-gold-300 to-gold-500 flex-shrink-0">
              <img src={coverUrl || coverFallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = coverFallback; }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{currentTrack?.title}</p>
              <p className="text-[10px] text-gray-400 truncate">{currentTrack?.artist}</p>
            </div>
            <button onClick={() => setShowLyrics(false)} className="p-1.5 text-gray-500 hover:text-white rounded-full">
              <X size={18} />
            </button>
          </div>
          {/* Lyrics content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingLyrics ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Buscando letra...</p>
              </div>
            ) : (
              <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                {lyrics.split('\n').map((line, i) => {
                  // Make URLs clickable
                  const urlMatch = line.match(/(https?:\/\/\S+)/);
                  if (urlMatch) {
                    const parts = line.split(urlMatch[0]);
                    return (
                      <p key={i}>
                        {parts[0]}
                        <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer"
                          className="text-gold-400 underline break-all" onClick={(e) => e.stopPropagation()}>
                          {urlMatch[0].length > 45 ? urlMatch[0].substring(0, 45) + '...' : urlMatch[0]}
                        </a>
                        {parts[1]}
                      </p>
                    );
                  }
                  return line === '' ? <br key={i} /> : <p key={i}>{line}</p>;
                })}
              </div>
            )}
          </div>
        </div>
      </>,
      document.body
    )}
  </>
  );
};