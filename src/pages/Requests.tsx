import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Inbox, Send, Music, Clock, CheckCircle, XCircle, Upload, Trash2, MessageSquare } from 'lucide-react';
import { subscribeToRequests, createRequest, updateRequestStatus, deleteRequest, SongRequest } from '../services/requestService';
import { UserRole } from '../types';

export const Requests = () => {
  const { user, users } = useApp();
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sendOk, setSendOk] = useState('');
  const [tab, setTab] = useState<'form' | 'mine' | 'all'>('form');
  const [responseText, setResponseText] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const isMaster = user?.role === UserRole.MASTER;
  const isAdmin = user?.role === UserRole.ADMIN || isMaster;
  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Usuario';

  useEffect(() => {
    const unsub = subscribeToRequests(setRequests);
    return () => unsub();
  }, []);

  const myRequests = useMemo(() => requests.filter(r => r.requestedBy === user?.uid), [requests, user]);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const handleSend = async () => {
    if (!user || !title.trim() || !artist.trim()) return;
    setSending(true);
    try {
      await createRequest(title.trim(), artist.trim(), notes.trim(), user.uid);
      setSendOk('Solicitud enviada correctamente');
      setTitle(''); setArtist(''); setNotes('');
      setTimeout(() => { setSendOk(''); setTab('mine'); }, 1500);
    } catch (err) { console.error(err); }
    setSending(false);
  };

  const handleResolve = async (id: string, status: SongRequest['status']) => {
    if (!user) return;
    await updateRequestStatus(id, status, user.uid, responseText.trim() || undefined).catch(() => {});
    setRespondingId(null); setResponseText('');
  };

  const statusBadge = (s: SongRequest['status']) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-500/15 border-yellow-500/30', text: 'text-yellow-400', label: 'Pendiente' },
      approved: { bg: 'bg-green-500/15 border-green-500/30', text: 'text-green-400', label: 'Aprobada' },
      rejected: { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', label: 'Rechazada' },
      uploaded: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', label: 'Subida' },
    };
    const c = map[s] || map.pending;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  const statusIcon = (s: SongRequest['status']) => {
    if (s === 'approved' || s === 'uploaded') return <CheckCircle size={14} className="text-green-400" />;
    if (s === 'rejected') return <XCircle size={14} className="text-red-400" />;
    return <Clock size={14} className="text-yellow-400" />;
  };

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return mins + ' min';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h';
    const days = Math.floor(hrs / 24);
    return days + 'd';
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Inbox size={24} className="text-gold-400" /> Buzon de Solicitudes
        </h2>
        {isAdmin && pendingCount > 0 && (
          <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-500/30">
            {pendingCount} pendientes
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 flex-shrink-0">
        <button onClick={() => setTab('form')} className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 ' + (tab === 'form' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Send size={14} /> Solicitar
        </button>
        <button onClick={() => setTab('mine')} className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 ' + (tab === 'mine' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Music size={14} /> Mis Solicitudes
        </button>
        {isAdmin && (
          <button onClick={() => setTab('all')} className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 ' + (tab === 'all' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
            <Inbox size={14} /> Todas {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>}
          </button>
        )}
      </div>

      {/* Form */}
      {tab === 'form' && (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          <GlassCard className="bg-white/5 border-white/10 !p-5 flex flex-col gap-3">
            <p className="text-sm text-gray-300 mb-1">Solicita una cancion o video para que se suba a la biblioteca de Melody Music.</p>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400">Titulo de la cancion *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Despacito"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400">Artista *</label>
              <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ej: Luis Fonsi"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400">Notas adicionales (opcional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Version especifica, remix, album..."
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm resize-none min-h-[60px]" />
            </div>
            {sendOk && <p className="text-green-400 text-sm">{sendOk}</p>}
            <button onClick={handleSend} disabled={sending || !title.trim() || !artist.trim()}
              className="bg-gold-500 text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
              <Send size={16} /> {sending ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </GlassCard>
        </div>
      )}

      {/* My requests */}
      {tab === 'mine' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {myRequests.length === 0 ? (
            <div className="text-center text-white/30 py-16"><Music size={40} className="mx-auto mb-2 opacity-30" /><p>No has hecho solicitudes</p></div>
          ) : myRequests.map(req => (
            <GlassCard key={req.id} className="bg-white/5 border-white/10 !p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon(req.status)}
                    <h4 className="text-sm font-bold text-white truncate">{req.title}</h4>
                    {statusBadge(req.status)}
                  </div>
                  <p className="text-xs text-gray-400">{req.artist}</p>
                  {req.notes && <p className="text-xs text-gray-500 mt-1 italic">{req.notes}</p>}
                  {req.response && (
                    <div className="mt-2 bg-white/5 rounded-lg p-2 border border-white/10">
                      <p className="text-[10px] text-gold-400 font-bold">Respuesta del admin:</p>
                      <p className="text-xs text-gray-300">{req.response}</p>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(req.createdAt)}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* All requests - Admin/Master */}
      {tab === 'all' && isAdmin && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {requests.length === 0 ? (
            <div className="text-center text-white/30 py-16"><Inbox size={40} className="mx-auto mb-2 opacity-30" /><p>No hay solicitudes</p></div>
          ) : requests.map(req => (
            <GlassCard key={req.id} className={'bg-white/5 border-white/10 !p-4 ' + (req.status === 'pending' ? 'border-l-4 border-l-yellow-500/50' : '')}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {statusIcon(req.status)}
                    <h4 className="text-sm font-bold text-white">{req.title}</h4>
                    {statusBadge(req.status)}
                  </div>
                  <p className="text-xs text-gray-400">{req.artist}</p>
                  {req.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{req.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-gold-400 font-bold">{getUserName(req.requestedBy)}</p>
                  <p className="text-[10px] text-gray-600">{timeAgo(req.createdAt)}</p>
                </div>
              </div>

              {req.response && (
                <div className="bg-white/5 rounded-lg p-2 border border-white/10 mb-2">
                  <p className="text-[10px] text-gold-400 font-bold">Respuesta: <span className="text-gray-500 font-normal">{getUserName(req.resolvedBy || '')}</span></p>
                  <p className="text-xs text-gray-300">{req.response}</p>
                </div>
              )}

              {/* Action buttons for pending */}
              {req.status === 'pending' && (
                <div className="flex flex-col gap-2">
                  {respondingId === req.id ? (
                    <div className="flex flex-col gap-2">
                      <input type="text" value={responseText} onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Respuesta al usuario (opcional)..."
                        className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-xs outline-none focus:border-gold-400 text-white placeholder-gray-500" />
                      <div className="flex gap-2">
                        <button onClick={() => handleResolve(req.id, 'approved')}
                          className="flex-1 flex items-center justify-center gap-1 bg-green-500/20 text-green-400 py-1.5 rounded-lg text-xs font-bold border border-green-500/30 hover:bg-green-500/30">
                          <CheckCircle size={12} /> Aprobar
                        </button>
                        <button onClick={() => handleResolve(req.id, 'uploaded')}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-500/20 text-blue-400 py-1.5 rounded-lg text-xs font-bold border border-blue-500/30 hover:bg-blue-500/30">
                          <Upload size={12} /> Ya subida
                        </button>
                        <button onClick={() => handleResolve(req.id, 'rejected')}
                          className="flex-1 flex items-center justify-center gap-1 bg-red-500/20 text-red-400 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 hover:bg-red-500/30">
                          <XCircle size={12} /> Rechazar
                        </button>
                      </div>
                      <button onClick={() => { setRespondingId(null); setResponseText(''); }} className="text-gray-500 text-[10px] hover:text-white">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setRespondingId(req.id)}
                        className="flex-1 flex items-center justify-center gap-1 bg-gold-500/20 text-gold-400 py-1.5 rounded-lg text-xs font-bold border border-gold-500/30 hover:bg-gold-500/30">
                        <MessageSquare size={12} /> Responder
                      </button>
                      <button onClick={() => deleteRequest(req.id).catch(() => {})}
                        className="p-1.5 text-red-400/40 hover:text-red-400 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              )}

              {/* Delete for resolved */}
              {req.status !== 'pending' && isMaster && (
                <div className="flex justify-end">
                  <button onClick={() => deleteRequest(req.id).catch(() => {})}
                    className="p-1 text-red-400/30 hover:text-red-400 text-[10px] flex items-center gap-1"><Trash2 size={12} /> Eliminar</button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};