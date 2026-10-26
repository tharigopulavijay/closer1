import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { playTapSound } from '../lib/audio';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[88vh]',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    playTapSound();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full max-w-[430px] bg-[#1E1428] border-t border-x border-[#3A2A48] rounded-t-[28px] p-5 shadow-2xl flex flex-col ${maxHeight} overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-250`}
      >
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-[#3A2A48] rounded-full mx-auto mb-4 flex-shrink-0" />

        {(title || subtitle) && (
          <div className="flex items-start justify-between mb-4 flex-shrink-0">
            <div>
              {title && <h3 className="font-serif text-2xl text-[#F7EFE6] leading-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-[#B9A9C4] mt-1">{subtitle}</p>}
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full bg-[#2A1C38] text-[#B9A9C4] hover:text-[#F7EFE6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex-1 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
};
