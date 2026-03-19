import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { StorageMonitor } from '../components/ui/StorageMonitor';
import { User, Shield, X, Edit, UserPlus, UserCheck, UserX, Camera, Loader2 } from 'lucide-react';
import { UserRole } from '../types';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile } from '../services/authService';
import { uploadFile } from '../services/storageService';

export const Settings = () => {
  const { user, users, updateUserProfileAction, approveUserAction, rejectUserAction, changeUserRoleAction, refreshUsers } = useApp();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [editName, setEditName] = useState(user?.displayName || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (user?.role !== UserRole.MASTER) {
    return <div className="flex items-center justify-center h-full text-white/50">No tienes acceso a esta sección.</div>;
  }

  // Admin: Register User State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerMsg, setRegisterMsg] = useState('');

  const isAdmin = true; // Only MASTER reaches this point

  const handleUpdateProfile = async () => {
    if (user && editName) {
      await updateUserProfileAction(user.uid, { displayName: editName });
      setIsEditingProfile(false);
    }
  };

  // Upload avatar photo
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate image
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes (JPG, PNG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5 MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const { promise } = uploadFile(file, 'cover', `avatar_${user.uid}`, () => {});
      const { url } = await promise;
      await updateUserProfileAction(user.uid, { avatarUrl: url });
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Error al subir la foto. Inténtalo de nuevo.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // Register new user (Admin creates Firebase Auth account + Firestore profile)
  const handleRegisterUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      setRegisterMsg('Completa todos los campos.');
      return;
    }
    if (newUserPassword.length < 6) {
      setRegisterMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setRegisterLoading(true);
    setRegisterMsg('');

    try {
      // We need to create the user without signing out the current admin
      // Firebase Auth createUserWithEmailAndPassword signs in the new user automatically
      // So we use a workaround: create via REST API or secondary auth instance
      // For simplicity, we'll use the admin SDK approach with a secondary app
      const { initializeApp, deleteApp } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../services/firebase');

      // Create a secondary Firebase app to avoid logging out admin
      const secondaryApp = initializeApp(
        auth.app.options,
        'secondary-' + Date.now()
      );
      const secondaryAuth = getAuth(secondaryApp);

      const credential = await createUser(secondaryAuth, newUserEmail, newUserPassword);
      const newUid = credential.user.uid;

      // Create Firestore profile
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: newUserEmail,
        displayName: newUserName,
        role: newUserRole,
        avatarUrl: '',
        approved: true, // Admin-created users are auto-approved
        createdAt: Date.now(),
      });

      // Sign out from secondary and delete the secondary app
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      setRegisterMsg(`✅ Usuario "${newUserName}" registrado correctamente.`);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole(UserRole.USER);
      await refreshUsers();
    } catch (err: any) {
      console.error('Register error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setRegisterMsg('❌ Ese email ya está registrado.');
      } else if (err.code === 'auth/invalid-email') {
        setRegisterMsg('❌ Email no válido.');
      } else {
        setRegisterMsg(`❌ Error: ${err.message}`);
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-20">
      <h2 className="text-3xl font-bold text-white mb-2">Configuración</h2>

      {/* Profile */}
      <GlassCard className="!bg-white/10 border-white/20 flex items-center justify-between p-6">
        <div className="flex items-center gap-6 z-10">
          {/* Avatar with upload */}
          <div className="relative group">
            <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} className="w-24 h-24 rounded-full border-4 border-gold-200 object-cover" alt="profile" />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-gold-200 bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-3xl font-bold">
                {user?.displayName?.charAt(0) || '?'}
              </div>
            )}
            <div
              onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : (
                <Camera size={24} className="text-white" />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white">{user?.displayName}</h3>
            <p className="text-white/60 font-medium text-sm">{user?.email}</p>
            <p className="text-white/40 text-xs uppercase tracking-wider mt-1">Rol: <span className="text-gold-400">{user?.role}</span></p>
            <button
              onClick={() => { setEditName(user?.displayName || ''); setIsEditingProfile(true); }}
              className="mt-3 text-xs bg-white/10 border border-white/20 text-white px-4 py-1.5 rounded-full hover:bg-gold-500 transition-colors"
            >
              Editar Perfil
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
          <GlassCard className="!bg-[#161b22] w-full max-w-md p-6 border-white/10">
            <h3 className="text-white font-bold text-lg mb-4">Editar Perfil</h3>
            <div className="space-y-4">
              {/* Avatar preview and upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-20 h-20 rounded-full border-2 border-gold-300 object-cover" alt="avatar" />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-gold-300 bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-2xl font-bold">
                      {user?.displayName?.charAt(0) || '?'}
                    </div>
                  )}
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gold-500 text-white flex items-center justify-center shadow-lg border-2 border-[#161b22]"
                  >
                    {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">Haz clic en el icono de cámara para cambiar tu foto</p>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold">Nombre</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsEditingProfile(false)} className="text-gray-400 px-3 py-1 text-sm">Cancelar</button>
              <button onClick={handleUpdateProfile} className="bg-gold-500 text-white px-4 py-1.5 rounded text-sm font-bold">Guardar</button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Storage */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4">Almacenamiento Firebase</h3>
        <StorageMonitor />
      </section>

      {/* Admin */}
      <GlassCard className="!bg-[#594510]/40 border-gold-500/20 !p-6">
        <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Shield size={18} /> Administración</h3>
        <p className="text-xs text-gold-200/70 mb-4">Gestión de usuarios y permisos.</p>
        {isAdmin ? (
          <button onClick={() => { setIsAdminPanelOpen(true); refreshUsers(); }}
            className="text-xs bg-gold-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-gold-400">Panel Admin</button>
        ) : (
          <span className="text-xs text-red-400 font-bold border border-red-500/30 px-2 py-1 rounded bg-red-500/10">Acceso denegado</span>
        )}
      </GlassCard>

      {/* Admin Panel Modal */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#161b22] rounded-t-2xl flex-shrink-0">
              <div><h2 className="text-xl font-bold text-white">Panel de Administración</h2><p className="text-xs text-gray-400">Gestión de usuarios y permisos</p></div>
              <button onClick={() => setIsAdminPanelOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left: Register User */}
              <div className="md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-white/10 bg-[#161b22]/50 overflow-y-auto flex-shrink-0">
                <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserPlus size={16} /> Registrar Usuario
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Nombre de Usuario</label>
                    <input
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-[#0d1117] border border-white/10 rounded p-2 text-white text-sm"
                      placeholder="Nombre..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Email</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full bg-[#0d1117] border border-white/10 rounded p-2 text-white text-sm"
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full bg-[#0d1117] border border-white/10 rounded p-2 text-white text-sm"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Rol</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                      className="w-full bg-[#0d1117] border border-white/10 rounded p-2 text-white text-sm"
                    >
                      <option value={UserRole.USER}>Usuario</option>
                      <option value={UserRole.ADMIN}>Administrador</option>
                    </select>
                  </div>
                  <button
                    onClick={handleRegisterUser}
                    disabled={registerLoading || !newUserName || !newUserEmail || !newUserPassword}
                    className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm mt-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    {registerLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Registrar
                  </button>
                  {registerMsg && (
                    <p className={`text-xs text-center p-2 rounded-lg ${registerMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {registerMsg}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: User List */}
              <div className="flex-1 p-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Usuarios ({users.length})</h3>
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.uid} className="flex items-center justify-between p-4 rounded-lg bg-[#161b22] border border-white/5 hover:border-gold-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white font-bold text-sm">
                            {u.displayName?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-white text-sm">{u.displayName} <span className="text-gray-500 font-normal">({u.email})</span></p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.role === 'ADMIN' ? 'bg-gold-500/20 text-gold-400' : 'bg-white/10 text-gray-400'}`}>{u.role}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.approved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {u.approved ? 'Aprobado' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!u.approved && (
                          <button onClick={() => approveUserAction(u.uid)} className="text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-500 hover:text-white transition-colors flex items-center gap-1">
                            <UserCheck size={14} /> Aprobar
                          </button>
                        )}
                        {u.approved && u.uid !== user?.uid && (
                          <button onClick={() => rejectUserAction(u.uid)} className="text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1">
                            <UserX size={14} /> Revocar
                          </button>
                        )}
                        {u.uid !== user?.uid && (
                          <button onClick={() => changeUserRoleAction(u.uid, u.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN)}
                            className="text-xs bg-white/10 text-white px-2 py-1.5 rounded-lg hover:bg-white/20">Cambiar Rol</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};