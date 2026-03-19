import React from 'react';

export const MelodyLogo: React.FC<{ size?: number; className?: string }> = ({ size = 64, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={className}>
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F5D76E" />
        <stop offset="50%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="56" fill="url(#logoGrad)" opacity="0.15" />
    <circle cx="60" cy="60" r="50" stroke="url(#logoGrad)" strokeWidth="2" fill="none" opacity="0.4" />
    <circle cx="60" cy="60" r="36" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none" opacity="0.3" />
    <circle cx="60" cy="60" r="24" stroke="url(#logoGrad)" strokeWidth="1" fill="none" opacity="0.2" />
    <circle cx="60" cy="60" r="8" fill="url(#logoGrad)" opacity="0.6" />
    <circle cx="60" cy="60" r="3" fill="url(#logoGrad)" />
    <g filter="url(#glow)">
      <path d="M52 42 L52 75 C52 80 47 84 41 84 C35 84 31 80 31 75 C31 70 35 66 41 66 C44 66 47 67 49 69 L49 48 L72 42 L72 69 C72 74 67 78 61 78 C55 78 51 74 51 69 C51 64 55 60 61 60 C64 60 67 61 69 63 L69 46 Z"
        fill="url(#logoGrad)" opacity="0.9" />
    </g>
    <path d="M82 45 C88 50 91 56 91 62 C91 68 88 74 82 79" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
    <path d="M87 40 C95 47 100 55 100 63 C100 71 95 79 87 86" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3" />
  </svg>
);