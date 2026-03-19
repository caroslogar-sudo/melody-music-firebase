import React from 'react';
import { Upload, CheckCircle, XCircle } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
  storageWarning?: string;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  progress,
  fileName,
  status,
  errorMessage,
  storageWarning,
}) => {
  return (
    <div className="fixed bottom-24 right-6 w-80 bg-gray-900/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl z-[150] animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        {status === 'uploading' && <Upload size={20} className="text-gold-300 animate-bounce" />}
        {status === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
        {status === 'error' && <XCircle size={20} className="text-red-400" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{fileName}</p>
          <p className="text-[10px] text-gray-400">
            {status === 'uploading' && `Subiendo... ${progress}%`}
            {status === 'success' && 'Subido correctamente'}
            {status === 'error' && (errorMessage || 'Error al subir')}
          </p>
        </div>
      </div>

      {status === 'uploading' && (
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-300 to-gold-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {storageWarning && (
        <div className="mt-2 bg-amber-500/20 border border-amber-500/30 rounded-lg p-2 text-[10px] text-amber-300">
          {storageWarning}
        </div>
      )}
    </div>
  );
};
