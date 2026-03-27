import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Radio as RadioIcon, Play, Pause, Volume2, VolumeX, RefreshCw, Mic, Square, Loader2 } from 'lucide-react';
import { uploadFile } from '../services/storageService';
import { addTrackToFirestore } from '../services/trackService';

interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  urls: string[]; // multiple fallback URLs
  color: string;
  logo: string;
}

// Multiple URLs per station for fallback
const STATIONS: RadioStation[] = [
  {
    id: 'canalsur',
    name: 'Canal Sur Radio',
    frequency: '105.1 FM · Sevilla',
    urls: [], // Will be resolved dynamically
    color: 'from-green-500 to-green-700',
    logo: 'CS',
  },
  {
    id: 'cadena-ser',
    name: 'Cadena SER Sevilla',
    frequency: '103.2 FM · Sevilla',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASERAAC.aac',
      'https://20853.live.streamtheworld.com/CADENASERAAC.aac',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASERMP3',
    ],
    color: 'from-blue-500 to-blue-700',
    logo: 'SER',
  },
  {
    id: 'onda-cero',
    name: 'Onda Cero Sevilla',
    frequency: '95.7 FM · Sevilla',
    urls: [
      'https://atres-live.ondacero.es/live/ondacero/master.m3u8',
      'https://stream-ondacero.atresplayer.com/live/ondacero/master.m3u8',
      'https://ondacero-ice.flumotion.com/ondacero/ondacero.mp3',
    ],
    color: 'from-orange-500 to-orange-700',
    logo: 'OC',
  },
];

export const Radio = () => {
  const { closePlayer, user, refreshStorageUsage } = useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tryingUrl, setTryingUrl] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<Record<string, string>>({});
  const metaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [savingRecording, setSavingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) closePlayer();
  }, [isPlaying]);

  // Fetch now-playing metadata for the active station
  const fetchNowPlaying = async (stationId: string) => {
    try {
      if (stationId === 'canalsur') {
        // Canal Sur: try radio-browser API metadata
        const res = await fetch('https://de1.api.radio-browser.info/json/stations/search?name=Canal+Sur+Radio&countrycode=ES&limit=3&order=clickcount&reverse=true');
        if (res.ok) {
          const data = await res.json();
          // Check if any station has tags or metadata we can use
          for (const st of data) {
            if (st.tags) {
              setNowPlaying(prev => ({ ...prev, [stationId]: st.tags.split(',')[0] || 'Canal Sur Radio en directo' }));
              return;
            }
          }
        }
        // Fallback: try RTVA page for schedule info
        setNowPlaying(prev => ({ ...prev, [stationId]: 'Canal Sur Radio · En directo' }));
      } else if (stationId === 'cadena-ser') {
        // Cadena SER: StreamTheWorld metadata via ICY
        const res = await fetch('https://de1.api.radio-browser.info/json/stations/search?name=Cadena+SER&countrycode=ES&limit=3&order=clickcount&reverse=true&has_extended_info=true');
        if (res.ok) {
          const data = await res.json();
          for (const st of data) {
            if (st.tags) {
              setNowPlaying(prev => ({ ...prev, [stationId]: 'Cadena SER · ' + (st.tags.split(',')[0] || 'En directo') }));
              return;
            }
          }
        }
        setNowPlaying(prev => ({ ...prev, [stationId]: 'Cadena SER Sevilla · En directo' }));
      } else if (stationId === 'onda-cero') {
        setNowPlaying(prev => ({ ...prev, [stationId]: 'Onda Cero Sevilla · En directo' }));
      }
    } catch {
      // Silent fail - just keep previous value
    }
  };

  // Start/stop metadata polling when station changes
  useEffect(() => {
    if (metaIntervalRef.current) { clearInterval(metaIntervalRef.current); metaIntervalRef.current = null; }
    if (!activeStation || !isPlaying) return;

    // Fetch immediately
    fetchNowPlaying(activeStation);
    // Then every 30 seconds
    metaIntervalRef.current = setInterval(() => {
      if (activeStation) fetchNowPlaying(activeStation);
    }, 30000);

    return () => { if (metaIntervalRef.current) clearInterval(metaIntervalRef.current); };
  }, [activeStation, isPlaying]);

  // Update Media Session when now playing changes (shows on car/Bluetooth screen)
  useEffect(() => {
    if (!activeStation || !isPlaying || !('mediaSession' in navigator)) return;
    const station = STATIONS.find(s => s.id === activeStation);
    if (!station) return;
    const program = nowPlaying[activeStation] || '';
    navigator.mediaSession.metadata = new MediaMetadata({
      title: program || station.name,
      artist: program ? station.name : station.frequency,
      album: 'Radio en directo',
    });
  }, [nowPlaying, activeStation, isPlaying]);

  const tryPlayUrl = async (el: HTMLAudioElement, urls: string[], index: number, stationId: string): Promise<boolean> => {
    if (index >= urls.length) return false;

    const url = urls[index];
    console.log(`[Radio] Trying URL ${index + 1}/${urls.length}:`, url);
    setTryingUrl(index + 1);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[Radio] Timeout on URL', index + 1);
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('error', onError);
        // Try next URL
        tryPlayUrl(el, urls, index + 1, stationId).then(resolve);
      }, 8000); // 8 second timeout per URL

      const onCanPlay = () => {
        clearTimeout(timeout);
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('error', onError);
        el.play().then(() => {
          console.log('[Radio] Playing:', url);
          resolve(true);
        }).catch(() => {
          tryPlayUrl(el, urls, index + 1, stationId).then(resolve);
        });
      };

      const onError = () => {
        clearTimeout(timeout);
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('error', onError);
        console.log('[Radio] Error on URL', index + 1);
        tryPlayUrl(el, urls, index + 1, stationId).then(resolve);
      };

      el.addEventListener('canplay', onCanPlay, { once: true });
      el.addEventListener('error', onError, { once: true });
      el.src = url;
      el.load();
    });
  };

  // Resolve station URLs dynamically from radio-browser API
  const resolveStationUrls = async (stationId: string, searchName: string, fallbacks: string[]): Promise<string[]> => {
    try {
      const res = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(searchName)}&countrycode=ES&limit=5&order=clickcount&reverse=true`);
      if (res.ok) {
        const data = await res.json();
        const urls: string[] = [];
        for (const st of data) {
          if (st.url_resolved && st.lastcheckok === 1) urls.push(st.url_resolved);
          else if (st.url && st.lastcheckok === 1) urls.push(st.url);
        }
        if (urls.length > 0) {
          console.log(`[Radio] ${stationId} resolved URLs:`, urls);
          return [...urls, ...fallbacks];
        }
      }
    } catch (err) {
      console.warn(`[Radio] API lookup failed for ${stationId}, using fallbacks`);
    }
    return fallbacks;
  };

  const playStation = async (station: RadioStation) => {
    const el = audioRef.current;
    if (!el) return;

    // Toggle off if already playing this station
    if (activeStation === station.id && isPlaying) {
      el.pause();
      el.src = '';
      setIsPlaying(false);
      setActiveStation(null);
      return;
    }

    // Stop current
    el.pause();
    setLoading(true);
    setError('');
    setActiveStation(station.id);
    el.volume = volume;

    // Resolve URLs dynamically for stations without static URLs
    let urls = station.urls;
    if (station.id === 'canalsur') {
      urls = await resolveStationUrls('canalsur', 'Canal Sur Radio', [
        'https://rtva-canalsurradio-live.flumotion.com/rtva/canalsurradio_master.mp3',
        'https://canalsurradio.rtva.stream.flumotion.com/rtva/canalsurradio_master.mp3',
        'https://cdn.streamradio.es/canalsurradio.mp3',
      ]);
    }
    if (urls.length === 0) {
      setLoading(false);
      setError('No se encontraron URLs para esta emisora.');
      setActiveStation(null);
      return;
    }

    const success = await tryPlayUrl(el, urls, 0, station.id);

    if (success) {
      setIsPlaying(true);
      setLoading(false);
      // Media Session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: station.frequency,
          album: 'Radio en directo',
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => { el.play(); setIsPlaying(true); });
        navigator.mediaSession.setActionHandler('pause', () => { el.pause(); setIsPlaying(false); });
        navigator.mediaSession.setActionHandler('stop', () => stopRadio());
      }
    } else {
      setLoading(false);
      setIsPlaying(false);
      setActiveStation(null);
      setError(`No se pudo conectar con ${station.name}. La emisora puede estar temporalmente fuera de servicio.`);
    }
  };

  const stopRadio = () => {
    const el = audioRef.current;
    if (el) { el.pause(); el.src = ''; }
    setIsPlaying(false);
    setActiveStation(null);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  // Start recording the current radio stream
  const startRecording = () => {
    const el = audioRef.current;
    if (!el || !isPlaying || !activeStation) return;

    try {
      // Capture audio from the element using captureStream
      const stream = (el as any).captureStream?.() || (el as any).mozCaptureStream?.();
      if (!stream) {
        setError('Tu navegador no soporta la grabacion de audio');
        return;
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Save the recording
        saveRecording();
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      recordTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('[Radio] Recording started');
    } catch (err: any) {
      console.error('[Radio] Recording error:', err);
      setError('No se pudo iniciar la grabacion: ' + (err.message || ''));
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setIsRecording(false);
    console.log('[Radio] Recording stopped');
  };

  // Save recording to Firebase Storage + Firestore
  const saveRecording = async () => {
    if (chunksRef.current.length === 0 || !user || !activeStation) return;
    setSavingRecording(true);

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const stationName = STATIONS.find(s => s.id === activeStation)?.name || 'Radio';
      const now = new Date();
      const dateStr = now.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const fileName = `${stationName} ${dateStr} ${timeStr}.webm`;

      // Convert blob to File
      const file = new File([blob], fileName, { type: 'audio/webm' });
      const trackId = 'rec_' + Date.now();

      // Upload to Firebase Storage
      const { promise } = uploadFile(file, 'audio', trackId, () => {});
      const { url, storagePath } = await promise;

      // Create track in Firestore
      await addTrackToFirestore({
        title: `${stationName} - ${dateStr} ${timeStr}`,
        artist: stationName,
        folder: 'Directos Radio',
        coverUrl: '',
        src: url,
        storagePath,
        duration: recordingTime,
        type: 'audio',
        fileSize: blob.size,
        addedAt: Date.now(),
        addedBy: user.uid,
      });

      await refreshStorageUsage();
      console.log('[Radio] Recording saved:', fileName);
      chunksRef.current = [];
    } catch (err: any) {
      console.error('[Radio] Save error:', err);
      setError('Error al guardar la grabacion');
    }
    setSavingRecording(false);
  };

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />

      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <RadioIcon size={24} className="text-gold-400" /> Radio en Directo
      </h2>
      <p className="text-sm text-gray-400 -mt-3">Emisoras de Sevilla</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATIONS.map(station => {
          const isActive = activeStation === station.id;
          const isThisPlaying = isActive && isPlaying;
          const isThisLoading = isActive && loading;
          return (
            <GlassCard key={station.id}
              className={'relative overflow-hidden cursor-pointer transition-all active:scale-[0.98] ' + (
                isThisPlaying
                  ? 'border-gold-500/50 bg-white/15 shadow-xl shadow-gold-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              )}
              onClick={() => !loading && playStation(station)}>
              <div className={`absolute inset-0 bg-gradient-to-br ${station.color} opacity-10`} />
              <div className="relative flex items-center gap-4 p-1">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${station.color} flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0`}>
                  {station.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm">{station.name}</h3>
                  <p className="text-xs text-gray-400">{station.frequency}</p>
                  {isThisPlaying && (
                    <div className="mt-1">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] text-red-400 font-bold uppercase">En directo</span>
                      </div>
                      {nowPlaying[station.id] && (
                        <p className="text-[10px] text-gold-400/80 truncate mt-0.5">{nowPlaying[station.id]}</p>
                      )}
                    </div>
                  )}
                  {isThisLoading && (
                    <p className="text-[10px] text-yellow-400 mt-1">Conectando... (URL {tryingUrl})</p>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  isThisPlaying ? 'bg-gold-500 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {isThisLoading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : isThisPlaying ? (
                    <Pause size={18} fill="white" />
                  ) : (
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  )}
                </div>
              </div>
              {isThisPlaying && (
                <div className="relative flex items-end gap-0.5 justify-center mt-3 h-4">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                    <div key={i} className="w-1 bg-gold-400/60 rounded-full"
                      style={{
                        animation: `eqBar ${0.4 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                        animationDelay: `${Math.random() * 0.3}s`,
                        height: '4px',
                      }} />
                  ))}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-red-400 text-xs">{error}</p>
          <p className="text-gray-500 text-[10px] mt-1">Prueba de nuevo en unos minutos</p>
        </div>
      )}

      {isPlaying && (
        <GlassCard className="bg-white/5 border-white/10 !p-4">
          <div className="flex items-center gap-3">
            <button onClick={stopRadio} className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 active:scale-95">
              <Pause size={18} fill="currentColor" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {STATIONS.find(s => s.id === activeStation)?.name}
              </p>
              {activeStation && nowPlaying[activeStation] ? (
                <p className="text-[10px] text-gold-400/80 truncate">{nowPlaying[activeStation]}</p>
              ) : (
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> En directo
                </p>
              )}
            </div>

            {/* Recording button */}
            {savingRecording ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gold-500/10 rounded-xl">
                <Loader2 size={14} className="animate-spin text-gold-400" />
                <span className="text-[10px] text-gold-400 font-bold">Guardando...</span>
              </div>
            ) : isRecording ? (
              <button onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl active:scale-95">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 font-bold font-mono">{formatRecTime(recordingTime)}</span>
                <Square size={12} className="text-red-400" fill="currentColor" />
              </button>
            ) : (
              <button onClick={startRecording}
                className="p-2 bg-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl active:scale-95 transition-colors"
                title="Grabar">
                <Mic size={16} />
              </button>
            )}

            <div className="flex items-center gap-2">
              {volume === 0 ? <VolumeX size={16} className="text-gray-500" /> : <Volume2 size={16} className="text-gray-400" />}
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => handleVolume(parseFloat(e.target.value))}
                className="w-16 md:w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:rounded-full" />
            </div>
          </div>
        </GlassCard>
      )}

      <style>{`
        @keyframes eqBar {
          0% { height: 3px; }
          100% { height: 16px; }
        }
      `}</style>
    </div>
  );
};