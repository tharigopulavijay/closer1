import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Clock, 
  ChevronRight, 
  Play, 
  Pause, 
  ArrowLeft, 
  Heart, 
  ShieldCheck, 
  Calendar, 
  Coffee, 
  Check, 
  Sparkles,
  Info,
  Gift,
  Snowflake,
  Send,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, TableOfSix } from '../../types';
import { SEED_PROFILES, SEED_TABLE_OF_SIX } from '../../mocks/seedData';
import { PersonCard } from '../../ui/PersonCard';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { Sheet } from '../../ui/Sheet';
import { VerifiedPill } from '../../ui/VerifiedPill';
import { playTapSound, playSuccessChime } from '../../lib/audio';

interface DropTabProps {
  streakDays: number;
  onOpenSafety: () => void;
  onNavigateToPlans: () => void;
}

export const DropTab: React.FC<DropTabProps> = ({
  streakDays = 23,
  onOpenSafety,
  onNavigateToPlans,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);

  // Profile detail interaction states
  const [selectedLikeTarget, setSelectedLikeTarget] = useState<'voice' | 'prompt' | 'photo' | null>('prompt');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [skippedProfiles, setSkippedProfiles] = useState<string[]>([]);

  // Mutual match slot picker states
  const [selectedDay, setSelectedDay] = useState('Saturday, 31 Oct');
  const [selectedSlot, setSelectedSlot] = useState('4:30 PM');
  const [selectedPlanType, setSelectedPlanType] = useState('Coffee');
  const [freezesCount, setFreezesCount] = useState(2);

  // Countdown timer to 9:00 PM IST
  const [countdown, setCountdown] = useState({ hours: 23, minutes: 58, seconds: 12 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSendLike = (profile: UserProfile) => {
    playSuccessChime();
    setLikedProfiles((prev) => [...prev, profile.id]);
    setSelectedProfile(null);

    // If liking Ananya, trigger the iconic "Mutual Match, Choose a Slot" screen!
    if (profile.id === 'p_ananya') {
      setTimeout(() => {
        setShowMatchModal(true);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#FFB547', '#9FD7C7', '#C9A7FF'],
        });
      }, 400);
    }
  };

  const handleSkipProfile = (profile: UserProfile) => {
    playTapSound();
    setSkippedProfiles((prev) => [...prev, profile.id]);
    setSelectedProfile(null);
  };

  const activeProfiles = SEED_PROFILES.filter(
    (p) => !skippedProfiles.includes(p.id)
  );

  return (
    <div className="pb-24 pt-2">
      {/* Charminar Silhouette & Night Header Backdrop */}
      <div className="relative px-4 pt-2 pb-4">
        {/* Date & Streak row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono tracking-wider uppercase text-[#B9A9C4]">
            MON 26 OCT · 9:00 PM
          </span>
          <button
            onClick={() => {
              playTapSound();
              setShowStreakModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#FFB547]/50 bg-[#FFB547]/15 text-[#FFB547] text-xs font-bold shadow-sm shadow-[#FFB547]/20 hover:scale-105 transition-all cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 fill-[#FFB547]" />
            <span>{streakDays}-day streak</span>
          </button>
        </div>

        {/* Big Headline */}
        <h1 className="font-serif text-4xl text-[#F7EFE6] leading-none mb-1.5">
          Tonight’s <span className="italic text-[#FFB547]">Drop</span>
        </h1>

        {/* Countdown subtitle */}
        <div className="flex items-center gap-2 text-xs text-[#B9A9C4]">
          <Clock className="w-3.5 h-3.5 text-[#B9A9C4]" />
          <span>
            Three people, picked for you. Next Drop in{' '}
            <span className="font-mono text-[#F7EFE6] font-medium">
              {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
            </span>
          </span>
        </div>
      </div>

      {/* 3 PersonCards List */}
      <div className="px-4 space-y-3 mb-5">
        {activeProfiles.length > 0 ? (
          activeProfiles.map((profile) => (
            <div key={profile.id} className="relative">
              <PersonCard
                profile={profile}
                onClick={(p) => setSelectedProfile(p)}
              />
              {likedProfiles.includes(profile.id) && (
                <div className="absolute top-2 right-2 bg-[#FFB547] text-[#160E1F] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                  <Check className="w-3 h-3 stroke-[3]" /> Liked
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-8 rounded-[24px] bg-[#1E1428] border border-[#3A2A48] text-center">
            <Sparkles className="w-8 h-8 text-[#FFB547] mx-auto mb-2" />
            <h3 className="font-serif text-2xl text-[#F7EFE6] mb-1">
              All caught up for tonight!
            </h3>
            <p className="text-xs text-[#B9A9C4] mb-4">
              Your next 3 Hyderabad profiles arrive tomorrow at 9:00 PM IST.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSkippedProfiles([]);
                setLikedProfiles([]);
              }}
            >
              Reset Tonight’s Drop
            </Button>
          </div>
        )}
      </div>

      {/* Table of 6 Banner (Design 14 / 38) */}
      <div className="px-4">
        <div
          onClick={() => {
            playTapSound();
            setShowTableModal(true);
          }}
          className="rounded-[22px] bg-gradient-to-r from-[#FFB547] to-[#FFA229] p-4 text-[#160E1F] cursor-pointer hover:shadow-lg hover:shadow-[#FFB547]/20 transition-all flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#160E1F]/10 border border-black/10">
              <img
                src={SEED_TABLE_OF_SIX.image}
                alt="Table of 6"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  Table of 6 · Wed 8 PM
                </span>
              </div>
              <h4 className="font-serif text-xl font-bold leading-tight">
                Telugu cinema nerds
              </h4>
              <p className="text-xs text-[#160E1F]/80 flex items-center gap-1.5 mt-0.5">
                <span>{SEED_TABLE_OF_SIX.area}</span>
                <span>•</span>
                <span className="font-bold bg-white/30 px-2 py-0.5 rounded-full text-[10px]">
                  {SEED_TABLE_OF_SIX.availableSeats} seats left
                </span>
              </p>
            </div>
          </div>

          <div className="w-9 h-9 rounded-full bg-[#160E1F] text-[#FFB547] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* DETAILED PROFILE MODAL (Matching Design 16: Ananya's Profile) */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-[#160E1F] flex flex-col max-w-[430px] mx-auto overflow-hidden animate-in fade-in duration-200">
          {/* Top Bar with back button & safety shield */}
          <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
            <button
              onClick={() => setSelectedProfile(null)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenSafety}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-[#9FD7C7]/50 flex items-center justify-center text-[#9FD7C7]"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Profile Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
            {/* Hero Photo */}
            <div className="relative w-full aspect-[4/5] bg-[#241830]">
              <img
                src={selectedProfile.photos[0] || selectedProfile.mainPhoto}
                alt={selectedProfile.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#160E1F] via-transparent to-transparent" />
            </div>

            {/* Profile Info */}
            <div className="px-5 -mt-10 relative z-10">
              <h2 className="font-serif text-4xl text-[#F7EFE6] leading-none mb-1">
                {selectedProfile.name}, {selectedProfile.age}
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-3">
                {selectedProfile.job} • {selectedProfile.location.split(',')[0]} • {selectedProfile.languages.join(', ')}
              </p>

              {/* Verified & Trust Badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                <VerifiedPill type="live-selfie" text="Live selfie matched" />
                <Chip
                  label="Here for: dating"
                  variant="lavender"
                  className="!text-xs"
                />
                <Chip
                  label={`Shows up: ${selectedProfile.showsUpRate}`}
                  className="!text-xs"
                />
              </div>

              {/* TAP WHAT YOU LIKE SECTION */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-[#B9A9C4]">
                    Tap what you like
                  </span>
                  <span className="text-[10px] text-[#FFB547]">
                    Tap card to highlight spark
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Voice Answer Card */}
                  {selectedProfile.voiceAnswer && (
                    <div
                      onClick={() => {
                        playTapSound();
                        setSelectedLikeTarget('voice');
                      }}
                      className={`p-3.5 rounded-[20px] border cursor-pointer transition-all ${
                        selectedLikeTarget === 'voice'
                          ? 'border-[#FFB547] bg-[#FFB547]/10 shadow-sm shadow-[#FFB547]/20 ring-1 ring-[#FFB547]'
                          : 'border-[#3A2A48] bg-[#1E1428]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-[#B9A9C4]">Voice</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playTapSound();
                            setIsPlayingAudio(!isPlayingAudio);
                          }}
                          className="w-7 h-7 rounded-full bg-[#FFB547] text-[#160E1F] flex items-center justify-center hover:scale-105"
                        >
                          {isPlayingAudio ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 ml-0.5 fill-[#160E1F]" />
                          )}
                        </button>
                      </div>

                      {/* Mini Waveform */}
                      <div className="flex items-center gap-1 h-6 my-1">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-0.5 rounded-full ${
                              isPlayingAudio ? 'bg-[#FFB547] animate-pulse' : 'bg-[#C9A7FF]'
                            }`}
                            style={{ height: `${8 + ((i * 7) % 18)}px` }}
                          />
                        ))}
                      </div>

                      <p className="text-xs text-[#F7EFE6] line-clamp-2 mt-1">
                        {selectedProfile.voiceAnswer.prompt}
                      </p>
                    </div>
                  )}

                  {/* Prompt Card */}
                  {selectedProfile.promptAnswer && (
                    <div
                      onClick={() => {
                        playTapSound();
                        setSelectedLikeTarget('prompt');
                      }}
                      className={`p-3.5 rounded-[20px] border cursor-pointer transition-all flex flex-col justify-between ${
                        selectedLikeTarget === 'prompt'
                          ? 'border-[#FFB547] bg-[#FFB547]/10 shadow-sm shadow-[#FFB547]/20 ring-1 ring-[#FFB547]'
                          : 'border-[#3A2A48] bg-[#1E1428]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#B9A9C4]">Prompt</span>
                        <div className="w-6 h-6 rounded-full bg-[#FFB547]/20 flex items-center justify-center text-[#FFB547]">
                          <Heart className="w-3.5 h-3.5 fill-[#FFB547]" />
                        </div>
                      </div>

                      <p className="font-serif text-lg leading-tight text-[#F7EFE6]">
                        Old City food walk, then chai.{' '}
                        <span className="italic text-[#FFB547]">Fight me.</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Vouched Card */}
                {selectedProfile.vouchedBy && (
                  <div className="p-3.5 rounded-[20px] border border-[#3A2A48] bg-[#1E1428] flex items-center gap-3">
                    <img
                      src={selectedProfile.vouchedBy.avatar}
                      alt={selectedProfile.vouchedBy.name}
                      className="w-11 h-11 rounded-full object-cover border border-[#9FD7C7]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#9FD7C7] font-semibold uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Vouched by {selectedProfile.vouchedBy.name}</span>
                      </div>
                      <p className="font-serif italic text-sm text-[#F7EFE6] mt-0.5">
                        “{selectedProfile.vouchedBy.quote}”
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Note input */}
              <div className="mb-4">
                <input
                  type="text"
                  maxLength={140}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Which Old City stall is your number one?"
                  className="w-full h-12 px-4 rounded-xl bg-[#1E1428] border border-[#3A2A48] text-xs text-[#F7EFE6] placeholder-[#B9A9C4]/60 focus:border-[#FFB547] focus:outline-none"
                />
                <span className="text-[10px] text-[#B9A9C4] flex justify-end mt-1">
                  {customNote.length}/140
                </span>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Bar: Skip / Send Like */}
          <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 bg-[#160E1F]/95 backdrop-blur-md border-t border-[#3A2A48] flex gap-3 z-20">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 !h-14"
              onClick={() => handleSkipProfile(selectedProfile)}
            >
              Skip
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1 !h-14 flex items-center justify-center gap-2"
              onClick={() => handleSendLike(selectedProfile)}
            >
              <Send className="w-4 h-4 fill-[#160E1F]" />
              <span>Send like</span>
            </Button>
          </div>
        </div>
      )}

      {/* MUTUAL MATCH & CHOOSE A SLOT MODAL (Matching Design 13) */}
      <Sheet
        isOpen={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        title="It’s a match."
        subtitle="You both liked each other. Pick slots to lock in your coffee date."
      >
        <div className="space-y-4">
          {/* Mutual avatars */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300"
                alt="Arjun"
                className="w-16 h-16 rounded-full object-cover border-2 border-[#FFB547]"
              />
              <span className="text-[10px] absolute -bottom-1 left-2 bg-[#1E1428] px-1.5 py-0.2 rounded border border-[#3A2A48]">
                You
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#FFB547] text-[#160E1F] flex items-center justify-center shadow-md shadow-[#FFB547]/20">
              <Heart className="w-5 h-5 fill-[#160E1F]" />
            </div>
            <div className="relative">
              <img
                src={SEED_PROFILES[0].mainPhoto}
                alt="Ananya"
                className="w-16 h-16 rounded-full object-cover border-2 border-[#9FD7C7]"
              />
              <span className="text-[10px] absolute -bottom-1 left-2 bg-[#1E1428] px-1.5 py-0.2 rounded border border-[#3A2A48]">
                Ananya
              </span>
            </div>
          </div>

          {/* Date day options */}
          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
              Select Day
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Saturday, 31 Oct', 'Sunday, 1 Nov'].map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`p-3 rounded-xl text-xs font-semibold border transition-all ${
                    selectedDay === day
                      ? 'border-[#FFB547] bg-[#FFB547]/15 text-[#FFB547]'
                      : 'border-[#3A2A48] bg-[#241830] text-[#B9A9C4]'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slot Picker (Mint dots indicate Ananya's free slots) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#B9A9C4]">
                Available Slots
              </label>
              <span className="text-[10px] text-[#9FD7C7] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#9FD7C7]" /> Ananya is free
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { time: '11:00 AM', free: false },
                { time: '4:30 PM', free: true },
                { time: '6:30 PM', free: true },
              ].map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`p-3 rounded-xl text-xs font-medium border relative transition-all ${
                    selectedSlot === slot.time
                      ? 'border-[#FFB547] bg-[#FFB547]/15 text-[#FFB547] font-bold'
                      : 'border-[#3A2A48] bg-[#241830] text-[#F7EFE6]'
                  }`}
                >
                  {slot.time}
                  {slot.free && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#9FD7C7]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Plan Type */}
          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
              Plan Type
            </label>
            <div className="flex gap-2">
              {['Coffee', 'Old City Walk', 'Dinner'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedPlanType(type)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    selectedPlanType === type
                      ? 'border-[#FFB547] bg-[#FFB547]/20 text-[#FFB547] font-semibold'
                      : 'border-[#3A2A48] bg-[#241830] text-[#B9A9C4]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* ₹99 Deposit Note */}
          <div className="p-3 rounded-xl bg-[#241830] border border-[#3A2A48] text-[11px] text-[#B9A9C4] flex items-center gap-2.5">
            <Coffee className="w-4 h-4 text-[#FFB547] flex-shrink-0" />
            <span>
              Both pay ₹99 to confirm. Deposit is 100% refunded when you check in at Roastery Coffee House.
            </span>
          </div>

          <Button
            size="full"
            onClick={() => {
              playSuccessChime();
              setShowMatchModal(false);
              onNavigateToPlans();
            }}
          >
            Confirm & Pay ₹99 Deposit
          </Button>
        </div>
      </Sheet>

      {/* STREAK MILESTONES MODAL (Design 11: 23-Day Streak) */}
      <Sheet
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        title="23-Day Streak"
        subtitle="Keep showing up every night at 9 PM to earn local Hyderabad perks."
      >
        <div className="space-y-4">
          {/* Streak Flame Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FFB547]/20 to-[#FFA229]/10 border border-[#FFB547]/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 fill-[#FFB547] text-[#FFB547]" />
                <span className="font-serif text-3xl font-bold text-[#FFB547]">23 Days</span>
              </div>
              <p className="text-xs text-[#F7EFE6] mt-0.5">Top 5% of active Hyderabad members</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#B9A9C4]">Streak Freezes</span>
              <p className="text-xs font-bold text-[#9FD7C7] flex items-center gap-1 justify-end">
                <Snowflake className="w-3.5 h-3.5" /> {freezesCount} left this month
              </p>
            </div>
          </div>

          {/* Milestones list */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-[#B9A9C4] uppercase tracking-wider">
              Streak Rewards
            </span>
            {[
              { days: 7, perk: 'Free Cold Brew at Roastery Coffee House', status: 'unlocked' },
              { days: 30, perk: 'Priority 8:30 PM Early Drop Access', status: 'upcoming', left: '7 days left' },
              { days: 90, perk: 'Hyderabad Cult Pearl Necklace / Filter Box Delivered', status: 'locked' },
              { days: 180, perk: 'Exclusive Rooftop Social by Closer', status: 'locked' },
              { days: 365, perk: 'Founding Member Golden Shield Trophy', status: 'locked' },
            ].map((m) => (
              <div
                key={m.days}
                className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  m.status === 'unlocked'
                    ? 'border-[#9FD7C7]/40 bg-[#9FD7C7]/10'
                    : m.status === 'upcoming'
                    ? 'border-[#FFB547]/40 bg-[#FFB547]/10'
                    : 'border-[#3A2A48] bg-[#1E1428] opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                      m.status === 'unlocked'
                        ? 'bg-[#9FD7C7] text-[#160E1F]'
                        : m.status === 'upcoming'
                        ? 'bg-[#FFB547] text-[#160E1F]'
                        : 'bg-[#2A1C38] text-[#B9A9C4]'
                    }`}
                  >
                    {m.days}d
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#F7EFE6]">{m.perk}</p>
                    {m.left && <p className="text-[10px] text-[#FFB547]">{m.left}</p>}
                  </div>
                </div>

                {m.status === 'unlocked' && (
                  <span className="text-[10px] bg-[#9FD7C7]/20 text-[#9FD7C7] px-2 py-0.5 rounded-full font-bold">
                    Claimed
                  </span>
                )}
              </div>
            ))}
          </div>

          <Button
            size="full"
            variant="outline"
            onClick={() => {
              playTapSound();
              setShowStreakModal(false);
            }}
          >
            Close
          </Button>
        </div>
      </Sheet>

      {/* TABLE OF 6 DETAIL MODAL (Design 38) */}
      <Sheet
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        title={SEED_TABLE_OF_SIX.topic}
        subtitle={`${SEED_TABLE_OF_SIX.title} • ${SEED_TABLE_OF_SIX.venue}`}
      >
        <div className="space-y-4">
          <div className="w-full h-40 rounded-2xl overflow-hidden">
            <img
              src={SEED_TABLE_OF_SIX.image}
              alt="Venue"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-[#241830] border border-[#3A2A48] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#B9A9C4]">Venue</span>
              <span className="text-[#F7EFE6] font-medium">{SEED_TABLE_OF_SIX.venue}, {SEED_TABLE_OF_SIX.area}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#B9A9C4]">Date & Time</span>
              <span className="text-[#FFB547] font-medium">{SEED_TABLE_OF_SIX.dateStr} at {SEED_TABLE_OF_SIX.timeStr}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#B9A9C4]">Format</span>
              <span className="text-[#9FD7C7] font-medium">3 men + 3 women group table</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
              Who is already at the table ({SEED_TABLE_OF_SIX.attendees.length} joined)
            </label>
            <div className="flex gap-2">
              {SEED_TABLE_OF_SIX.attendees.map((a, i) => (
                <div key={i} className="flex flex-col items-center">
                  <img
                    src={a.avatar}
                    alt={a.name}
                    className="w-11 h-11 rounded-full object-cover border border-[#3A2A48]"
                  />
                  <span className="text-[10px] text-[#B9A9C4] mt-1">{a.name}</span>
                </div>
              ))}
              <div className="w-11 h-11 rounded-full border-2 border-dashed border-[#FFB547] flex items-center justify-center text-[#FFB547] text-xs font-bold">
                You
              </div>
            </div>
          </div>

          <Button
            size="full"
            onClick={() => {
              playSuccessChime();
              setShowTableModal(false);
              confetti({ particleCount: 50 });
            }}
          >
            Reserve 1 of 2 Seats (₹99)
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
