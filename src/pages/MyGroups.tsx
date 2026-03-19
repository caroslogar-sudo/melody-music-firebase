import React from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Users, Crown, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';

export const MyGroups = () => {
  const { user, users, groups } = useApp();
  if (!user) return null;

  const myGroups = groups.filter(g => g.members.includes(user.uid));

  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Desconocido';
  const getUserRole = (uid: string) => users.find(u => u.uid === uid)?.role || UserRole.USER;
  const getRoleIcon = (role: UserRole) => {
    if (role === UserRole.MASTER) return <Crown size={10} className="text-yellow-400" />;
    if (role === UserRole.ADMIN) return <ShieldCheck size={10} className="text-blue-400" />;
    return null;
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Users size={24} className="text-gold-400" /> Mis Grupos
      </h2>

      {myGroups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 py-20">
          <Users size={60} className="mb-4 opacity-30" />
          <p className="text-lg">No perteneces a ningun grupo</p>
          <p className="text-sm text-gray-600 mt-1">El administrador te anadira a grupos cuando sea necesario</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {myGroups.map(g => (
            <GlassCard key={g.id} className="bg-white/5 border-white/10 !p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-bold">
                  {g.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{g.name}</h3>
                  <p className="text-xs text-gray-400">{g.members.length} miembros</p>
                </div>
              </div>
              <div className="space-y-2">
                {g.members.map(uid => {
                  const role = getUserRole(uid);
                  const isMe = uid === user.uid;
                  return (
                    <div key={uid} className={`flex items-center gap-3 p-2.5 rounded-xl ${isMe ? 'bg-gold-500/10 border border-gold-500/20' : 'bg-white/5'}`}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {getUserName(uid).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {getUserName(uid)} {isMe && <span className="text-gold-400 text-[10px]">(Tu)</span>}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        {getRoleIcon(role)} {role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};