import React from 'react';
import { Shield, ShieldCheck, Sparkles, LayoutDashboard } from 'lucide-react';
import { playTapSound } from '../lib/audio';

interface TopBarProps {
  badgeText?: string;
  onOpenSafety: () => void;
  isAdminView?: boolean;
  onToggleAdmin?: () => void;
  onRestartOnboarding?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  badgeText = 'Open plans 1 / 3',
  onOpenSafety,
  isAdminView = false,
  onToggleAdmin,
  onRestartOnboarding,
}) => {
  const handleSafetyClick = () => {
    playTapSound();
    onOpenSafety();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#160E1F]/90 backdrop-blur-md border-b border-[#3A2A48]/50 px-4 py-2.5">
      {/* Simulated mobile status bar header row */}
      <div className="flex items-center justify-between text-[11px] text-[#B9A9C4] font-medium mb-1.5 px-0.5">
        <span>9:41</span>
        <div className="flex items-center gap-2">
          {onRestartOnboarding && (
            <button
              onClick={onRestartOnboarding}
              title="Preview Onboarding Flow"
              className="text-[10px] text-[#C9A7FF] hover:text-[#FFB547] underline flex items-center gap-0.5"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Onboarding</span>
            </button>
          )}
          {onToggleAdmin && (
            <button
              onClick={onToggleAdmin}
              className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-colors ${
                isAdminView
                  ? 'border-[#FFB547] bg-[#FFB547]/20 text-[#FFB547]'
                  : 'border-[#3A2A48] bg-[#241830] text-[#B9A9C4] hover:text-[#F7EFE6]'
              }`}
            >
              <LayoutDashboard className="w-2.5 h-2.5" />
              <span>{isAdminView ? 'User App' : 'Admin'}</span>
            </button>
          )}
          <span>5G</span>
          <span>100%</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <span className="font-serif italic text-2xl tracking-normal text-[#F7EFE6]">
            closer
          </span>
        </div>

        {/* Center pill badge */}
        {badgeText && (
          <div className="border border-[#3A2A48] bg-[#1E1428] text-xs text-[#B9A9C4] font-medium px-3 py-1 rounded-full flex items-center gap-1.5">
            <span>{badgeText}</span>
          </div>
        )}

        {/* Safety Shield Button */}
        <button
          onClick={handleSafetyClick}
          aria-label="Safety Centre"
          className="w-9 h-9 rounded-full border border-[#9FD7C7]/40 bg-[#9FD7C7]/10 flex items-center justify-center text-[#9FD7C7] hover:bg-[#9FD7C7]/20 transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <Shield className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
