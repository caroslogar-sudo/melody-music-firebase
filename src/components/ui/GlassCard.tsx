import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white/30 backdrop-blur-xl border border-white/40 shadow-lg rounded-2xl p-6 ${className}`}
    >
      {children}
    </div>
  );
};
