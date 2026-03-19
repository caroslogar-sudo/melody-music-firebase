import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { UserPlus, Send, Copy, Check, Trash2, Clock, CheckCircle, MessageCircle, Mail, Link2, ExternalLink } from 'lucide-react';
import { createInvitation, subscribeToInvitations, deleteInvitation, getInviteUrl, getWhatsAppShareUrl, getEmailShareUrl, Invitation } from '../services/inviteService';

export const Invites = () => {
  const { user, users } = useApp();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [targetEmail, setTargetEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<Invitation | null>(null);

  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Usuario';

  useEffect(() => {
    const unsub = subscribeToInvitations(setInvitations);
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const inv = await createInvitation(user.uid, targetEmail.trim() || undefined);
      setLastCreated(inv);
      setTargetEmail('');
    } catch (err) { console.error(err); }
    setCreating(false);
  };

  const handleCopyLink = (code: string, id: string) => {
    const url = getInviteUrl(code);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id + '-code');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const timeAgo = (ts: number) => {
    const hrs = Math.floor((Date.now() - ts) / 3600000);
    if (hrs < 1) return 'Hace un momento';
    if (hrs < 24) return hrs + 'h';
    return Math.floor(hrs / 24) + 'd';
  };

  const daysLeft = (ts: number) => {
    const d = Math.max(0, Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000)));
    return d;
  };

  const active = invitations.filter(i => !i.used && i.expiresAt > Date.now());
  const used = invitations.filter(i => i.used);
  const expired = invitations.filter(i => !i.used && i.expiresAt <= Date.now());

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <UserPlus size={24} className="text-gold-400" /> Invitaciones
      </h2>

      {/* Create invitation */}
      <GlassCard className="bg-white/5 border-white/10 !p-5">
        <h3 className="font-bold text-white mb-3 text-sm">Crear nueva invitacion</h3>
        <p className="text-xs text-gray-400 mb-3">Genera un codigo para que alguien se registre en Melody Music. El codigo expira en 7 dias.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Email del invitado (opcional)"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold-400 text-white placeholder-gray-500" />
          <button onClick={handleCreate} disabled={creating}
            className="bg-gold-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0 hover:bg-gold-600 transition-colors">
            <UserPlus size={16} /> {creating ? 'Creando...' : 'Generar Invitacion'}
          </button>
        </div>
      </GlassCard>

      {/* Just created - share panel */}
      {lastCreated && (
        <GlassCard className="bg-gold-500/10 border-gold-500/30 !p-5 animate-fade-in">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" /> Invitacion creada
          </h3>
          <div className="bg-white/10 rounded-xl p-4 mb-4 text-center">
            <p className="text-[10px] text-gray-400 uppercase mb-1">Codigo</p>
            <p className="text-2xl font-mono font-bold text-gold-400 tracking-[0.3em]">{lastCreated.code}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button onClick={() => handleCopyLink(lastCreated.code, lastCreated.id)}
              className="flex items-center justify-center gap-1.5 bg-white/10 text-white py-2.5 rounded-lg text-xs font-bold border border-white/10 hover:bg-white/20 transition-colors">
              {copiedId === lastCreated.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copiedId === lastCreated.id ? 'Copiado' : 'Copiar enlace'}
            </button>
            <button onClick={() => handleCopyCode(lastCreated.code, lastCreated.id)}
              className="flex items-center justify-center gap-1.5 bg-white/10 text-white py-2.5 rounded-lg text-xs font-bold border border-white/10 hover:bg-white/20 transition-colors">
              {copiedId === lastCreated.id + '-code' ? <Check size={14} className="text-green-400" /> : <Link2 size={14} />}
              {copiedId === lastCreated.id + '-code' ? 'Copiado' : 'Copiar codigo'}
            </button>
            <a href={getWhatsAppShareUrl(lastCreated.code)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-green-500/20 text-green-400 py-2.5 rounded-lg text-xs font-bold border border-green-500/30 hover:bg-green-500/30 transition-colors">
              <MessageCircle size={14} /> WhatsApp
            </a>
            <a href={getEmailShareUrl(lastCreated.code, lastCreated.email)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-blue-500/20 text-blue-400 py-2.5 rounded-lg text-xs font-bold border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
              <Mail size={14} /> Email
            </a>
          </div>
          <button onClick={() => setLastCreated(null)} className="text-gray-500 text-[10px] mt-3 hover:text-white">Cerrar</button>
        </GlassCard>
      )}

      {/* Active invitations */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {active.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">Activas ({active.length})</p>
            {active.map(inv => (
              <GlassCard key={inv.id} className="bg-white/5 border-white/10 !p-3 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                      <UserPlus size={18} className="text-gold-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-gold-400 text-sm tracking-wider">{inv.code}</p>
                      <p className="text-[10px] text-gray-500">
                        {inv.email && <span className="text-gray-400">{inv.email} · </span>}
                        <Clock size={9} className="inline" /> {daysLeft(inv.expiresAt)}d restantes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleCopyLink(inv.code, inv.id)}
                      className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="Copiar enlace">
                      {copiedId === inv.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <a href={getWhatsAppShareUrl(inv.code)} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-green-400/60 hover:text-green-400 rounded hover:bg-green-500/10" title="WhatsApp">
                      <MessageCircle size={14} />
                    </a>
                    <a href={getEmailShareUrl(inv.code, inv.email)} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-blue-400/60 hover:text-blue-400 rounded hover:bg-blue-500/10" title="Email">
                      <Mail size={14} />
                    </a>
                    <button onClick={() => deleteInvitation(inv.id).catch(() => {})}
                      className="p-1.5 text-red-400/40 hover:text-red-400 rounded hover:bg-red-500/10" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {used.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">Usadas ({used.length})</p>
            {used.map(inv => (
              <GlassCard key={inv.id} className="bg-green-500/5 border-green-500/10 !p-3 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={18} className="text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-gray-400 text-sm line-through">{inv.code}</p>
                      <p className="text-[10px] text-green-400">
                        Usada por {getUserName(inv.usedBy || '')} · {timeAgo(inv.usedAt || inv.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => deleteInvitation(inv.id).catch(() => {})}
                    className="p-1.5 text-red-400/30 hover:text-red-400 rounded flex-shrink-0"><Trash2 size={14} /></button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {expired.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 px-1">Expiradas ({expired.length})</p>
            {expired.map(inv => (
              <GlassCard key={inv.id} className="bg-white/3 border-white/5 !p-3 mb-2 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                      <Clock size={18} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-gray-500 text-sm">{inv.code}</p>
                      <p className="text-[10px] text-gray-600">Expirada · {timeAgo(inv.createdAt)}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteInvitation(inv.id).catch(() => {})}
                    className="p-1.5 text-red-400/30 hover:text-red-400 rounded flex-shrink-0"><Trash2 size={14} /></button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {invitations.length === 0 && (
          <div className="text-center text-white/30 py-16">
            <UserPlus size={40} className="mx-auto mb-2 opacity-30" />
            <p>No hay invitaciones</p>
            <p className="text-xs text-gray-600 mt-1">Crea una para invitar a alguien</p>
          </div>
        )}
      </div>
    </div>
  );
};