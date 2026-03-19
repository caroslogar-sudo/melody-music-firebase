import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getWelcomeMessage, searchYouTubeVideos } from '../services/geminiService';
import { GlassCard } from '../components/ui/GlassCard';
import { StorageMonitor } from '../components/ui/StorageMonitor';
import { useCovers, getCoverFallback } from '../hooks/useCovers';
import { Sparkles, Music2, Youtube, Search, Play, Clock, Film, HardDrive, Inbox, Send } from 'lucide-react';
import { subscribeToRequests, createRequest, SongRequest } from '../services/requestService';
import { UserRole } from '../types';

export const Dashboard = () => {
  const { user, currentTrack, playTrack, library, users } = useApp();
  const [welcomeMsg, setWelcomeMsg] = useState('Cargando...');

  // YouTube Section State
  const [ytQuery, setYtQuery] = useState('');
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [searchingYt, setSearchingYt] = useState(false);

  // Song request (buzón) quick widget
  const [reqTitle, setReqTitle] = useState('');
  const [reqArtist, setReqArtist] = useState('');
  const [reqSending, setReqSending] = useState(false);
  const [reqOk, setReqOk] = useState('');
  const [recentRequests, setRecentRequests] = useState<SongRequest[]>([]);

  useEffect(() => {
    if (user) {
      getWelcomeMessage(user.displayName).then(setWelcomeMsg);
    }
  }, [user]);

  // Subscribe to song requests
  useEffect(() => {
    const unsub = subscribeToRequests((reqs) => {
      setRecentRequests(reqs.slice(0, 5));
    });
    return () => unsub();
  }, []);

  const handleQuickRequest = async () => {
    if (!user || !reqTitle.trim() || !reqArtist.trim()) return;
    setReqSending(true);
    try {
      await createRequest(reqTitle.trim(), reqArtist.trim(), '', user.uid);
      setReqOk('Solicitud enviada');
      setReqTitle(''); setReqArtist('');
      setTimeout(() => setReqOk(''), 2000);
    } catch { }
    setReqSending(false);
  };

  const handleYouTubeSearch = async () => {
    if (!ytQuery) return;
    setSearchingYt(true);
    const results = await searchYouTubeVideos(ytQuery);
    setYtResults(results);
    setSearchingYt(false);
  };

  const recentTracks = [...library]
    .filter(t => t.title !== '.keep')
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 6);

  const mostPlayed = [...library]
    .filter(t => t.title !== '.keep' && t.type === 'audio' && (t.playCount || 0) > 0)
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
    .slice(0, 8);

  const allCoverTracks = [...new Map([...recentTracks, ...mostPlayed].map(t => [t.id, t])).values()];
  const covers = useCovers(allCoverTracks);

  const getUserName = (uid?: string) => {
    if (!uid) return '';
    const u = users.find(x => x.uid === uid);
    return u?.displayName || '';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner */}
      <GlassCard className="bg-gradient-to-r from-gold-100 to-white border-gold-200">
        <h1 className="text-2xl md:text-3xl font-bold text-elegant-black">Hola, {user?.displayName}</h1>
        <p className="text-elegant-gray mt-2 font-medium italic">"{welcomeMsg}"</p>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* YouTube Section */}
          <GlassCard className="bg-[#FF0000]/15 border-red-500/30 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <Youtube size={24} className="text-red-500" />
              <h3 className="text-xl font-bold text-white">YouTube Discovery</h3>
            </div>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleYouTubeSearch()}
                placeholder="Buscar videos musicales..."
                className="flex-1 bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white outline-none focus:border-red-500 placeholder-white/30"
              />
              <button
                onClick={handleYouTubeSearch}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                {searchingYt ? '...' : <Search size={20} />}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ytResults.length > 0 ? ytResults.map((video, idx) => (
                <div key={idx}
                  onClick={() => {
                    const q = encodeURIComponent(`${video.title} ${video.channel || ''}`);
                    window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
                  }}
                  className="bg-black/40 rounded-lg overflow-hidden border border-white/10 transition-all cursor-pointer hover:border-red-500/50 hover:scale-[1.02] active:scale-[0.98]">
                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative group flex items-center justify-center">
                    <Youtube size={36} className="text-red-500/20 absolute" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/5 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play fill="white" className="text-white ml-0.5" size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <h4 className="text-white font-bold text-xs truncate">{video.title}</h4>
                    <p className="text-gray-400 text-[10px]">{video.channel}</p>
                  </div>
                </div>
              )) : (
                <div className="col-span-3 text-center text-white/30 py-4 text-sm flex flex-col items-center">
                  <Search size={24} className="mb-2 opacity-50" />
                  Busca tus artistas favoritos para ver sus videos.
                </div>
              )}
            </div>
          </GlassCard>

          {/* Recent Library (Last 6) */}
          <div>
            <h3 className="text-xl font-bold text-white px-2 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-gold-400" /> Subido recientemente
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {recentTracks.map(track => {
                const coverImg = covers[track.id] || track.coverUrl || '';
                const fallback = getCoverFallback(track.artist);
                return (
                  <GlassCard key={track.id} className="cursor-pointer border-white/20 bg-white/15 hover:bg-white/20 transition-colors !p-3" onClick={() => track.type === 'audio' && playTrack(track)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden shadow-sm flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
                        {track.type === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center"><Film size={18} className="text-white" /></div>
                        ) : (
                          <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white line-clamp-1 text-sm">{track.title}</h4>
                        <p className="text-xs text-gold-100/80 line-clamp-1">{track.artist}</p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
              {recentTracks.length === 0 && (
                <div className="col-span-3 text-center text-white/40 italic py-4">No hay actividad reciente.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">

          {/* Song Request Widget (Buzón) */}
          <GlassCard className="bg-gradient-to-br from-gold-500/10 to-gold-600/5 border-gold-500/20">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Inbox size={18} className="text-gold-400" /> Buzon de Solicitudes
            </h3>
            <p className="text-xs text-gray-400 mb-3">Solicita canciones para la biblioteca</p>
            <div className="flex flex-col gap-2">
              <input type="text" value={reqTitle} onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Titulo de la cancion..."
                className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-400 text-white placeholder-gray-500" />
              <input type="text" value={reqArtist} onChange={(e) => setReqArtist(e.target.value)}
                placeholder="Artista..."
                onKeyDown={(e) => e.key === 'Enter' && handleQuickRequest()}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-400 text-white placeholder-gray-500" />
              {reqOk && <p className="text-green-400 text-xs">{reqOk}</p>}
              <button onClick={handleQuickRequest} disabled={reqSending || !reqTitle.trim() || !reqArtist.trim()}
                className="bg-gold-500 text-white py-2 rounded-lg font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                <Send size={14} /> {reqSending ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
            {recentRequests.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-[10px] uppercase font-bold text-gray-500 mb-2">Ultimas solicitudes</p>
                <div className="space-y-1.5">
                  {recentRequests.slice(0, 3).map(req => (
                    <div key={req.id} className="flex items-center gap-2 text-xs">
                      <span className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (
                        req.status === 'pending' ? 'bg-yellow-400' :
                        req.status === 'uploaded' ? 'bg-blue-400' :
                        req.status === 'approved' ? 'bg-green-400' : 'bg-red-400'
                      )} />
                      <span className="text-white truncate flex-1">{req.title}</span>
                      <span className="text-gray-600 flex-shrink-0">{req.artist}</span>
                    </div>
                  ))}
                </div>
                <a href="#/requests" className="text-gold-400 text-[10px] font-bold mt-2 inline-block hover:text-gold-300">Ver todas →</a>
              </div>
            )}
          </GlassCard>

          {/* System Status & Storage - Master only */}
          {user?.role === UserRole.MASTER && (
            <>
              <GlassCard className="bg-white/10 border-white/20 backdrop-blur-md">
                <h3 className="font-bold text-white mb-4">Estado del Sistema</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-gray-300">Red</span>
                    <span className="text-green-400 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Online</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-gray-300">Audio</span>
                    <span className="text-white font-medium">Estéreo HQ</span>
                  </div>
                </div>
              </GlassCard>

              <div>
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 px-1">
                  <HardDrive size={18} className="text-gold-400" /> Almacenamiento
                </h3>
                <StorageMonitor />
              </div>
            </>
          )}

          {/* Most Played */}
          <GlassCard className="flex-1 bg-white/15 border-white/30 backdrop-blur-xl shadow-2xl">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-gold-400" /> Lo mas escuchado
            </h3>
            {mostPlayed.length === 0 ? (
              <div className="text-white/50 text-sm flex flex-col items-center justify-center h-40">
                <Music2 size={32} className="mb-2 opacity-30" />
                <p>Reproduce musica para ver estadisticas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mostPlayed.map((track, i) => {
                  const coverImg = covers[track.id] || track.coverUrl || '';
                  const fallback = getCoverFallback(track.artist);
                  const lastBy = getUserName(track.lastPlayedBy);
                  return (
                    <div key={track.id} onClick={() => playTrack(track)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-white/10 hover:border-gold-400/50 hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-full bg-gold-500 text-white flex items-center justify-center font-bold text-xs shadow-lg border border-gold-300 flex-shrink-0">
                        #{i + 1}
                      </div>
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-500">
                        <img src={coverImg || fallback} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-sm truncate">{track.title}</div>
                        <div className="text-gray-400 text-[10px] truncate">{track.artist}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-gold-400 font-bold text-xs">{track.playCount || 0}x</div>
                        {lastBy && <div className="text-gray-500 text-[9px] truncate max-w-[60px]">{lastBy}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

      </div>
    </div>
  );
};