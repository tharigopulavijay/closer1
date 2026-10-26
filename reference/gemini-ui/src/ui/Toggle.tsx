import React from 'react';
import { playTapSound } from '../lib/audio';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) => {
  const handleToggle = () => {
    if (disabled) return;
    playTapSound();
    onChange(!checked);
  };

  return (
    <div
      onClick={handleToggle}
      className={`flex items-center justify-between gap-3 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {(label || description) && (
        <div className="flex-1">
          {label && <p className="text-sm font-medium text-[#F7EFE6]">{label}</p>}
          {description && <p className="text-xs text-[#B9A9C4] mt-0.5">{description}</p>}
        </div>
      )}
      <div
        className={`w-12 h-7 rounded-full transition-colors duration-200 p-1 flex items-center ${
          checked ? 'bg-[#FFB547]' : 'bg-[#2E1E3D] border border-[#3A2A48]'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-md ${
            checked ? 'translate-x-5 !bg-[#160E1F]' : 'translate-x-0 !bg-[#B9A9C4]'
          }`}
        />
      </div>
    </div>
  );
};
