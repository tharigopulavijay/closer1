import React from 'react';
import { playTapSound } from '../lib/audio';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'full',
  className = '',
  onClick,
  disabled,
  children,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      playTapSound();
      onClick?.(e);
    }
  };

  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const sizeStyles = {
    sm: 'h-10 px-4 text-xs rounded-xl min-h-[44px]',
    md: 'h-12 px-5 text-sm rounded-2xl min-h-[48px]',
    lg: 'h-14 px-6 text-base rounded-2xl min-h-[56px]',
    full: 'w-full h-14 px-6 text-base rounded-2xl min-h-[56px]',
  }[size];

  const variantStyles = {
    primary: 'bg-[#FFB547] text-[#160E1F] hover:bg-[#ffa82e] shadow-md shadow-[#FFB547]/10 font-bold',
    secondary: 'bg-[#C9A7FF] text-[#160E1F] hover:bg-[#bd95ff]',
    outline: 'bg-[#1E1428] border border-[#3A2A48] text-[#F7EFE6] hover:border-[#FFB547]/60 hover:bg-[#251933]',
    danger: 'bg-[#FF6B5E] text-white hover:bg-[#f85648] shadow-md shadow-[#FF6B5E]/20',
    ghost: 'bg-transparent text-[#B9A9C4] hover:text-[#F7EFE6] hover:bg-white/5',
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
