import React from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Trash2, RefreshCw, Music, Film, User } from 'lucide-react';
import { UserRole } from '../types';

export const Trash = () => {
  const { trash, restoreFromTrash, emptyTrash, user, users } = useApp();

  if (user?.role !== UserRole.MASTER) {
    return <div className="flex items-center justify-center h-full text-white/50">No tienes acceso a esta seccion.</div>;
  }

  const getUserName = (uid?: string) => {
    if (!uid) return 'Desconocido';
    const u = users.find(x => x.uid === uid);
    return u?.displayName || 'Desconocido';
  };

  const timeAgo = (ts?: number) => {
    if (!ts) return '';
    const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `Hace ${days} dias`;
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trash2 className="text-gold-500" /> Papelera
        </h2>
        {trash.length > 0 && (
          <button onClick={emptyTrash}
            className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors text-sm font-bold">
            Vaciar Papelera
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">Los elementos se eliminan automaticamente a los 5 dias.</p>

      <div className="flex-1 overflow-y-auto">
        {trash.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 py-20">
            <Trash2 size={60} className="mb-4 stroke-[1px]" />
            <p className="text-lg font-medium">La papelera esta vacia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trash.map((item) => (
              <GlassCard key={item.id} className="!p-3 !bg-white/5 hover:!bg-white/10 border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0">
                      {item.type === 'audio' ? <Music size={18} /> : <Film size={18} />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white truncate text-sm">{item.title}</h4>
                      <p className="text-[11px] text-gray-400 truncate">{item.artist}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-600">{timeAgo(item.deletedAt)}</span>
                        {item.deletedBy && (
                          <span className="text-[10px] text-red-400/60 flex items-center gap-0.5">
                            <User size={9} /> {getUserName(item.deletedBy)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => restoreFromTrash(item)}
                    className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-colors flex-shrink-0">
                    <RefreshCw size={16} />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};