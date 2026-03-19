import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { BarChart3, Users, Clock, Calendar, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { subscribeToSessions, UserSession } from '../services/sessionService';
import { UserRole } from '../types';

export const Analytics = () => {
  const { user, users } = useApp();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));

  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.displayName || 'Desconocido';

  useEffect(() => {
    const unsub = subscribeToSessions(setSessions);
    return () => unsub();
  }, []);

  // Filter sessions by current view
  const filteredSessions = useMemo(() => {
    if (viewMode === 'day') return sessions.filter(s => s.date === selectedDate);
    if (viewMode === 'month') return sessions.filter(s => s.date?.startsWith(selectedMonth));
    return sessions.filter(s => s.date?.startsWith(selectedYear));
  }, [sessions, viewMode, selectedDate, selectedMonth, selectedYear]);

  // Group by user
  const userStats = useMemo(() => {
    const map = new Map<string, { uid: string; sessions: number; totalMinutes: number; lastLogin: number }>();
    filteredSessions.forEach(s => {
      if (!map.has(s.uid)) map.set(s.uid, { uid: s.uid, sessions: 0, totalMinutes: 0, lastLogin: 0 });
      const entry = map.get(s.uid)!;
      entry.sessions++;
      entry.totalMinutes += s.duration || 0;
      if (s.loginAt > entry.lastLogin) entry.lastLogin = s.loginAt;
    });
    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredSessions]);

  // Daily breakdown for month view
  const dailyBreakdown = useMemo(() => {
    if (viewMode !== 'month') return [];
    const map = new Map<string, { date: string; sessions: number; uniqueUsers: Set<string>; totalMinutes: number }>();
    filteredSessions.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, { date: s.date, sessions: 0, uniqueUsers: new Set(), totalMinutes: 0 });
      const entry = map.get(s.date)!;
      entry.sessions++;
      entry.uniqueUsers.add(s.uid);
      entry.totalMinutes += s.duration || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSessions, viewMode]);

  // Monthly breakdown for year view
  const monthlyBreakdown = useMemo(() => {
    if (viewMode !== 'year') return [];
    const map = new Map<string, { month: string; sessions: number; uniqueUsers: Set<string>; totalMinutes: number }>();
    filteredSessions.forEach(s => {
      const m = s.date?.substring(0, 7) || '';
      if (!map.has(m)) map.set(m, { month: m, sessions: 0, uniqueUsers: new Set(), totalMinutes: 0 });
      const entry = map.get(m)!;
      entry.sessions++;
      entry.uniqueUsers.add(s.uid);
      entry.totalMinutes += s.duration || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredSessions, viewMode]);

  const totalSessions = filteredSessions.length;
  const totalMinutes = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const uniqueUsers = new Set(filteredSessions.map(s => s.uid)).size;

  const formatDuration = (mins: number) => {
    if (mins < 1) return '< 1 min';
    if (mins < 60) return mins + ' min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h + 'h ' + (m > 0 ? m + 'm' : '');
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const formatDateTime = (ts: number) => new Date(ts).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const navigateDate = (dir: number) => {
    if (viewMode === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + dir);
      setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } else if (viewMode === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    } else {
      setSelectedYear(String(Number(selectedYear) + dir));
    }
  };

  const getDateLabel = () => {
    if (viewMode === 'day') {
      const d = new Date(selectedDate + 'T12:00:00');
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();
      if (isToday) return 'Hoy';
      if (isYesterday) return 'Ayer';
      return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (viewMode === 'month') {
      const [y, m] = selectedMonth.split('-');
      return new Date(Number(y), Number(m) - 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
    }
    return selectedYear;
  };

  const getMonthName = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString('es', { month: 'long' });
  };

  const getDayName = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
  };

  if (!user || user.role !== UserRole.MASTER) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <BarChart3 size={24} className="text-gold-400" /> Actividad de Usuarios
      </h2>

      {/* View mode tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 flex-shrink-0">
        {(['day', 'month', 'year'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={'flex-1 py-2 rounded-lg text-sm font-bold transition-colors ' + (viewMode === mode ? 'bg-gold-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
            {mode === 'day' ? 'Dia' : mode === 'month' ? 'Mes' : 'Ano'}
          </button>
        ))}
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 flex-shrink-0">
        <button onClick={() => navigateDate(-1)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10">
          <ChevronLeft size={18} />
        </button>
        <span className="text-white font-bold text-sm capitalize">{getDateLabel()}</span>
        <button onClick={() => navigateDate(1)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <GlassCard className="bg-blue-500/10 border-blue-500/20 !p-3 text-center">
          <Users size={16} className="text-blue-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{uniqueUsers}</p>
          <p className="text-[10px] text-gray-400">Usuarios</p>
        </GlassCard>
        <GlassCard className="bg-green-500/10 border-green-500/20 !p-3 text-center">
          <Activity size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{totalSessions}</p>
          <p className="text-[10px] text-gray-400">Conexiones</p>
        </GlassCard>
        <GlassCard className="bg-gold-500/10 border-gold-500/20 !p-3 text-center">
          <Clock size={16} className="text-gold-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{formatDuration(totalMinutes)}</p>
          <p className="text-[10px] text-gray-400">Tiempo total</p>
        </GlassCard>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">

        {/* DAY VIEW - individual sessions */}
        {viewMode === 'day' && (
          <>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider px-1">Conexiones por usuario</p>
            {userStats.length === 0 ? (
              <div className="text-center text-white/30 py-12"><Activity size={40} className="mx-auto mb-2 opacity-30" /><p>Sin actividad este dia</p></div>
            ) : userStats.map(stat => {
              const userSessions = filteredSessions.filter(s => s.uid === stat.uid).sort((a, b) => a.loginAt - b.loginAt);
              return (
                <GlassCard key={stat.uid} className="bg-white/5 border-white/10 !p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {getUserName(stat.uid).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{getUserName(stat.uid)}</p>
                        <p className="text-[10px] text-gray-500">{stat.sessions} conexion{stat.sessions !== 1 ? 'es' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-gold-400 font-bold text-sm">{formatDuration(stat.totalMinutes)}</p>
                    </div>
                  </div>
                  {/* Session timeline */}
                  <div className="space-y-1 ml-10">
                    {userSessions.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <span className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (s.logoutAt ? 'bg-gray-500' : 'bg-green-400 animate-pulse')} />
                        <span className="text-gray-400">{formatTime(s.loginAt)}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-gray-400">{s.logoutAt ? formatTime(s.logoutAt) : 'Activo'}</span>
                        <span className="text-gray-600 ml-auto">{formatDuration(s.duration || 0)}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              );
            })}
          </>
        )}

        {/* MONTH VIEW - daily breakdown */}
        {viewMode === 'month' && (
          <>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider px-1">Actividad por dia</p>
            {dailyBreakdown.length === 0 ? (
              <div className="text-center text-white/30 py-12"><Calendar size={40} className="mx-auto mb-2 opacity-30" /><p>Sin actividad este mes</p></div>
            ) : dailyBreakdown.map(day => (
              <GlassCard key={day.date} className="bg-white/5 border-white/10 !p-3 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => { setSelectedDate(day.date); setViewMode('day'); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-[10px] text-gold-400 font-bold uppercase">{getDayName(day.date).split(' ')[0]}</p>
                      <p className="text-sm text-white font-bold leading-none">{getDayName(day.date).split(' ')[1]}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white font-bold">{day.uniqueUsers.size} usuario{day.uniqueUsers.size !== 1 ? 's' : ''}</p>
                      <p className="text-[10px] text-gray-500">{day.sessions} conexion{day.sessions !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gold-400 font-bold text-sm">{formatDuration(day.totalMinutes)}</p>
                  </div>
                </div>
                {/* Mini user dots */}
                <div className="flex gap-1 mt-2 ml-13">
                  {Array.from(day.uniqueUsers).slice(0, 8).map(uid => (
                    <div key={uid} className="w-5 h-5 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-[8px] font-bold"
                      title={getUserName(uid)}>
                      {getUserName(uid).charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}

            {/* User totals for the month */}
            {userStats.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider px-1 mb-2">Resumen por usuario</p>
                {userStats.map(stat => (
                  <div key={stat.uid} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {getUserName(stat.uid).charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm text-white truncate">{getUserName(stat.uid)}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                      <span className="text-gray-400">{stat.sessions} conex.</span>
                      <span className="text-gold-400 font-bold">{formatDuration(stat.totalMinutes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* YEAR VIEW - monthly breakdown */}
        {viewMode === 'year' && (
          <>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider px-1">Actividad por mes</p>
            {monthlyBreakdown.length === 0 ? (
              <div className="text-center text-white/30 py-12"><Calendar size={40} className="mx-auto mb-2 opacity-30" /><p>Sin actividad este ano</p></div>
            ) : monthlyBreakdown.map(m => (
              <GlassCard key={m.month} className="bg-white/5 border-white/10 !p-3 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => { setSelectedMonth(m.month); setViewMode('month'); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-bold capitalize">{getMonthName(m.month)}</p>
                      <p className="text-[10px] text-gray-500">{m.uniqueUsers.size} usuario{m.uniqueUsers.size !== 1 ? 's' : ''} · {m.sessions} conexion{m.sessions !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                  <p className="text-gold-400 font-bold text-sm">{formatDuration(m.totalMinutes)}</p>
                </div>
              </GlassCard>
            ))}

            {/* User totals for the year */}
            {userStats.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider px-1 mb-2">Resumen anual por usuario</p>
                {userStats.map(stat => (
                  <div key={stat.uid} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {getUserName(stat.uid).charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm text-white truncate">{getUserName(stat.uid)}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                      <span className="text-gray-400">{stat.sessions} conex.</span>
                      <span className="text-gold-400 font-bold">{formatDuration(stat.totalMinutes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};