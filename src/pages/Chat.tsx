import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MessageCircle, Send, ArrowLeft, Users, Circle, AlertTriangle } from 'lucide-react';
import { subscribeToDM, subscribeToGroupChat, sendChatMessage, markChatRead, cleanupOldMessages } from '../services/chatService';
import { ChatMessage } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Chat = () => {
  const { user, users, groups } = useApp();
  const [activeChat, setActiveChat] = useState<{ type: 'user' | 'group'; id: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [unreadPerUser, setUnreadPerUser] = useState<Record<string, number>>({});
  const [unreadPerGroup, setUnreadPerGroup] = useState<Record<string, number>>({});

  const otherUsers = useMemo(() => users.filter(u => u.uid !== user?.uid), [users, user]);
  const myGroups = useMemo(() => groups.filter(g => user && g.members.includes(user.uid)), [groups, user]);
  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || '?';
  const isOnline = (uid: string) => users.find(u => u.uid === uid)?.online || false;

  useEffect(() => { cleanupOldMessages().catch(() => {}); }, []);

  // Subscribe to unread counts per user and group
  useEffect(() => {
    if (!user) return;
    const myGroupTargets = myGroups.map(g => 'group:' + g.id);

    const unsub = onSnapshot(collection(db, 'chat'), (snap) => {
      const perUser: Record<string, number> = {};
      const perGroup: Record<string, number> = {};

      snap.docs.forEach(d => {
        const msg = d.data();
        if (msg.from === user.uid) return;
        if (msg.readBy && msg.readBy.includes(user.uid)) return;

        // DM to me
        if (msg.convoId && msg.convoId.includes(user.uid)) {
          const otherUid = msg.from;
          perUser[otherUid] = (perUser[otherUid] || 0) + 1;
        }
        // Group message
        if (msg.to && myGroupTargets.includes(msg.to)) {
          const gid = msg.to.replace('group:', '');
          perGroup[gid] = (perGroup[gid] || 0) + 1;
        }
      });

      setUnreadPerUser(perUser);
      setUnreadPerGroup(perGroup);
    }, () => {});

    return () => unsub();
  }, [user?.uid, myGroups.length]);

  useEffect(() => {
    if (!activeChat || !user) { setMessages([]); return; }
    let unsub: () => void;
    if (activeChat.type === 'user') {
      unsub = subscribeToDM(user.uid, activeChat.id, setMessages);
    } else {
      unsub = subscribeToGroupChat(activeChat.id, setMessages);
    }
    return () => unsub();
  }, [activeChat, user]);

  useEffect(() => {
    if (!user || !messages.length) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const unread = messages.filter(m => m.from !== user.uid && (!m.readBy || !m.readBy.includes(user.uid)));
    if (unread.length > 0) markChatRead(unread.map(m => m.id), user.uid).catch(() => {});
  }, [messages, user]);

  const handleSend = async () => {
    if (!user || !activeChat || !newMsg.trim()) return;
    const text = newMsg.trim();
    setNewMsg('');
    setSending(true);
    try {
      const to = activeChat.type === 'group' ? 'group:' + activeChat.id : activeChat.id;
      await sendChatMessage(user.uid, to, text);
      inputRef.current?.focus();
    } catch (err) { console.error('Send error:', err); }
    setSending(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  const getDaysLeft = (ts: number) => Math.max(0, 5 - Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));

  if (!user) return null;

  // Active chat view
  if (activeChat) {
    const chatName = activeChat.type === 'user'
      ? getUserName(activeChat.id)
      : groups.find(g => g.id === activeChat.id)?.name || 'Grupo';
    const chatOnline = activeChat.type === 'user' && isOnline(activeChat.id);

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 pb-3 border-b border-white/10 flex-shrink-0">
          <button onClick={() => { setActiveChat(null); setMessages([]); }} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10">
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {activeChat.type === 'group' ? <Users size={16} /> : chatName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{chatName}</p>
            {activeChat.type === 'user' && (
              <p className="text-[10px] flex items-center gap-1">
                <Circle size={6} className={chatOnline ? 'fill-green-400 text-green-400' : 'fill-gray-600 text-gray-600'} />
                <span className={chatOnline ? 'text-green-400' : 'text-gray-500'}>{chatOnline ? 'En linea' : 'Desconectado'}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 py-1.5 px-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mt-2 flex-shrink-0">
          <AlertTriangle size={12} className="text-yellow-400 flex-shrink-0" />
          <p className="text-[10px] text-yellow-400/80">Los mensajes se eliminan automaticamente a los 5 dias</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-white/20 py-10"><MessageCircle size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Inicia la conversacion</p></div>
          )}
          {messages.map(msg => {
            const isMe = msg.from === user.uid;
            const daysLeft = getDaysLeft(msg.createdAt);
            return (
              <div key={msg.id} className={'flex ' + (isMe ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[80%] rounded-2xl px-3.5 py-2 ' + (isMe ? 'bg-gold-500/80 text-white rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm')}>
                  {activeChat.type === 'group' && !isMe && (
                    <p className="text-[10px] font-bold text-gold-300 mb-0.5">{getUserName(msg.from)}</p>
                  )}
                  <p className="text-sm break-words">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="text-[9px] opacity-60">{formatTime(msg.createdAt)}</span>
                    {daysLeft <= 1 && <span className="text-[9px] text-red-300">({daysLeft}d)</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 pt-2 border-t border-white/10 flex-shrink-0">
          <input ref={inputRef} type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gold-400 text-white placeholder-gray-500" />
          <button onClick={handleSend} disabled={sending || !newMsg.trim()}
            className="bg-gold-500 text-white px-4 rounded-xl font-bold disabled:opacity-40 hover:bg-gold-600 transition-colors flex-shrink-0">
            <Send size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Contact list
  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <MessageCircle size={24} className="text-gold-400" /> Chat
      </h2>

      {myGroups.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">Grupos</p>
          <div className="space-y-1">
            {myGroups.map(g => (
              <div key={g.id} onClick={() => setActiveChat({ type: 'group', id: g.id })}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                    <Users size={18} />
                  </div>
                  {(unreadPerGroup[g.id] || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                      {unreadPerGroup[g.id]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{g.name}</p>
                  <p className="text-[10px] text-gray-500">{g.members.length} miembros</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">Usuarios</p>
        <div className="space-y-1">
          {otherUsers.map(u => (
            <div key={u.uid} onClick={() => setActiveChat({ type: 'user', id: u.uid })}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {u.displayName.charAt(0).toUpperCase()}
                </div>
                <div className={'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0a] ' + (u.online ? 'bg-green-400' : 'bg-gray-600')} />
                {(unreadPerUser[u.uid] || 0) > 0 && (
                  <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {unreadPerUser[u.uid]}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={'text-sm truncate ' + ((unreadPerUser[u.uid] || 0) > 0 ? 'font-bold text-white' : 'font-bold text-white')}>{u.displayName}</p>
                <p className="text-[10px] text-gray-500">{u.email}</p>
              </div>
              <span className={'text-[10px] ' + (u.online ? 'text-green-400' : 'text-gray-600')}>
                {u.online ? 'En linea' : 'Offline'}
              </span>
            </div>
          ))}
          {otherUsers.length === 0 && <p className="text-center text-white/30 py-8 text-sm">No hay otros usuarios</p>}
        </div>
      </div>
    </div>
  );
};