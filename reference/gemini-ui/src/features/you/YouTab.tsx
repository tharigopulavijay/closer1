import React, { useState } from 'react';
import { 
  User, 
  Flame, 
  ShieldCheck, 
  Share2, 
  Crown, 
  Gift, 
  Bot, 
  EyeOff, 
  Download, 
  Trash2, 
  ChevronRight, 
  Check, 
  Phone, 
  Sparkles,
  Lock,
  ArrowLeft,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CURRENT_USER } from '../../mocks/seedData';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Toggle } from '../../ui/Toggle';
import { playTapSound, playSuccessChime } from '../../lib/audio';

interface YouTabProps {
  onOpenSafety: () => void;
  onRestartOnboarding: () => void;
}

export const YouTab: React.FC<YouTabProps> = ({ onOpenSafety, onRestartOnboarding }) => {
  const [showPaywall, setShowPaywall] = useState(false);
  const [showGiftClaim, setShowGiftClaim] = useState(false);
  const [showSaathiCall, setShowSaathiCall] = useState(false);
  const [showVouchModal, setShowVouchModal] = useState(false);

  // Settings toggles
  const [discreetMode, setDiscreetMode] = useState(false);
  const [hideFromContacts, setHideFromContacts] = useState(true);

  // Saathi AI voice call simulator state
  const [saathiSpeaking, setSaathiSpeaking] = useState(true);
  const [saathiMinsRemaining, setSaathiMinsRemaining] = useState(18);

  // Gift delivery address state
  const [giftChoice, setGiftChoice] = useState<'pearls' | 'coffee'>('pearls');
  const [deliveryAddress, setDeliveryAddress] = useState('Flat 402, Sai Vihar, Gachibowli, Hyderabad - 500032');
  const [giftClaimed, setGiftClaimed] = useState(false);

  // Vouch link copied state
  const [vouchCopied, setVouchCopied] = useState(false);

  const handleCopyVouch = () => {
    playTapSound();
    setVouchCopied(true);
    setTimeout(() => setVouchCopied(false), 3000);
  };

  return (
    <div className="pb-28 pt-2">
      {/* Profile Header (Design 43: Arjun's Profile Hub) */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={CURRENT_USER.mainPhoto}
              alt={CURRENT_USER.name}
              className="w-20 h-20 rounded-[24px] object-cover border-2 border-[#FFB547]"
            />
            <span className="absolute -bottom-1 -right-1 bg-[#9FD7C7] text-[#160E1F] p-1 rounded-full shadow">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-3xl text-[#F7EFE6] leading-none">
                {CURRENT_USER.name}, {CURRENT_USER.age}
              </h1>
            </div>
            <p className="text-xs text-[#B9A9C4] mt-1">
              {CURRENT_USER.job} • {CURRENT_USER.location.split(',')[0]}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#9FD7C7]/15 text-[#9FD7C7] border border-[#9FD7C7]/30 font-semibold">
                Live Selfie Checked
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#FFB547]/15 text-[#FFB547] border border-[#FFB547]/30 font-semibold">
                Shows up: {CURRENT_USER.showsUpRate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 grid grid-cols-3 gap-2.5 mb-5">
        <div className="p-3 rounded-2xl bg-[#1E1428] border border-[#3A2A48] text-center">
          <Flame className="w-5 h-5 text-[#FFB547] mx-auto mb-1 fill-[#FFB547]" />
          <span className="font-mono text-lg font-bold text-[#FFB547]">23</span>
          <p className="text-[10px] text-[#B9A9C4]">Day Streak</p>
        </div>

        <div className="p-3 rounded-2xl bg-[#1E1428] border border-[#3A2A48] text-center">
          <ShieldCheck className="w-5 h-5 text-[#9FD7C7] mx-auto mb-1" />
          <span className="font-mono text-lg font-bold text-[#9FD7C7]">100%</span>
          <p className="text-[10px] text-[#B9A9C4]">Show-up Rate</p>
        </div>

        <div className="p-3 rounded-2xl bg-[#1E1428] border border-[#3A2A48] text-center">
          <Crown className="w-5 h-5 text-[#C9A7FF] mx-auto mb-1" />
          <span className="font-mono text-lg font-bold text-[#C9A7FF]">Tier 1</span>
          <p className="text-[10px] text-[#B9A9C4]">Verified Club</p>
        </div>
      </div>

      {/* ACTION BANNERS */}
      <div className="px-4 space-y-3 mb-6">
        {/* Closer+ Membership Banner (Design 45) */}
        <div
          onClick={() => {
            playTapSound();
            setShowPaywall(true);
          }}
          className="p-4 rounded-[22px] bg-gradient-to-r from-[#FFB547]/20 via-[#241830] to-[#1E1428] border border-[#FFB547]/60 flex items-center justify-between cursor-pointer hover:border-[#FFB547] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFB547] text-[#160E1F] flex items-center justify-center font-black">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl text-[#F7EFE6]">Closer+</h3>
                <span className="text-[10px] bg-[#FFB547] text-[#160E1F] font-bold px-2 py-0.2 rounded-full">
                  ₹299/mo
                </span>
              </div>
              <p className="text-[11px] text-[#B9A9C4]">
                8:30 PM Early Drop access & 5 streak freezes/mo
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#FFB547]" />
        </div>

        {/* Saathi AI Voice Companion Banner (Design 47 / 48 / 55) */}
        <div
          onClick={() => {
            playTapSound();
            setShowSaathiCall(true);
          }}
          className="p-4 rounded-[22px] bg-gradient-to-r from-[#9FD7C7]/20 via-[#241830] to-[#1E1428] border border-[#9FD7C7]/50 flex items-center justify-between cursor-pointer hover:border-[#9FD7C7] transition-all"
        >
          <div className="flex items-center gap-3">
            {/* Pearlescent Orb Avatar (Design 55) */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9FD7C7] via-[#C9A7FF] to-[#FFB547] p-0.5 shadow-md shadow-[#9FD7C7]/20">
              <div className="w-full h-full rounded-full bg-[#160E1F] flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#9FD7C7]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-serif text-xl text-[#F7EFE6]">Saathi</h3>
                <span className="text-[9px] bg-[#9FD7C7]/20 text-[#9FD7C7] font-bold px-1.5 py-0.2 rounded border border-[#9FD7C7]/40">
                  AI Voice
                </span>
              </div>
              <p className="text-[11px] text-[#B9A9C4]">
                Practice date talk, calm nerves, get Hyderabad recs
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#9FD7C7]" />
        </div>

        {/* Milestone Streak Reward Claim (Design 46) */}
        <div
          onClick={() => {
            playTapSound();
            setShowGiftClaim(true);
          }}
          className="p-4 rounded-[22px] bg-[#1E1428] border border-[#3A2A48] flex items-center justify-between cursor-pointer hover:border-[#C9A7FF] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C9A7FF]/20 text-[#C9A7FF] flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif text-lg text-[#F7EFE6]">
                Day 90 Streak Gift Ready
              </h4>
              <p className="text-[11px] text-[#B9A9C4]">
                Choose: Pearl necklace or artisanal filter coffee
              </p>
            </div>
          </div>
          <span className="text-xs text-[#FFB547] font-semibold">Claim →</span>
        </div>
      </div>

      {/* PRIVACY & SETTINGS HUB */}
      <div className="px-4 space-y-3 mb-6">
        <span className="text-xs uppercase font-bold tracking-wider text-[#B9A9C4] block px-1">
          Privacy & Controls
        </span>

        {/* Vouch Request */}
        <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-4 h-4 text-[#FFB547]" />
            <div>
              <p className="text-xs font-medium text-[#F7EFE6]">Ask a friend to vouch for you</p>
              <p className="text-[10px] text-[#B9A9C4]">Friends add a 1-sentence endorsement to your profile.</p>
            </div>
          </div>
          <button
            onClick={() => {
              playTapSound();
              setShowVouchModal(true);
            }}
            className="px-3 py-1 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#FFB547] font-semibold hover:border-[#FFB547]"
          >
            Invite
          </button>
        </div>

        {/* Discreet Mode */}
        <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
          <Toggle
            checked={discreetMode}
            onChange={setDiscreetMode}
            label="Discreet App Icon & Name"
            description="Changes app icon to a clean calculator or notes app for discretion."
          />
        </div>

        {/* Hide from contacts */}
        <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
          <Toggle
            checked={hideFromContacts}
            onChange={setHideFromContacts}
            label="Hide me from all phone contacts"
            description="SHA-256 local device hash active. Your phonebook never sees you."
          />
        </div>
      </div>

      {/* ACCOUNT ACTIONS */}
      <div className="px-4 space-y-2">
        <button
          onClick={onRestartOnboarding}
          className="w-full p-3 rounded-xl bg-[#1E1428] border border-[#3A2A48] text-xs text-[#B9A9C4] hover:text-[#F7EFE6] flex items-center justify-between"
        >
          <span>Replay Onboarding Flow (Designs 1–10)</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            playTapSound();
            alert('Your encrypted data export request (JSON format) has been initiated.');
          }}
          className="w-full p-3 rounded-xl bg-[#1E1428] border border-[#3A2A48] text-xs text-[#B9A9C4] hover:text-[#F7EFE6] flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Download my data
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* CLOSER+ PAYWALL SHEET (Design 45) */}
      <Sheet
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Closer+"
        subtitle="Thoughtful dating, unlocked."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FFB547]/20 to-[#FFA229]/10 border border-[#FFB547]/50 text-center space-y-1">
            <Crown className="w-8 h-8 text-[#FFB547] mx-auto" />
            <h4 className="font-serif text-2xl text-[#F7EFE6]">Elevate Your Experience</h4>
            <p className="text-xs text-[#B9A9C4]">Zero fake perks. Real Hyderabad advantages.</p>
          </div>

          <div className="space-y-2 text-xs">
            {[
              '8:30 PM Early Drop access (30 mins ahead)',
              '5 Streak Freezes per month (never lose your streak)',
              'Unlimited Chai Break 1-on-1 calls',
              'See shared interests and mutual friends beforehand',
              'Priority table reservations at partner cafés',
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-[#241830]">
                <Check className="w-4 h-4 text-[#9FD7C7] flex-shrink-0" />
                <span className="text-[#F7EFE6]">{p}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl border-2 border-[#FFB547] bg-[#FFB547]/10 text-center">
              <span className="text-[10px] text-[#FFB547] font-bold uppercase tracking-wider block">
                Monthly
              </span>
              <span className="font-serif text-2xl text-[#F7EFE6] font-bold">₹299</span>
              <span className="text-[10px] text-[#B9A9C4] block mt-0.5">Cancel anytime</span>
            </div>

            <div className="p-3.5 rounded-2xl border border-[#3A2A48] bg-[#1E1428] text-center">
              <span className="text-[10px] text-[#9FD7C7] font-bold uppercase tracking-wider block">
                3 Months
              </span>
              <span className="font-serif text-2xl text-[#F7EFE6] font-bold">₹799</span>
              <span className="text-[10px] text-[#9FD7C7] block mt-0.5">Save 15%</span>
            </div>
          </div>

          <Button
            size="full"
            onClick={() => {
              playSuccessChime();
              setShowPaywall(false);
              confetti({ particleCount: 70 });
            }}
          >
            Upgrade to Closer+
          </Button>
        </div>
      </Sheet>

      {/* SAATHI AI CALL SHEET (Design 47 / 48 / 55) */}
      <Sheet
        isOpen={showSaathiCall}
        onClose={() => setShowSaathiCall(false)}
        title="Saathi (AI Voice Companion)"
        subtitle="Clearly labelled AI. Voice companion to practice date conversations."
      >
        <div className="space-y-4 text-center">
          {/* Pearlescent Orb Avatar with smooth glow animation */}
          <div className="relative w-32 h-32 mx-auto my-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FFB547] via-[#9FD7C7] to-[#C9A7FF] blur-xl opacity-60 animate-soft-pulse" />
            <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-[#1E1428] via-[#2E1E3D] to-[#160E1F] border-2 border-[#9FD7C7] flex flex-col items-center justify-center shadow-2xl">
              <Bot className="w-10 h-10 text-[#9FD7C7] mb-1" />
              <span className="text-[9px] uppercase tracking-widest text-[#FFB547] font-bold">
                Saathi AI
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#241830] border border-[#3A2A48] text-left">
            <p className="text-xs text-[#9FD7C7] font-mono mb-1">
              Saathi AI:
            </p>
            <p className="font-serif text-lg text-[#F7EFE6] leading-snug">
              “Hey Arjun! Are you feeling excited for your Saturday coffee at Roastery? Want to practice asking Ananya about her favorite Old City spots?”
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-[#B9A9C4] px-2">
            <span>Free AI voice minutes: {saathiMinsRemaining} mins</span>
            <button
              onClick={() => setSaathiMinsRemaining((m) => m + 30)}
              className="text-[#FFB547] underline font-semibold"
            >
              Recharge +30m
            </button>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowSaathiCall(false)}
            >
              End Session
            </Button>
            <Button
              className="flex-1 !bg-[#9FD7C7] !text-[#160E1F]"
              onClick={() => {
                playSuccessChime();
                setSaathiSpeaking(!saathiSpeaking);
              }}
            >
              {saathiSpeaking ? 'Speak to Saathi' : 'Listening...'}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* DAY 90 STREAK GIFT CLAIM (Design 46) */}
      <Sheet
        isOpen={showGiftClaim}
        onClose={() => setShowGiftClaim(false)}
        title="Claim Your Day 90 Streak Gift"
        subtitle="Thank you for 90 days of showing up in Hyderabad."
      >
        <div className="space-y-4">
          {!giftClaimed ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setGiftChoice('pearls')}
                  className={`p-3.5 rounded-2xl border cursor-pointer text-left ${
                    giftChoice === 'pearls'
                      ? 'border-[#FFB547] bg-[#FFB547]/10'
                      : 'border-[#3A2A48] bg-[#1E1428]'
                  }`}
                >
                  <span className="text-2xl mb-1 block">🦪</span>
                  <h4 className="font-serif text-base text-[#F7EFE6]">
                    Cult Pearl Necklace
                  </h4>
                  <p className="text-[10px] text-[#B9A9C4]">Certified Hyderabad freshwater pearl.</p>
                </div>

                <div
                  onClick={() => setGiftChoice('coffee')}
                  className={`p-3.5 rounded-2xl border cursor-pointer text-left ${
                    giftChoice === 'coffee'
                      ? 'border-[#FFB547] bg-[#FFB547]/10'
                      : 'border-[#3A2A48] bg-[#1E1428]'
                  }`}
                >
                  <span className="text-2xl mb-1 block">☕</span>
                  <h4 className="font-serif text-base text-[#F7EFE6]">
                    Artisanal Filter Box
                  </h4>
                  <p className="text-[10px] text-[#B9A9C4]">Roastery roast + brass davarah set.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                  Private Delivery Address (Hyderabad only, encrypted)
                </label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] focus:outline-none focus:border-[#FFB547]"
                />
                <span className="text-[10px] text-[#9FD7C7] flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3" /> Address visible only to fulfillment team, purged after delivery.
                </span>
              </div>

              <Button
                size="full"
                onClick={() => {
                  playSuccessChime();
                  setGiftClaimed(true);
                  confetti({ particleCount: 80 });
                }}
              >
                Confirm Delivery
              </Button>
            </>
          ) : (
            <div className="text-center py-6 space-y-2">
              <Check className="w-12 h-12 text-[#9FD7C7] mx-auto stroke-[2.5]" />
              <h4 className="font-serif text-2xl text-[#F7EFE6]">Gift Dispatched!</h4>
              <p className="text-xs text-[#B9A9C4]">
                Your package will arrive in 2 business days via BlueDart courier.
              </p>
              <Button size="full" onClick={() => setShowGiftClaim(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      </Sheet>

      {/* VOUCH REQUEST MODAL */}
      <Sheet
        isOpen={showVouchModal}
        onClose={() => setShowVouchModal(false)}
        title="Ask a Friend to Vouch"
        subtitle="Vouches dramatically increase date matches and trust."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] space-y-1">
            <p className="font-semibold text-[#FFB547]">Pre-written WhatsApp link:</p>
            <p className="text-[11px] text-[#B9A9C4] italic font-serif">
              “Hey! I joined Closer for Hyderabad dating. Can you drop a 1-sentence vouch about me here? https://closer.in/vouch/arjun”
            </p>
          </div>

          <Button
            size="full"
            onClick={handleCopyVouch}
          >
            {vouchCopied ? 'Link Copied to Clipboard!' : 'Copy WhatsApp Share Link'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
