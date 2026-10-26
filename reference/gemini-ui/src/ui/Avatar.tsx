import React, { useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  mode?: 'photo' | 'initials' | 'avatar';
  isVerified?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  mode = 'photo',
  isVerified = false,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-24 h-24 text-2xl',
  }[size];

  const getInitials = (str: string) => {
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const showPhoto = mode === 'photo' && src && !imageError;

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      <div
        className={`${sizeClasses} rounded-full overflow-hidden flex items-center justify-center font-bold border border-[#3A2A48] bg-[#241830] text-[#C9A7FF]`}
      >
        {showPhoto ? (
          <img
            src={src}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : mode === 'initials' || (mode === 'photo' && !src) ? (
          <span>{getInitials(name)}</span>
        ) : (
          <User className="w-1/2 h-1/2 text-[#B9A9C4]" />
        )}
      </div>
      {isVerified && (
        <span className="absolute -bottom-0.5 -right-0.5 bg-[#9FD7C7] text-[#160E1F] rounded-full p-0.5 shadow">
          <ShieldCheck className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};
