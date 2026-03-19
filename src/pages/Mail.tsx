import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Mail as MailIcon, Send, Inbox, Trash2, ArrowLeft, Check, Circle } from 'lucide-react';
import { subscribeToInbox, subscribeToSent, sendMail, markMailRead, deleteMailForUser } from '../services/mailService';
import { MailMessage } from '../types';

export const Mail = () => {
  const { user, users } = useApp();
  const [tab, setTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [inbox, setInbox] = useState<MailMessage[]>([]);
  const [sent, setSent] = useState<MailMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<MailMessage | null>(null);
  const [toUid, setToUid] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendOk, setSendOk] = useState('');

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToInbox(user.uid, setInbox);
    const u2 = subscribeToSent(user.uid, setSent);
    return () => { u1(); u2(); };
  }, [user]);

  const otherUsers = useMemo(() => users.filter(u => u.uid !== user?.uid), [users, user]);
  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Desconocido';
  const unreadCount = inbox.filter(m => !m.read).length;

  const handleSend = async () => {
    if (!user || !toUid || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      await sendMail(user.uid, toUid, subject.trim(), body.trim());
      setSendOk('Mensaje enviado');
      setToUid(''); setSubject(''); setBody('');
      setTimeout(() => { setSendOk(''); setTab('sent'); }, 1500);
    } catch (err) { console.error(err); setSendOk('Error al enviar'); }
    setSending(false);
  };

  const handleOpenMsg = async (msg: MailMessage) => {
    setSelectedMsg(msg);
    if (!msg.read && msg.to === user?.uid) markMailRead(msg.id).catch(() => {});
  };

  const handleDelete = async (msg: MailMessage) => {
    if (!user) return;
    await deleteMailForUser(msg.id, user.uid, msg).catch(() => {});
    setSelectedMsg(null);
  };

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return mins + ' min';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h';
    return Math.floor(hrs / 24) + 'd';
  };

  if (!user) return null;

  if (selectedMsg) {
    const isInbox = selectedMsg.to === user.uid;
    return (
      <div className="flex flex-col gap-4 h-full">
        <button onClick={() => setSelectedMsg(null)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-fit">
          <ArrowLeft size={16} /> Volver
        </button>
        <GlassCard className="bg-white/5 border-white/10 !p-5 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white truncate flex-1 mr-2">{selectedMsg.subject}</h3>
            <button onClick={() => handleDelete(selectedMsg)} className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex-shrink-0"><Trash2 size={16} /></button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 pb-3 border-b border-white/10">
            <span className="font-bold text-white">{isInbox ? 'De' : 'Para'}:</span>
            <span>{getUserName(isInbox ? selectedMsg.from : selectedMsg.to)}</span>
            <span className="ml-auto flex-shrink-0">{new Date(selectedMsg.createdAt).toLocaleString('es')}</span>
          </div>
          <div className="text-white text-sm whitespace-pre-wrap leading-relaxed">{selectedMsg.body}</div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <MailIcon size={24} className="text-gold-400" /> Correo Interno
      </h2>

      <div className="flex gap-1 bg-white/5 rounded-xl p-1 flex-shrink-0">
        <button onClick={() => setTab('inbox')} className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 ' + (tab === 'inbox' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Inbox size={14} /> Entrada {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full ml-1">{unreadCount}</span>}
        </button>
        <button onClick={() => setTab('sent')} className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 ' + (tab === 'sent' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          <Send size={14} /> Enviados
        </button>
        <button onClick={() => setTab('compose')} className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors ' + (tab === 'compose' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          Nuevo
        </button>
      </div>

      {tab === 'compose' && (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400">Para</label>
            <select value={toUid} onChange={(e) => setToUid(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white text-sm">
              <option value="" className="bg-gray-900">Seleccionar usuario...</option>
              {otherUsers.map(u => <option key={u.uid} value={u.uid} className="bg-gray-900">{u.displayName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400">Asunto</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto"
              className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" />
          </div>
          <div className="flex-1 flex flex-col">
            <label className="text-[10px] uppercase font-bold text-gray-400">Mensaje</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje..."
              className="flex-1 min-h-[100px] bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm resize-none" />
          </div>
          {sendOk && <p className={'text-sm ' + (sendOk.includes('Error') ? 'text-red-400' : 'text-green-400')}>{sendOk}</p>}
          <button onClick={handleSend} disabled={sending || !toUid || !subject.trim() || !body.trim()}
            className="bg-gold-500 text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0">
            <Send size={16} /> {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      )}

      {tab === 'inbox' && (
        <div className="flex-1 overflow-y-auto space-y-1">
          {inbox.length === 0 ? (
            <div className="text-center text-white/30 py-16"><Inbox size={40} className="mx-auto mb-2 opacity-30" /><p>No hay mensajes</p></div>
          ) : inbox.map(msg => (
            <div key={msg.id} onClick={() => handleOpenMsg(msg)}
              className={'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ' + (msg.read ? 'hover:bg-white/5' : 'bg-gold-500/5 hover:bg-gold-500/10 border border-gold-500/20')}>
              <div className="flex-shrink-0">{msg.read ? <Check size={14} className="text-gray-600" /> : <Circle size={10} className="text-gold-400 fill-gold-400" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={'text-sm truncate ' + (msg.read ? 'text-gray-400' : 'text-white font-bold')}>{getUserName(msg.from)}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(msg.createdAt)}</span>
                </div>
                <p className={'text-xs truncate ' + (msg.read ? 'text-gray-500' : 'text-gray-300')}>{msg.subject}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sent' && (
        <div className="flex-1 overflow-y-auto space-y-1">
          {sent.length === 0 ? (
            <div className="text-center text-white/30 py-16"><Send size={40} className="mx-auto mb-2 opacity-30" /><p>No hay enviados</p></div>
          ) : sent.map(msg => (
            <div key={msg.id} onClick={() => handleOpenMsg(msg)}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
              <Send size={14} className="text-gray-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300 truncate">Para: {getUserName(msg.to)}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(msg.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{msg.subject}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};