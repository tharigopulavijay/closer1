import React, { useState } from 'react';
import { TabType } from './types';
import { TopBar } from './ui/TopBar';
import { TabBar } from './ui/TabBar';
import { DropTab } from './features/drop/DropTab';
import { RoomsTab } from './features/rooms/RoomsTab';
import { PlayTab } from './features/play/PlayTab';
import { PlansTab } from './features/plans/PlansTab';
import { YouTab } from './features/you/YouTab';
import { SafetyCentreModal } from './features/safety/SafetyCentreModal';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { AdminPanel } from './features/admin/AdminPanel';
import { Smartphone, Monitor } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('drop');
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isMobileFrameActive, setIsMobileFrameActive] = useState(true);
  const [openPlansCount, setOpenPlansCount] = useState(1);

  // If Admin panel is open, show full desktop admin screen
  if (isAdminOpen) {
    return <AdminPanel onClose={() => setIsAdminOpen(false)} />;
  }

  // If user wants to experience / test onboarding
  if (isOnboardingOpen) {
    return (
      <OnboardingWizard
        onComplete={() => setIsOnboardingOpen(false)}
        onClose={() => setIsOnboardingOpen(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0814] flex flex-col items-center justify-start text-[#F7EFE6] font-sans antialiased">
      {/* Desktop Quick Bar (shown only when viewport is large) */}
      <div className="hidden md:flex items-center justify-between w-full max-w-[540px] px-4 py-2 text-xs text-[#B9A9C4]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#9FD7C7]" />
          <span className="font-serif italic text-sm text-[#FFB547]">Closer</span>
          <span>· Hyderabad 390px Mobile Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileFrameActive(!isMobileFrameActive)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E1428] border border-[#3A2A48] hover:text-[#F7EFE6] cursor-pointer"
          >
            {isMobileFrameActive ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
            <span>{isMobileFrameActive ? 'Full Screen' : 'Phone Frame'}</span>
          </button>
        </div>
      </div>

      {/* Main Container / Mobile Phone Shell */}
      <div
        className={`w-full bg-[#160E1F] flex flex-col relative transition-all duration-200 ${
          isMobileFrameActive
            ? 'max-w-[430px] min-h-screen md:min-h-[860px] md:my-4 md:rounded-[40px] md:border-[8px] md:border-[#2A1D36] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden'
            : 'max-w-2xl min-h-screen'
        }`}
      >
        {/* Dynamic Island / Speaker notch for simulated mobile frame */}
        {isMobileFrameActive && (
          <div className="hidden md:block w-32 h-4.5 bg-[#0E0814] rounded-full mx-auto my-1.5 z-50 flex-shrink-0" />
        )}

        {/* TopBar */}
        <TopBar
          badgeText={`Open plans ${openPlansCount} / 3`}
          onOpenSafety={() => setIsSafetyOpen(true)}
          isAdminView={isAdminOpen}
          onToggleAdmin={() => setIsAdminOpen(!isAdminOpen)}
          onRestartOnboarding={() => setIsOnboardingOpen(true)}
        />

        {/* Active Tab View */}
        <main className="flex-1 w-full overflow-y-auto no-scrollbar relative">
          {activeTab === 'drop' && (
            <DropTab
              streakDays={23}
              onOpenSafety={() => setIsSafetyOpen(true)}
              onNavigateToPlans={() => setActiveTab('plans')}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomsTab onOpenSafety={() => setIsSafetyOpen(true)} />
          )}

          {activeTab === 'play' && (
            <PlayTab onOpenSafety={() => setIsSafetyOpen(true)} />
          )}

          {activeTab === 'plans' && (
            <PlansTab onOpenSafety={() => setIsSafetyOpen(true)} />
          )}

          {activeTab === 'you' && (
            <YouTab
              onOpenSafety={() => setIsSafetyOpen(true)}
              onRestartOnboarding={() => setIsOnboardingOpen(true)}
            />
          )}
        </main>

        {/* Locked 5-tab Bottom Navigation */}
        <TabBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          openPlansCount={openPlansCount}
        />

        {/* Safety Centre Modal */}
        <SafetyCentreModal
          isOpen={isSafetyOpen}
          onClose={() => setIsSafetyOpen(false)}
        />
      </div>
    </div>
  );
}
