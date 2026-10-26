import React from 'react';
import { ShieldCheck, Check } from 'lucide-react';

interface VerifiedPillProps {
  type?: 'vouched' | 'live-selfie' | 'safe';
  text?: string;
  className?: string;
}

export const VerifiedPill: React.FC<VerifiedPillProps> = ({
  type = 'vouched',
  text,
  className = '',
}) => {
  if (type === 'live-selfie') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-[#9FD7C7]/40 bg-[#9FD7C7]/15 text-[#9FD7C7] ${className}`}>
        <Check className="w-3.5 h-3.5" />
        <span>{text || 'Live selfie matched'}</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-[#9FD7C7]/40 bg-[#9FD7C7]/15 text-[#9FD7C7] ${className}`}>
      <ShieldCheck className="w-3.5 h-3.5" />
      <span>{text || 'Vouched'}</span>
    </div>
  );
};
