import React from 'react';
import { Moon, Mic, Gamepad2, CalendarDays, User } from 'lucide-react';
import { TabType } from '../types';
import { playTapSound } from '../lib/audio';

interface TabBarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  openPlansCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onChangeTab,
  openPlansCount = 1,
}) => {
  const tabs = [
    { id: 'drop' as TabType, label: 'Drop', icon: Moon },
    { id: 'rooms' as TabType, label: 'Rooms', icon: Mic },
    { id: 'play' as TabType, label: 'Play', icon: Gamepad2 },
    { id: 'plans' as TabType, label: 'Plans', icon: CalendarDays, badge: openPlansCount > 0 ? openPlansCount : undefined },
    { id: 'you' as TabType, label: 'You', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#160E1F]/95 backdrop-blur-lg border-t border-[#3A2A48]/70 max-w-[430px] mx-auto pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                playTapSound();
                onChangeTab(tab.id);
              }}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-150 select-none cursor-pointer relative ${
                isActive ? 'text-[#FFB547]' : 'text-[#B9A9C4] hover:text-[#F7EFE6]'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-[#FFB547] text-[#160E1F] text-[9px] font-extrabold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium transition-all ${
                  isActive ? 'text-[#FFB547] font-semibold' : 'text-[#B9A9C4]'
                }`}
              >
                {tab.label}
              </span>

              {/* Active marigold indicator dot */}
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFB547] mt-0.5 shadow-sm shadow-[#FFB547]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
