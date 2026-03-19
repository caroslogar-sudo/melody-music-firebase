import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, MessageCircle, Inbox, X, Bell } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sendEmailNotification } from '../services/notificationService';
import { UserRole } from '../types';

interface Toast {
  id: string;
  type: 'mail' | 'chat' | 'request';
  title: string;
  body: string;
}

export const NotificationManager: React.FC = () => {
  const { user, users, groups } = useApp();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenRef = useRef({ mail: new Set<string>(), chat: new Set<string>(), req: new Set<string>() });
  const loadCountRef = useRef({ mail: 0, chat: 0, req: 0 });

  const getName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Usuario';

  const push = (type: Toast['type'], title: string, body: string) => {
    console.log(`[NOTIF] ${type}: ${title} — ${body}`);
    const id = Math.random().toString(36).slice(2) + Date.now();
    setToasts(prev => [{ id, type, title, body }, ...prev].slice(0, 5));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
    // Browser notification
    try { if (Notification.permission === 'granted') new Notification(title, { body }); } catch {}
  };

  // Ask browser notification permission
  useEffect(() => {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
  }, []);

  useEffect(() => {
    if (user) console.log('[NOTIF] Manager mounted. uid:', user.uid, 'role:', user.role);
  }, [user?.uid]);

  // ===================== MAIL =====================
  useEffect(() => {
    if (!user) return;
    // Listen to mail TO me
    const q1 = query(collection(db, 'mail'), where('to', '==', user.uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      loadCountRef.current.mail++;
      const isFirstLoad = loadCountRef.current.mail === 1;

      snap.docs.forEach(d => {
        const m = d.data();
        if (seenRef.current.mail.has(d.id)) return;
        seenRef.current.mail.add(d.id);

        if (isFirstLoad) {
          // On app open: show notification for unread messages
          if (!m.read) {
            push('mail', `Correo de ${getName(m.from)}`, m.subject || 'Sin asunto');
            // Send email
            if (user.email) {
              sendEmailNotification(user.email, user.displayName,
                `Correo de ${getName(m.from)}`,
                `${getName(m.from)} te escribio: "${m.subject || 'Sin asunto'}"`
              ).catch(() => {});
            }
          }
        } else {
          // Real-time: new message arrived while app is open
          if (!m.read) {
            push('mail', `Correo de ${getName(m.from)}`, m.subject || 'Sin asunto');
            if (user.email) {
              sendEmailNotification(user.email, user.displayName,
                `Correo de ${getName(m.from)}`,
                `${getName(m.from)} te escribio: "${m.subject || 'Sin asunto'}"`
              ).catch(() => {});
            }
          }
        }
      });
    }, (err) => console.warn('[NOTIF] Mail listener error:', err.message));

    // Master: listen to ALL mail
    let unsub2 = () => {};
    if (user.role === UserRole.MASTER) {
      const knownAll = new Set<string>();
      let firstAll = true;
      unsub2 = onSnapshot(collection(db, 'mail'), (snap) => {
        snap.docs.forEach(d => {
          if (knownAll.has(d.id)) return;
          knownAll.add(d.id);
          if (firstAll) return; // Skip first batch
          const m = d.data();
          if (m.from === user.uid || m.to === user.uid) return;
          push('mail', `Correo: ${getName(m.from)} → ${getName(m.to)}`, m.subject || 'Sin asunto');
        });
        firstAll = false;
      }, () => {});
    }

    return () => { unsub1(); unsub2(); };
  }, [user?.uid]);

  // ===================== CHAT =====================
  useEffect(() => {
    if (!user) return;
    const myGroupTargets = groups.filter(g => g.members.includes(user.uid)).map(g => 'group:' + g.id);
    let firstLoad = true;

    const unsub = onSnapshot(collection(db, 'chat'), (snap) => {
      snap.docs.forEach(d => {
        if (seenRef.current.chat.has(d.id)) return;
        seenRef.current.chat.add(d.id);
        if (firstLoad) return; // Skip initial batch entirely for chat (too many old messages)

        const msg = d.data();
        if (msg.from === user.uid) return;

        const isForMe = msg.to === user.uid || myGroupTargets.includes(msg.to);
        const isDM = msg.convoId && msg.convoId.includes(user.uid);
        const isMaster = user.role === UserRole.MASTER;
        const fromName = getName(msg.from);
        const text = (msg.text || '').substring(0, 60);

        if (isForMe || isDM) {
          const isGroup = msg.to?.startsWith('group:');
          const groupName = isGroup ? groups.find(g => 'group:' + g.id === msg.to)?.name || 'Grupo' : '';
          push('chat', isGroup ? `${fromName} en ${groupName}` : `Chat de ${fromName}`, text);
        } else if (isMaster) {
          const isGroup = msg.to?.startsWith('group:');
          const target = isGroup ? groups.find(g => 'group:' + g.id === msg.to)?.name || 'Grupo' : getName(msg.to);
          push('chat', `Chat: ${fromName} → ${target}`, text);
        }
      });
      firstLoad = false;
    }, (err) => console.warn('[NOTIF] Chat listener error:', err.message));

    return () => unsub();
  }, [user?.uid, groups.length]);

  // ===================== REQUESTS (Master) =====================
  useEffect(() => {
    if (!user || user.role !== UserRole.MASTER) return;
    let firstLoad = true;

    const unsub = onSnapshot(collection(db, 'songRequests'), (snap) => {
      snap.docs.forEach(d => {
        if (seenRef.current.req.has(d.id)) return;
        seenRef.current.req.add(d.id);

        const r = d.data();
        if (firstLoad) {
          // On open: show pending requests
          if (r.status === 'pending') {
            push('request', `Solicitud de ${getName(r.requestedBy)}`, `${r.title} - ${r.artist}`);
          }
        } else {
          if (r.status === 'pending') {
            push('request', `Solicitud de ${getName(r.requestedBy)}`, `${r.title} - ${r.artist}`);
          }
        }
      });
      firstLoad = false;
    }, (err) => console.warn('[NOTIF] Request listener error:', err.message));

    return () => unsub();
  }, [user?.uid, user?.role]);

  // ===================== RENDER =====================
  const getIcon = (type: Toast['type']) => {
    if (type === 'mail') return <Mail size={16} className="text-blue-400" />;
    if (type === 'chat') return <MessageCircle size={16} className="text-green-400" />;
    return <Inbox size={16} className="text-gold-400" />;
  };

  const getBg = (type: Toast['type']) => {
    if (type === 'mail') return 'border-blue-500/40 bg-[#0c1525]/95';
    if (type === 'chat') return 'border-green-500/40 bg-[#0c1a15]/95';
    return 'border-gold-500/40 bg-[#1a1508]/95';
  };

  const getLink = (type: Toast['type']) => {
    if (type === 'mail') return '#/mail';
    if (type === 'chat') return '#/chat';
    return '#/requests';
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-2 right-2 md:top-4 md:right-4 z-[250] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-16px)]">
      {toasts.map(toast => (
        <a key={toast.id} href={getLink(toast.type)}
          className={'flex items-start gap-3 p-3 rounded-xl border backdrop-blur-2xl shadow-2xl cursor-pointer active:scale-[0.98] transition-all ' + getBg(toast.type)}
          style={{ animation: 'nSlide 0.35s ease-out' }}
          onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            {getIcon(toast.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{toast.title}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{toast.body}</p>
          </div>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)); }}
            className="p-1 text-gray-600 hover:text-white flex-shrink-0"><X size={14} /></button>
        </a>
      ))}
      <style>{`@keyframes nSlide{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
};