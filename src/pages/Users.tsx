import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { UserRole, AppUser } from '../types';
import { Users as UsersIcon, Shield, ShieldCheck, Crown, Check, XCircle, ChevronDown, Trash2, Plus, X, UserPlus, FolderLock, Folder, ChevronRight, Phone, Key, MessageSquare } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Users: React.FC = () => {
  const { user, users, library, refreshUsers, approveUserAction, rejectUserAction, changeUserRoleAction, deleteUserAction, groups, createGroup, updateGroup, deleteGroup } = useApp();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [editingApiKey, setEditingApiKey] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState('');

  // Folder permissions state
  const [editingFoldersUid, setEditingFoldersUid] = useState<string | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [savingFolders, setSavingFolders] = useState(false);
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());

  // Groups state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addingMemberToGroup, setAddingMemberToGroup] = useState<string | null>(null);

  useEffect(() => { refreshUsers(); }, []);

  if (!user || user.role !== UserRole.MASTER) {
    return <div className="flex items-center justify-center h-full text-white/50">No tienes acceso a esta seccion.</div>;
  }

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    setCreating(true);
    setCreateMsg('');
    try {
      const apiKey = 'AIzaSyC5xYQkRZG48Qc7dKhXX9Zh-KjiytvvfHk';
      const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, returnSecureToken: false }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      await setDoc(doc(db, 'users', data.localId), {
        uid: data.localId, email: newEmail.toLowerCase(), displayName: newName.trim(),
        role: newRole, avatarUrl: '', approved: true, createdAt: Date.now(),
      });
      setCreateMsg('Usuario "' + newName + '" creado');
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole(UserRole.USER);
      await refreshUsers();
      setTimeout(() => setCreateMsg(''), 3000);
    } catch (err: any) {
      const msg = err.message?.includes('EMAIL_EXISTS') ? 'Email ya registrado'
        : err.message?.includes('WEAK_PASSWORD') ? 'Min. 6 caracteres' : err.message || 'Error';
      setCreateMsg('Error: ' + msg);
    } finally { setCreating(false); }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (!window.confirm('Eliminar a "' + name + '"?')) return;
    try {
      await deleteUserAction(uid);
      try {
        const apiKey = 'AIzaSyC5xYQkRZG48Qc7dKhXX9Zh-KjiytvvfHk';
        await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + apiKey, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localId: uid }),
        });
      } catch { /* best effort */ }
    } catch (err) { console.error('Error:', err); }
  };

  const savePhone = async (uid: string) => {
    const cleaned = phoneValue.trim().replace(/\s/g, '');
    try {
      await updateDoc(doc(db, 'users', uid), { phone: cleaned });
      await refreshUsers();
      setEditingPhone(null);
      setPhoneValue('');
    } catch (err) { console.error('Phone save error:', err); }
  };

  const saveApiKey = async (uid: string) => {
    const cleaned = apiKeyValue.trim();
    try {
      await updateDoc(doc(db, 'users', uid), { callmebotApiKey: cleaned });
      await refreshUsers();
      setEditingApiKey(null);
      setApiKeyValue('');
    } catch (err) { console.error('ApiKey save error:', err); }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedGroupMembers.size === 0) return;
    await createGroup(newGroupName.trim(), Array.from(selectedGroupMembers));
    setNewGroupName(''); setSelectedGroupMembers(new Set()); setShowCreateGroup(false);
  };

  const handleAddMember = async (groupId: string, uid: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (!group.members.includes(uid)) {
      await updateGroup(groupId, { members: [...group.members, uid] });
    }
    setAddingMemberToGroup(null);
  };

  const handleRemoveMember = async (groupId: string, uid: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    await updateGroup(groupId, { members: group.members.filter(m => m !== uid) });
  };

  // Build folder tree from library
  const folderTree = useMemo(() => {
    const roots = new Map<string, Set<string>>();
    library.forEach(t => {
      if (t.title === '.keep') return;
      const folder = t.folder || 'General';
      const parts = folder.split('/');
      const root = parts[0];
      if (!roots.has(root)) roots.set(root, new Set());
      if (parts.length > 1) {
        roots.get(root)!.add(folder); // full path as subfolder
      }
    });
    return roots;
  }, [library]);

  const openFolderPerms = (u: AppUser) => {
    setEditingFoldersUid(u.uid);
    const current = u.allowedFolders || ['*'];
    setSelectedFolders([...current]);
    setExpandedRoots(new Set());
  };

  const toggleFolderSelection = (folder: string) => {
    setSelectedFolders(prev => {
      if (folder === '*') {
        // Toggle: if already '*', deselect to empty (will mean "none selected yet")
        if (prev.includes('*')) return [];
        // Otherwise select all
        return ['*'];
      }
      // Selecting a specific folder: remove '*' first
      const without = prev.filter(f => f !== '*');
      if (without.includes(folder)) {
        return without.filter(f => f !== folder);
      }
      return [...without, folder];
    });
  };

  const isAllSelected = selectedFolders.includes('*');
  const noneSelected = selectedFolders.length === 0;

  const saveFolderPerms = async () => {
    if (!editingFoldersUid) return;
    setSavingFolders(true);
    try {
      const toSave = selectedFolders.length === 0 ? ['*'] : selectedFolders;
      await updateDoc(doc(db, 'users', editingFoldersUid), { allowedFolders: toSave });
      refreshUsers();
    } catch (err) { console.error(err); }
    setSavingFolders(false);
    setEditingFoldersUid(null);
  };

  const getRoleBadge = (role: UserRole) => {
    const s: Record<string, string> = {
      MASTER: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      ADMIN: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      USER: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    };
    return 'px-2 py-0.5 rounded-full text-[10px] font-bold border ' + (s[role] || s.USER);
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === UserRole.MASTER) return <Crown size={14} className="text-yellow-400" />;
    if (role === UserRole.ADMIN) return <ShieldCheck size={14} className="text-blue-400" />;
    return <UsersIcon size={14} className="text-gray-400" />;
  };

  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Desconocido';

  const masterUser = users.find(u => u.role === UserRole.MASTER);
  const otherUsers = users.filter(u => u.role !== UserRole.MASTER).sort((a, b) => {
    const order: Record<string, number> = { ADMIN: 0, USER: 1 };
    return (order[a.role] || 1) - (order[b.role] || 1);
  });
  const nonMasterUsers = users.filter(u => u.role !== UserRole.MASTER);

  return (
    <div className="flex flex-col gap-5 h-full" onClick={() => { openRoleMenu && setOpenRoleMenu(null); addingMemberToGroup && setAddingMemberToGroup(null); }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={24} className="text-gold-400" /> Gestion de Usuarios
          </h2>
          <p className="text-sm text-gray-400 mt-1">{users.length} usuarios · {groups.length} grupos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateUser(!showCreateUser)}
            className="bg-gold-400 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gold-500 shadow-md text-sm font-bold">
            <UserPlus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        <button onClick={() => setActiveTab('users')}
          className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors ' + (activeTab === 'users' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          Usuarios
        </button>
        <button onClick={() => setActiveTab('groups')}
          className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors ' + (activeTab === 'groups' ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
          Grupos
        </button>
      </div>

      {/* Create User Form */}
      {showCreateUser && activeTab === 'users' && (
        <GlassCard className="bg-white/5 border-white/10 !p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><UserPlus size={18} className="text-gold-400" /> Registrar Usuario</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-[10px] uppercase font-bold text-gray-400">Nombre</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" /></div>
            <div><label className="text-[10px] uppercase font-bold text-gray-400">Email</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@ejemplo.com"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" /></div>
            <div><label className="text-[10px] uppercase font-bold text-gray-400">Contrasena</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 caracteres"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" /></div>
            <div><label className="text-[10px] uppercase font-bold text-gray-400">Rol</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mt-1 outline-none focus:border-gold-400 text-white text-sm">
                <option value={UserRole.USER} className="bg-gray-900">Usuario</option>
                <option value={UserRole.ADMIN} className="bg-gray-900">Administrador</option>
              </select></div>
          </div>
          <div className="flex items-center justify-between mt-4">
            {createMsg && <p className="text-sm text-white">{createMsg}</p>}
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setShowCreateUser(false)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleCreateUser} disabled={creating || !newName.trim() || !newEmail.trim() || !newPassword.trim()}
                className="px-5 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gold-600">{creating ? 'Creando...' : 'Crear'}</button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-2">
            <span className="flex items-center gap-1"><Crown size={12} className="text-yellow-400" /> Master</span>
            <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-blue-400" /> Admin</span>
            <span className="flex items-center gap-1"><UsersIcon size={12} className="text-gray-400" /> Usuario</span>
          </div>

          {/* MASTER - Fixed at top */}
          {masterUser && (
            <GlassCard className="bg-yellow-500/5 border-yellow-500/20 !p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold">
                  {masterUser.avatarUrl ? <img src={masterUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : masterUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white text-sm">{masterUser.displayName}</p>
                    <span className={getRoleBadge(UserRole.MASTER)}><Crown size={10} className="text-yellow-400 inline mr-0.5" />MASTER</span>
                  </div>
                  <p className="text-xs text-gray-400">{masterUser.email}</p>
                  {/* Master phone */}
                  {editingPhone === masterUser.uid ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Phone size={10} className="text-green-400 flex-shrink-0" />
                      <input type="tel" value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)}
                        placeholder="+34 612 345 678"
                        className="bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[10px] text-white outline-none focus:border-green-400 w-32"
                        onKeyDown={(e) => e.key === 'Enter' && savePhone(masterUser.uid)} autoFocus />
                      <button onClick={() => savePhone(masterUser.uid)} className="text-green-400 text-[10px] font-bold">OK</button>
                      <button onClick={() => setEditingPhone(null)} className="text-gray-500 text-[10px]">✕</button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 cursor-pointer hover:text-green-400"
                      onClick={() => { setEditingPhone(masterUser.uid); setPhoneValue(masterUser.phone || ''); }}>
                      <Phone size={9} /> {masterUser.phone || 'Añadir telefono'}
                    </p>
                  )}
                  {/* CallMeBot ApiKey */}
                  {editingApiKey === masterUser.uid ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Key size={10} className="text-yellow-400 flex-shrink-0" />
                      <input type="text" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)}
                        placeholder="CallMeBot API Key"
                        className="bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[10px] text-white outline-none focus:border-yellow-400 w-32"
                        onKeyDown={(e) => e.key === 'Enter' && saveApiKey(masterUser.uid)} autoFocus />
                      <button onClick={() => saveApiKey(masterUser.uid)} className="text-yellow-400 text-[10px] font-bold">OK</button>
                      <button onClick={() => setEditingApiKey(null)} className="text-gray-500 text-[10px]">✕</button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 cursor-pointer hover:text-yellow-400"
                      onClick={() => { setEditingApiKey(masterUser.uid); setApiKeyValue(masterUser.callmebotApiKey || ''); }}>
                      <Key size={9} /> {masterUser.callmebotApiKey ? '••••' + masterUser.callmebotApiKey.slice(-4) : 'Añadir API Key'}
                    </p>
                  )}
                  {/* WhatsApp activation button */}
                  {!masterUser.callmebotApiKey && (
                    <a href="https://wa.me/34621062163?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                      target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[9px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 hover:bg-green-500/20">
                      <MessageSquare size={8} /> Activar WhatsApp
                    </a>
                  )}
                </div>
                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Activo</span>
              </div>
            </GlassCard>
          )}

          {/* Other users */}
          {otherUsers.map((u) => (
            <GlassCard key={u.uid} className="bg-white/5 border-white/10 !p-4 overflow-visible">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-gold-300 to-gold-600 flex items-center justify-center text-white font-bold">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-sm truncate">{u.displayName}</p>
                      <span className={getRoleBadge(u.role)}>{getRoleIcon(u.role)} {u.role}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    {/* Phone */}
                    {editingPhone === u.uid ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone size={10} className="text-green-400 flex-shrink-0" />
                        <input type="tel" value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)}
                          placeholder="+34 612 345 678"
                          className="bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[10px] text-white outline-none focus:border-green-400 w-32"
                          onKeyDown={(e) => e.key === 'Enter' && savePhone(u.uid)} autoFocus />
                        <button onClick={() => savePhone(u.uid)} className="text-green-400 text-[10px] font-bold">OK</button>
                        <button onClick={() => setEditingPhone(null)} className="text-gray-500 text-[10px]">✕</button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 cursor-pointer hover:text-green-400"
                        onClick={() => { setEditingPhone(u.uid); setPhoneValue(u.phone || ''); }}>
                        <Phone size={9} /> {u.phone || 'Añadir telefono'}
                      </p>
                    )}
                    {/* CallMeBot ApiKey */}
                    {editingApiKey === u.uid ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Key size={10} className="text-yellow-400 flex-shrink-0" />
                        <input type="text" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)}
                          placeholder="CallMeBot API Key"
                          className="bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[10px] text-white outline-none focus:border-yellow-400 w-32"
                          onKeyDown={(e) => e.key === 'Enter' && saveApiKey(u.uid)} autoFocus />
                        <button onClick={() => saveApiKey(u.uid)} className="text-yellow-400 text-[10px] font-bold">OK</button>
                        <button onClick={() => setEditingApiKey(null)} className="text-gray-500 text-[10px]">✕</button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 cursor-pointer hover:text-yellow-400"
                        onClick={() => { setEditingApiKey(u.uid); setApiKeyValue(u.callmebotApiKey || ''); }}>
                        <Key size={9} /> {u.callmebotApiKey ? '••••' + u.callmebotApiKey.slice(-4) : 'Añadir API Key'}
                      </p>
                    )}
                    {/* WhatsApp activation button */}
                    {!u.callmebotApiKey && (
                      <a href="https://wa.me/34621062163?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                        target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[9px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 hover:bg-green-500/20">
                        <MessageSquare size={8} /> Activar WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {u.approved
                    ? <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 hidden sm:inline">Activo</span>
                    : <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 hidden sm:inline">Pendiente</span>}
                  {/* Folder permissions */}
                  <button onClick={(e) => { e.stopPropagation(); openFolderPerms(u); }}
                    className={'p-1.5 rounded-lg hover:bg-white/10 ' + (u.allowedFolders && !u.allowedFolders.includes('*') ? 'text-orange-400 bg-orange-500/10' : 'text-gray-500')}
                    title="Permisos de carpetas">
                    <FolderLock size={14} />
                  </button>
                  {/* Role dropdown */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setOpenRoleMenu(openRoleMenu === u.uid ? null : u.uid)}
                      className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white hover:bg-white/20">
                      Rol <ChevronDown size={12} />
                    </button>
                    {openRoleMenu === u.uid && (
                      <div className="absolute bottom-full right-0 mb-1 bg-gray-900 border border-white/20 rounded-lg shadow-2xl z-[100] overflow-hidden min-w-[145px]">
                        <button onClick={() => { changeUserRoleAction(u.uid, UserRole.ADMIN); setOpenRoleMenu(null); }}
                          className={'w-full px-3 py-2.5 text-left text-xs flex items-center gap-2 hover:bg-white/10 ' + (u.role === UserRole.ADMIN ? 'text-blue-400 bg-blue-500/10' : 'text-white')}>
                          <ShieldCheck size={13} /> Administrador</button>
                        <button onClick={() => { changeUserRoleAction(u.uid, UserRole.USER); setOpenRoleMenu(null); }}
                          className={'w-full px-3 py-2.5 text-left text-xs flex items-center gap-2 hover:bg-white/10 ' + (u.role === UserRole.USER ? 'text-gray-400 bg-gray-500/10' : 'text-white')}>
                          <UsersIcon size={13} /> Usuario</button>
                      </div>
                    )}
                  </div>
                  {!u.approved
                    ? <button onClick={() => approveUserAction(u.uid)} className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30" title="Aprobar"><Check size={14} /></button>
                    : <button onClick={() => rejectUserAction(u.uid)} className="p-1.5 bg-red-500/10 text-red-400/50 rounded-lg hover:bg-red-500/20 hover:text-red-400" title="Revocar"><XCircle size={14} /></button>}
                  <button onClick={() => handleDeleteUser(u.uid, u.displayName)} className="p-1.5 bg-red-500/10 text-red-400/40 rounded-lg hover:bg-red-500/20 hover:text-red-400" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ===== GROUPS TAB ===== */}
      {activeTab === 'groups' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <button onClick={() => setShowCreateGroup(true)}
            className="bg-gold-400 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gold-500 shadow-md text-sm font-bold">
            <Plus size={16} /> Nuevo Grupo
          </button>

          {/* Create Group */}
          {showCreateGroup && (
            <GlassCard className="bg-white/5 border-white/10 !p-5">
              <h3 className="text-white font-bold mb-3">Crear Grupo</h3>
              <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nombre del grupo"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-2.5 mb-3 outline-none focus:border-gold-400 text-white placeholder-gray-500 text-sm" />
              <p className="text-xs text-gray-400 mb-2">Selecciona miembros:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                {nonMasterUsers.map(u => (
                  <label key={u.uid} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={selectedGroupMembers.has(u.uid)}
                      onChange={() => { const s = new Set(selectedGroupMembers); s.has(u.uid) ? s.delete(u.uid) : s.add(u.uid); setSelectedGroupMembers(s); }}
                      className="accent-gold-500" />
                    <span className="text-white text-sm">{u.displayName}</span>
                    <span className="text-gray-500 text-xs">{u.email}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedGroupMembers(new Set()); }} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
                <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedGroupMembers.size === 0}
                  className="px-5 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">Crear Grupo</button>
              </div>
            </GlassCard>
          )}

          {/* Groups list */}
          {groups.length === 0 && !showCreateGroup && (
            <div className="text-center py-12 text-white/30">
              <UsersIcon size={40} className="mx-auto mb-2" />
              <p className="text-sm">No hay grupos creados</p>
            </div>
          )}

          {groups.map(g => (
            <GlassCard key={g.id} className="bg-white/5 border-white/10 !p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <UsersIcon size={16} className="text-gold-400" /> {g.name}
                  <span className="text-[10px] text-gray-500 font-normal">{g.members.length} miembros</span>
                </h4>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setAddingMemberToGroup(addingMemberToGroup === g.id ? null : g.id); }}
                    className="p-1.5 bg-gold-500/20 text-gold-400 rounded-lg hover:bg-gold-500/30" title="Anadir miembro"><UserPlus size={14} /></button>
                  <button onClick={() => { if (window.confirm('Eliminar grupo "' + g.name + '"?')) deleteGroup(g.id); }}
                    className="p-1.5 bg-red-500/10 text-red-400/50 rounded-lg hover:bg-red-500/20 hover:text-red-400" title="Eliminar grupo"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Add member dropdown */}
              {addingMemberToGroup === g.id && (
                <div className="mb-3 bg-black/20 rounded-lg p-3 border border-white/10" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-gray-400 mb-2">Selecciona usuario:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {nonMasterUsers.filter(u => !g.members.includes(u.uid)).map(u => (
                      <button key={u.uid} onClick={() => handleAddMember(g.id, u.uid)}
                        className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-sm text-white flex items-center gap-2">
                        <Plus size={12} className="text-gold-400" /> {u.displayName} <span className="text-gray-500 text-xs">{u.email}</span>
                      </button>
                    ))}
                    {nonMasterUsers.filter(u => !g.members.includes(u.uid)).length === 0 && (
                      <p className="text-xs text-gray-500 p-2">Todos los usuarios ya estan en el grupo</p>
                    )}
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="space-y-1">
                {g.members.map(uid => {
                  const member = users.find(u => u.uid === uid);
                  if (!member) return null;
                  return (
                    <div key={uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {member.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-white">{member.displayName}</span>
                        <span className={getRoleBadge(member.role)}>{member.role}</span>
                      </div>
                      <button onClick={() => handleRemoveMember(g.id, uid)}
                        className="p-1 text-red-400/40 hover:text-red-400 rounded" title="Quitar del grupo"><X size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Folder permissions modal */}
      {editingFoldersUid && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setEditingFoldersUid(null)}>
          <div className="w-full max-w-md bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderLock size={20} className="text-orange-400" /> Permisos de Carpetas
              </h3>
              <button onClick={() => setEditingFoldersUid(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-400 mb-1">Usuario: <span className="text-white font-bold">{users.find(u => u.uid === editingFoldersUid)?.displayName}</span></p>
            <p className="text-xs text-gray-500 mb-4">Selecciona las carpetas a las que tendra acceso. Si no seleccionas ninguna, tendra acceso a todo.</p>

            <div className="flex-1 overflow-y-auto space-y-1 mb-4">
              {/* Option: Todo */}
              <div onClick={() => toggleFolderSelection('*')}
                className={'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ' + (isAllSelected ? 'bg-green-500/10 border border-green-500/20' : 'hover:bg-white/5 border border-transparent')}>
                <div className={'w-5 h-5 rounded flex items-center justify-center border ' + (isAllSelected ? 'bg-green-500 border-green-500' : 'border-gray-600')}>
                  {isAllSelected && <Check size={12} className="text-white" />}
                </div>
                <Folder size={16} className="text-green-400" />
                <span className="text-sm text-white font-bold">Todo (acceso completo)</span>
              </div>

              <div className="border-t border-white/10 my-2" />

              {/* Folder tree */}
              {Array.from(folderTree.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([root, subPaths]) => {
                const subFolders = Array.from(subPaths).sort();
                const hasChildren = subFolders.length > 0;
                const isRootSelected = !isAllSelected && selectedFolders.includes(root);
                const isExpanded = expandedRoots.has(root);
                // Check if any subfolder of this root is selected
                const anySubSelected = !isAllSelected && subFolders.some(sf => selectedFolders.includes(sf));

                return (
                  <div key={root}>
                    <div className="flex items-center gap-1">
                      {hasChildren && (
                        <button onClick={() => setExpandedRoots(prev => { const n = new Set(prev); if (n.has(root)) n.delete(root); else n.add(root); return n; })}
                          className="p-1 text-gray-500 hover:text-white">
                          <ChevronRight size={14} className={'transition-transform ' + (isExpanded ? 'rotate-90' : '')} />
                        </button>
                      )}
                      {!hasChildren && <div className="w-6" />}
                      <div onClick={() => { if (!isAllSelected) toggleFolderSelection(root); }}
                        className={'flex-1 flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ' + (isRootSelected ? 'bg-gold-500/10 border border-gold-500/20' : anySubSelected ? 'bg-blue-500/5 border border-blue-500/10' : 'hover:bg-white/5 border border-transparent') + (isAllSelected ? ' opacity-40 pointer-events-none' : '')}>
                        <div className={'w-5 h-5 rounded flex items-center justify-center border ' + (isRootSelected ? 'bg-gold-500 border-gold-500' : 'border-gray-600')}>
                          {isRootSelected && <Check size={12} className="text-white" />}
                        </div>
                        <Folder size={15} className="text-gold-400" />
                        <span className="text-sm text-white">{root}</span>
                      </div>
                    </div>

                    {/* Subfolders */}
                    {isExpanded && subFolders.map(sf => {
                      const subName = sf.split('/').slice(1).join('/');
                      const isSfSelected = !isAllSelected && selectedFolders.includes(sf);
                      return (
                        <div key={sf}
                          onClick={() => { if (!isAllSelected) toggleFolderSelection(sf); }}
                          className={'flex items-center gap-2.5 p-2 pl-12 rounded-xl cursor-pointer transition-colors ml-2 ' + (isSfSelected ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5 border border-transparent') + (isAllSelected ? ' opacity-40 pointer-events-none' : '')}>
                          <div className={'w-4 h-4 rounded flex items-center justify-center border ' + (isSfSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600')}>
                            {isSfSelected && <Check size={10} className="text-white" />}
                          </div>
                          <Folder size={13} className="text-blue-400/60" />
                          <span className="text-xs text-gray-300">{subName}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="bg-white/5 rounded-lg p-2.5 mb-3 border border-white/10">
              <p className="text-[10px] text-gray-400">
                {isAllSelected ? (
                  <span className="text-green-400 font-bold">Acceso completo a todas las carpetas</span>
                ) : noneSelected ? (
                  <span className="text-yellow-400 font-bold">Pulsa en las carpetas para restringir el acceso (o selecciona Todo)</span>
                ) : (
                  <span><span className="text-orange-400 font-bold">{selectedFolders.length}</span> carpeta{selectedFolders.length !== 1 ? 's' : ''} seleccionada{selectedFolders.length !== 1 ? 's' : ''}</span>
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingFoldersUid(null)} className="px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              <button onClick={saveFolderPerms} disabled={savingFolders}
                className="px-5 py-2 bg-gold-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gold-600 transition-colors">
                {savingFolders ? 'Guardando...' : 'Guardar Permisos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};