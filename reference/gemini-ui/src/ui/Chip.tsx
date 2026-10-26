import React from 'react';
import { playTapSound } from '../lib/audio';

interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  variant?: 'default' | 'mint' | 'streak' | 'lavender';
  onClick?: () => void;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  active = false,
  variant = 'default',
  onClick,
  className = '',
}) => {
  const handleClick = () => {
    if (onClick) {
      playTapSound();
      onClick();
    }
  };

  const getVariantClasses = () => {
    if (variant === 'streak') {
      return 'border border-[#FFB547]/50 bg-[#FFB547]/15 text-[#FFB547] shadow-sm shadow-[#FFB547]/20';
    }
    if (variant === 'mint') {
      return 'border border-[#9FD7C7]/40 bg-[#9FD7C7]/15 text-[#9FD7C7]';
    }
    if (variant === 'lavender') {
      return 'border border-[#C9A7FF]/40 bg-[#C9A7FF]/15 text-[#C9A7FF]';
    }
    if (active) {
      return 'border border-[#FFB547] bg-[#FFB547]/20 text-[#FFB547] font-semibold';
    }
    return 'border border-[#3A2A48] bg-[#1E1428] text-[#B9A9C4] hover:text-[#F7EFE6] hover:border-[#3A2A48]/80';
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all duration-150 select-none ${
        onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'
      } ${getVariantClasses()} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
};
