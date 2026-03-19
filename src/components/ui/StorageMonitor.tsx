import React from 'react';
import { useApp } from '../../context/AppContext';
import { STORAGE_LIMITS } from '../../types';
import { formatBytes } from '../../services/storageService';
import { HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';

export const StorageMonitor: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { storageUsage, refreshStorageUsage } = useApp();

  if (!storageUsage) return null;

  const percent = (storageUsage.totalBytes / STORAGE_LIMITS.TOTAL_BYTES) * 100;
  const isCritical = percent >= STORAGE_LIMITS.CRITICAL_PERCENT;
  const isWarning = percent >= STORAGE_LIMITS.WARN_PERCENT;

  const barColor = isCritical
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  const statusIcon = isCritical ? (
    <AlertTriangle size={16} className="text-red-400" />
  ) : isWarning ? (
    <AlertTriangle size={16} className="text-amber-400" />
  ) : (
    <CheckCircle size={16} className="text-emerald-400" />
  );

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/10 cursor-pointer"
        onClick={refreshStorageUsage}
        title="Clic para actualizar"
      >
        <HardDrive size={14} className="text-gold-300" />
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 font-mono">{percent.toFixed(0)}%</span>
      </div>
    );
  }

  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <HardDrive size={16} className="text-gold-300" />
          Almacenamiento Firebase
        </h4>
        {statusIcon}
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatBytes(storageUsage.totalBytes)} usados</span>
        <span>{formatBytes(STORAGE_LIMITS.TOTAL_BYTES)} total</span>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 uppercase">Audio</p>
          <p className="text-xs text-white font-bold">{formatBytes(storageUsage.audioBytes)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 uppercase">Vídeo</p>
          <p className="text-xs text-white font-bold">{formatBytes(storageUsage.videoBytes)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 uppercase">Archivos</p>
          <p className="text-xs text-white font-bold">{storageUsage.fileCount}</p>
        </div>
      </div>

      {/* Alert messages */}
      {isCritical && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-2 text-xs text-red-300 font-bold text-center">
          ⚠️ CRÍTICO: Almacenamiento al {percent.toFixed(1)}%. ¡Libera espacio!
        </div>
      )}
      {isWarning && !isCritical && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-300 text-center">
          ⚠️ Almacenamiento al {percent.toFixed(1)}%. Considera liberar espacio.
        </div>
      )}
    </div>
  );
};
