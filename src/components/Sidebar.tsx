import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Music, Video, ListMusic, Trash2, Settings, LogOut, Users, Crown, ShieldCheck, Share2, MessageCircle, Mail, UserCheck, Inbox, UserPlus, Camera, Loader2, BarChart3, Clock, Heart, Radio, Image } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlassCard } from './ui/GlassCard';
import { StorageMonitor } from './ui/StorageMonitor';
import { MelodyLogo } from './MelodyLogo';
import { UserRole } from '../types';
import { uploadFile } from '../services/storageService';
import { subscribeToInbox } from '../services/mailService';
import { subscribeToRequests } from '../services/requestService';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const { user, logout, updateUserProfileAction, groups } = useApp();
  const location = useLocation();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [unreadMail, setUnreadMail] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  // Subscribe to unread mail count
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToInbox(user.uid, (msgs) => {
      setUnreadMail(msgs.filter(m => !m.read).length);
    });
    return () => unsub();
  }, [user]);

  // Subscribe to unread chat count
  useEffect(() => {
    if (!user) return;
    const myGroupTargets = groups.filter(g => g.members.includes(user.uid)).map(g => 'group:' + g.id);
    const unsub = onSnapshot(collection(db, 'chat'), (snap) => {
      let count = 0;
      snap.docs.forEach(d => {
        const msg = d.data();
        if (msg.from === user.uid) return;
        const isForMe = msg.to === user.uid || myGroupTargets.includes(msg.to);
        const isDM = msg.convoId && msg.convoId.includes(user.uid);
        if ((isForMe || isDM) && (!msg.readBy || !msg.readBy.includes(user.uid))) count++;
      });
      setUnreadChat(count);
    }, () => {});
    return () => unsub();
  }, [user?.uid, groups.length]);

  // Subscribe to pending requests count (for buzón badge)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRequests((reqs) => {
      // Users see their own pending, Master/Admin sees all pending
      const isMasterOrAdmin = user.role === UserRole.MASTER || user.role === UserRole.ADMIN;
      if (isMasterOrAdmin) {
        setPendingRequests(reqs.filter(r => r.status === 'pending').length);
      } else {
        // For normal users: show count of their requests that got a response
        setPendingRequests(reqs.filter(r => r.requestedBy === user.uid && r.status !== 'pending' && r.response).length);
      }
    });
    return () => unsub();
  }, [user?.uid, user?.role]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5 MB'); return; }
    setUploadingAvatar(true);
    try {
      const { promise } = uploadFile(file, 'cover', `avatar_${user.uid}`, () => {});
      const { url } = await promise;
      await updateUserProfileAction(user.uid, { avatarUrl: url });
    } catch (err) {
      console.error('Avatar upload error:', err);
    }
    setUploadingAvatar(false);
    e.target.value = '';
  };

  const isMaster = user?.role === UserRole.MASTER;
  const isAdmin = user?.role === UserRole.ADMIN;
  const canManage = isMaster || isAdmin;

  const menuItems = useMemo(() => {
    const items = [
      { icon: Home, label: 'Inicio', path: '/dashboard', show: true },
      { icon: Music, label: 'Música', path: '/music', show: true },
      { icon: Video, label: 'Videos', path: '/videos', show: true },
      { icon: Radio, label: 'Radio', path: '/radio', show: true },
      { icon: Camera, label: 'Camara', path: '/camera', show: true },
      { icon: Image, label: 'Fotos', path: '/photos', show: true },
      { icon: ListMusic, label: 'Listas', path: '/playlists', show: true },
      { icon: Heart, label: 'Favoritos', path: '/favorites', show: true },
      { icon: Clock, label: 'Historial', path: '/history', show: true },
      { icon: Share2, label: 'Compartidas', path: '/shared', show: true },
      { icon: UserCheck, label: 'Mis Grupos', path: '/my-groups', show: true },
      { icon: MessageCircle, label: 'Chat', path: '/chat', show: true, badge: unreadChat },
      { icon: Mail, label: 'Correo', path: '/mail', show: true, badge: unreadMail },
      { icon: Inbox, label: 'Buzon', path: '/requests', show: true, badge: pendingRequests },
      { icon: UserPlus, label: 'Invitaciones', path: '/invites', show: isMaster },
      { icon: BarChart3, label: 'Actividad', path: '/analytics', show: isMaster },
      { icon: Trash2, label: 'Papelera', path: '/trash', show: isMaster },
      { icon: Users, label: 'Usuarios', path: '/users', show: isMaster },
      { icon: Settings, label: 'Ajustes', path: '/settings', show: isMaster },
    ];
    return items.filter(i => i.show);
  }, [isMaster, canManage, unreadChat, unreadMail, pendingRequests]);

  const getRoleLabel = () => {
    if (isMaster) return 'Master';
    if (isAdmin) return 'Admin';
    return 'Usuario';
  };

  const getRoleIcon = () => {
    if (isMaster) return <Crown size={10} className="text-yellow-400" />;
    if (isAdmin) return <ShieldCheck size={10} className="text-blue-400" />;
    return null;
  };

  const handleLogout = async () => {
    try { await logout(); onNavigate?.(); } catch (err) { console.error('Logout error:', err); }
  };

  return (
    <aside className="w-72 md:w-64 h-full p-4 flex flex-col gap-4 z-10">
      <GlassCard className="flex flex-col h-full !p-4 !bg-white/10 border-white/20 shadow-xl backdrop-blur-md overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6 px-1 flex-shrink-0">
          <MelodyLogo size={42} />
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Melody</h1>
            <p className="text-xs text-gold-300 tracking-widest uppercase font-semibold">Music</p>
          </div>
        </div>

        {/* User Info */}
        <div className="mb-4 flex items-center gap-3 px-2 bg-black/20 p-2 rounded-xl border border-white/10 flex-shrink-0">
          <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
          <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}>
            <div className="w-10 h-10 rounded-full border-2 border-gold-500/50 shadow-sm bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
              {uploadingAvatar ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.displayName?.charAt(0) || '?'
              )}
            </div>
            {!uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={12} className="text-white" />
              </div>
            )}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-white truncate">{user?.displayName}</p>
            <p className="text-xs text-gray-300 flex items-center gap-1">{getRoleIcon()} {getRoleLabel()}</p>
          </div>
        </div>

        {/* Storage Monitor - only for Master */}
        {isMaster && (
          <div className="mb-4 px-1 flex-shrink-0">
            <StorageMonitor compact />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1.5">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const badge = (item as any).badge || 0;
            return (
              <Link to={item.path} key={item.path} onClick={() => onNavigate?.()}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors active:scale-[0.98] ${
                  isActive
                    ? 'bg-gradient-to-r from-gold-500/80 to-gold-600/80 text-white font-bold shadow-lg border border-gold-400/30'
                    : 'text-white hover:bg-white/5 active:bg-white/10'
                }`}>
                  <item.icon size={20} />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <button onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors flex-shrink-0">
          <LogOut size={20} /><span>Cerrar Sesión</span>
        </button>
      </GlassCard>
    </aside>
  );
};