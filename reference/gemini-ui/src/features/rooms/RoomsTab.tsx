import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Users, 
  Hand, 
  LogOut, 
  Sparkles, 
  Coffee, 
  Clock, 
  ShieldCheck, 
  Gift, 
  Plus, 
  X, 
  Heart, 
  ArrowLeft,
  Volume2,
  Check,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Room } from '../../types';
import { SEED_ROOMS } from '../../mocks/seedData';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { playTapSound, playSuccessChime } from '../../lib/audio';

interface RoomsTabProps {
  onOpenSafety: () => void;
}

export const RoomsTab: React.FC<RoomsTabProps> = ({ onOpenSafety }) => {
  const [rooms, setRooms] = useState<Room[]>(SEED_ROOMS);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);

  // Live room speaker states
  const [isMuted, setIsMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [displayMode, setDisplayMode] = useState<'photo' | 'initials'>('photo');

  // Chai Break 1-on-1 state
  const [chaiBreakState, setChaiBreakState] = useState<'idle' | 'searching' | 'active' | 'reveal' | 'connected'>('idle');
  const [chaiTimer, setChaiTimer] = useState(300); // 5 minutes (300s)
  const [myRevealTapped, setMyRevealTapped] = useState(false);
  const [partnerRevealTapped, setPartnerRevealTapped] = useState(false);

  // New room modal inputs
  const [newTitle, setNewTitle] = useState('');
  const [newLanguage, setNewLanguage] = useState('Telugu');
  const [newCategory, setNewCategory] = useState<'cricket' | 'movies' | 'food' | 'late-night'>('cricket');

  // Coins balance for gifts
  const [coins, setCoins] = useState(240);

  // Chai Break Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (chaiBreakState === 'active' && chaiTimer > 0) {
      interval = setInterval(() => {
        setChaiTimer((t) => {
          if (t <= 1) {
            setChaiBreakState('reveal');
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [chaiBreakState, chaiTimer]);

  const handleStartChaiBreak = () => {
    playTapSound();
    setChaiBreakState('searching');
    setTimeout(() => {
      setChaiBreakState('active');
      setChaiTimer(300);
      playSuccessChime();
    }, 2000);
  };

  const handleRevealTap = () => {
    playTapSound();
    setMyRevealTapped(true);
    setTimeout(() => {
      setPartnerRevealTapped(true);
      setChaiBreakState('connected');
      playSuccessChime();
      confetti({ particleCount: 80, colors: ['#FFB547', '#9FD7C7'] });
    }, 1200);
  };

  const handleSendGift = (giftName: string, cost: number) => {
    if (coins < cost) return;
    playSuccessChime();
    setCoins((c) => c - cost);
    setShowGiftModal(false);
    confetti({ particleCount: 40 });
  };

  const handleCreateRoom = () => {
    if (!newTitle.trim()) return;
    playSuccessChime();
    const created: Room = {
      id: `room_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      isLive: true,
      speakersCount: 1,
      listenersCount: 12,
      speakers: [
        { name: 'Arjun (You)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300', isMuted: false, isHost: true },
      ],
      image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600',
      aiModerationOn: true,
      language: newLanguage,
    };
    setRooms([created, ...rooms]);
    setActiveRoom(created);
    setShowCreateModal(false);
    setNewTitle('');
  };

  return (
    <div className="pb-24 pt-2">
      {/* Rooms Header */}
      <div className="px-4 pt-2 pb-3">
        <h1 className="font-serif text-4xl text-[#F7EFE6] leading-none mb-1">
          Rooms <span className="italic text-[#FFB547]">live now.</span>
        </h1>
        <p className="text-xs text-[#B9A9C4]">
          Real conversations. New people. A more fun Hyderabad.
        </p>
      </div>

      {/* CHAI BREAK 5-MINUTE CARD (Design 25 / 26) */}
      <div className="px-4 mb-5">
        <div className="rounded-[24px] bg-gradient-to-r from-[#FFB547] via-[#FFA82E] to-[#FF931F] p-4 text-[#160E1F] shadow-lg shadow-[#FFB547]/15 flex items-center justify-between">
          <div className="flex-1 pr-3">
            <h3 className="font-serif text-3xl font-bold leading-none mb-1">
              Chai Break
            </h3>
            <p className="text-xs text-[#160E1F]/90 font-medium leading-tight">
              Talk to someone new for 5 minutes. Anonymous, 1-on-1 audio.
            </p>
            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold uppercase tracking-wider text-[#160E1F]/70">
              <span>Matched by Telugu / English</span>
              <span>•</span>
              <span>Mutual Reveal</span>
            </div>
          </div>

          <button
            onClick={handleStartChaiBreak}
            className="px-5 py-2.5 rounded-full bg-[#160E1F] text-[#FFB547] text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0"
          >
            Start
          </button>
        </div>
      </div>

      {/* LIVE NOW LIST */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-serif text-[#F7EFE6]">Live now</h2>
          <span className="text-[11px] text-[#B9A9C4] cursor-pointer hover:text-[#FFB547]">
            See all
          </span>
        </div>

        <div className="space-y-3">
          {rooms.filter((r) => r.isLive).map((room) => (
            <div
              key={room.id}
              onClick={() => {
                playTapSound();
                setActiveRoom(room);
              }}
              className="p-3 rounded-2xl bg-[#1E1428] border border-[#3A2A48] hover:border-[#FFB547]/40 flex items-center gap-3.5 cursor-pointer transition-all active:scale-[0.99] group"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#241830] border border-[#3A2A48]">
                <img
                  src={room.image}
                  alt={room.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-serif text-lg text-[#F7EFE6] leading-tight truncate">
                    {room.title}
                  </h3>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#FF6B5E] uppercase tracking-wider bg-[#FF6B5E]/15 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B5E] animate-pulse" />
                    LIVE
                  </span>
                </div>

                {/* Speaker avatars row */}
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="flex -space-x-1.5">
                    {room.speakers.map((sp, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-5 rounded-full border border-[#1E1428] bg-[#2E1E3D] text-[9px] text-[#C9A7FF] font-bold flex items-center justify-center overflow-hidden"
                      >
                        {sp.avatar ? (
                          <img src={sp.avatar} alt={sp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{sp.name.slice(0, 2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#B9A9C4]">
                    {room.speakersCount} speakers
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-[#B9A9C4]">
                  <span>{room.language}</span>
                  <span>•</span>
                  <span>{room.listenersCount} listening</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TONIGHT SCHEDULED SECTION */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-serif text-[#F7EFE6]">Tonight</h2>
          <span className="text-[11px] text-[#B9A9C4]">See all</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-2">
            <span className="text-[10px] font-bold text-[#FFB547] uppercase tracking-wider">
              9:30 PM IST
            </span>
            <h4 className="font-serif text-lg text-[#F7EFE6] leading-tight">
              Housie at 9:30 PM
            </h4>
            <p className="text-[11px] text-[#B9A9C4]">
              A fun, friendly room with prizes.
            </p>
            <span className="text-[10px] text-[#9FD7C7] block">
              300 joined
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-2">
            <span className="text-[10px] font-bold text-[#C9A7FF] uppercase tracking-wider">
              10:00 PM IST
            </span>
            <h4 className="font-serif text-lg text-[#F7EFE6] leading-tight">
              Breakups & moving on
            </h4>
            <p className="text-[11px] text-[#B9A9C4]">
              Real stories, kinder perspectives.
            </p>
            <span className="text-[10px] text-[#9FD7C7] block">
              56 joined
            </span>
          </div>
        </div>
      </div>

      {/* CREATE ROOM FLOATING BUTTON */}
      <div className="px-4">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            playTapSound();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Create room</span>
        </Button>
      </div>

      {/* LIVE ROOM VIEW MODAL (Design 30) */}
      {activeRoom && (
        <div className="fixed inset-0 z-50 bg-[#160E1F] flex flex-col max-w-[430px] mx-auto overflow-hidden animate-in slide-in-from-bottom duration-250">
          {/* Top Bar */}
          <div className="p-4 border-b border-[#3A2A48] bg-[#1E1428] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveRoom(null)}
                className="w-9 h-9 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-[#B9A9C4]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-serif text-lg text-[#F7EFE6] leading-none">
                  {activeRoom.title}
                </h3>
                <span className="text-[10px] text-[#B9A9C4]">
                  {activeRoom.language} • {activeRoom.listenersCount + 1} people
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDisplayMode(displayMode === 'photo' ? 'initials' : 'photo')}
                title="Toggle Photo / Initials Display Mode"
                className="px-2.5 py-1 rounded-full bg-[#241830] border border-[#3A2A48] text-[10px] text-[#C9A7FF]"
              >
                {displayMode === 'photo' ? 'Photos' : 'Initials'}
              </button>
              <button
                onClick={() => setActiveRoom(null)}
                className="px-3 py-1 rounded-full bg-[#FF6B5E]/20 text-[#FF6B5E] text-xs font-semibold hover:bg-[#FF6B5E]/30"
              >
                Leave
              </button>
            </div>
          </div>

          {/* AI Moderation Pill (Spec requirement §5) */}
          <div className="bg-[#1E1428] border-b border-[#3A2A48] px-4 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-[#9FD7C7] flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> AI moderation active in this room
            </span>
            <span className="text-[10px] text-[#B9A9C4]">Coins: {coins}</span>
          </div>

          {/* Speaker Stage (max 8) */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#B9A9C4] block mb-3">
                Stage Speakers ({activeRoom.speakers.length})
              </span>
              <div className="grid grid-cols-3 gap-4">
                {activeRoom.speakers.map((sp, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FFB547] bg-[#241830] flex items-center justify-center shadow-lg">
                        {displayMode === 'photo' && sp.avatar ? (
                          <img src={sp.avatar} alt={sp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base font-bold text-[#C9A7FF]">
                            {sp.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {sp.isMuted ? (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-[#FF6B5E]">
                          <MicOff className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#9FD7C7] text-[#160E1F] flex items-center justify-center">
                          <Mic className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[#F7EFE6] mt-1.5 truncate max-w-[80px]">
                      {sp.name}
                    </span>
                    {sp.isHost && (
                      <span className="text-[9px] text-[#FFB547] font-bold">Host</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Listeners Grid */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#B9A9C4] block mb-3">
                Listeners in Hyderabad
              </span>
              <div className="grid grid-cols-4 gap-3">
                {['Karthik', 'Swathi', 'Varun', 'Sneha', 'Abhi', 'Harini', 'Rohan', 'Tanvi'].map((l, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-xs font-bold text-[#B9A9C4]">
                      {displayMode === 'initials' ? l.slice(0, 2) : l.slice(0, 1)}
                    </div>
                    <span className="text-[10px] text-[#B9A9C4] mt-1 truncate max-w-[65px]">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Bottom Control Bar */}
          <div className="p-4 bg-[#1E1428] border-t border-[#3A2A48] flex items-center justify-between gap-3">
            <button
              onClick={() => {
                playTapSound();
                setIsMuted(!isMuted);
              }}
              className={`flex-1 h-12 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                isMuted
                  ? 'bg-[#2E1E3D] border border-[#3A2A48] text-[#FF6B5E]'
                  : 'bg-[#FFB547] text-[#160E1F]'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Muted' : 'Speaking'}</span>
            </button>

            <button
              onClick={() => {
                playTapSound();
                setHandRaised(!handRaised);
              }}
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                handRaised
                  ? 'border-[#9FD7C7] bg-[#9FD7C7]/20 text-[#9FD7C7]'
                  : 'border-[#3A2A48] bg-[#241830] text-[#B9A9C4]'
              }`}
            >
              <Hand className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                playTapSound();
                setShowGiftModal(true);
              }}
              className="w-12 h-12 rounded-2xl border border-[#FFB547]/50 bg-[#FFB547]/15 text-[#FFB547] flex items-center justify-center"
            >
              <Gift className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* CHAI BREAK 1-ON-1 INTERACTIVE MODAL (Design 26 / 27 / 28) */}
      {chaiBreakState !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-[#160E1F] flex flex-col justify-between p-6 max-w-[430px] mx-auto animate-in zoom-in-95">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <span className="font-serif italic text-2xl text-[#FFB547]">Chai Break</span>
            <button
              onClick={() => {
                playTapSound();
                setChaiBreakState('idle');
              }}
              className="p-2 rounded-full bg-[#241830] text-[#B9A9C4]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Searching screen */}
          {chaiBreakState === 'searching' && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full border-2 border-[#FFB547] border-t-transparent animate-spin mx-auto mb-6" />
              <h3 className="font-serif text-3xl text-[#F7EFE6] mb-1">
                Finding someone <span className="italic text-[#FFB547]">near you</span>
              </h3>
              <p className="text-xs text-[#B9A9C4]">
                Matching by intent + Telugu / English in Hyderabad...
              </p>
            </div>
          )}

          {/* Active 5-minute Call */}
          {chaiBreakState === 'active' && (
            <div className="space-y-6 text-center">
              <div>
                <span className="text-[11px] font-mono text-[#FFB547] uppercase tracking-wider">
                  Anonymous 1-on-1 Audio
                </span>
                <div className="font-serif text-6xl text-[#F7EFE6] my-2 font-bold font-mono">
                  {Math.floor(chaiTimer / 60)}:{String(chaiTimer % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-[#B9A9C4]">Both anonymous until you both tap Reveal</p>
              </div>

              {/* Waveform */}
              <div className="h-14 flex items-center justify-center gap-1.5 px-4 bg-[#1E1428] rounded-2xl border border-[#3A2A48]">
                {Array.from({ length: 28 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-1 bg-[#FFB547] rounded-full animate-wave-bar"
                    style={{ animationDelay: `${(idx * 0.05).toFixed(2)}s` }}
                  />
                ))}
              </div>

              {/* Topic Cards (Design 28) */}
              <div className="p-4 rounded-2xl bg-[#241830] border border-[#3A2A48] text-left space-y-1.5">
                <span className="text-[10px] text-[#FFB547] font-bold uppercase tracking-wider">
                  Icebreaker Topic Card
                </span>
                <h4 className="font-serif text-xl text-[#F7EFE6]">
                  Best Hyderabad Street Food: Ram Ki Bandi vs Pragathi Tiffins?
                </h4>
                <p className="text-[11px] text-[#B9A9C4]">
                  Debate your butter dosa spots and late-night drives.
                </p>
              </div>
            </div>
          )}

          {/* Reveal Decision Screen (Design 27) */}
          {chaiBreakState === 'reveal' && (
            <div className="text-center space-y-4">
              <h3 className="font-serif text-3xl text-[#F7EFE6]">
                Time’s up, <span className="italic text-[#FFB547]">reveal?</span>
              </h3>
              <p className="text-xs text-[#B9A9C4]">
                If both tap Reveal, your profiles are shared and you can plan a coffee date.
              </p>

              <div className="flex justify-center gap-4 py-4">
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto mb-1 ${
                    myRevealTapped ? 'border-[#9FD7C7] bg-[#9FD7C7]/20 text-[#9FD7C7]' : 'border-[#3A2A48]'
                  }`}>
                    {myRevealTapped ? <Check className="w-6 h-6 stroke-[3]" /> : 'You'}
                  </div>
                  <span className="text-xs text-[#B9A9C4]">
                    {myRevealTapped ? 'Revealed' : 'Tap below'}
                  </span>
                </div>

                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto mb-1 ${
                    partnerRevealTapped ? 'border-[#9FD7C7] bg-[#9FD7C7]/20 text-[#9FD7C7]' : 'border-[#3A2A48]'
                  }`}>
                    {partnerRevealTapped ? <Check className="w-6 h-6 stroke-[3]" /> : '?'}
                  </div>
                  <span className="text-xs text-[#B9A9C4]">
                    {partnerRevealTapped ? 'Revealed' : 'Waiting...'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setChaiBreakState('idle')}
                  className="flex-1"
                >
                  End Politely
                </Button>
                <Button
                  onClick={handleRevealTap}
                  className="flex-1"
                >
                  Reveal Profile
                </Button>
              </div>
            </div>
          )}

          {/* Connected Spark Screen */}
          {chaiBreakState === 'connected' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 rounded-full bg-[#9FD7C7]/20 border border-[#9FD7C7] flex items-center justify-center text-[#9FD7C7] mx-auto">
                <UserCheck className="w-10 h-10" />
              </div>
              <h3 className="font-serif text-3xl text-[#F7EFE6]">
                You both <span className="italic text-[#9FD7C7]">revealed!</span>
              </h3>
              <p className="text-xs text-[#B9A9C4]">
                You were talking with <strong>Sneha, 27</strong> (Architect, Kondapur). Added to your Plans tab to book a coffee date.
              </p>
              <Button
                size="full"
                onClick={() => setChaiBreakState('idle')}
              >
                Go to Plans
              </Button>
            </div>
          )}

          {/* Bottom Action for active call */}
          {chaiBreakState === 'active' && (
            <Button
              variant="outline"
              onClick={() => setChaiBreakState('reveal')}
              size="full"
            >
              Skip to Reveal
            </Button>
          )}
        </div>
      )}

      {/* SEND GIFT SHEET (Design 31) */}
      <Sheet
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        title="Send a Gift to the Host"
        subtitle={`Your Balance: ${coins} Closer Coins`}
      >
        <div className="space-y-3">
          {[
            { name: 'Irani Chai', price: 20, icon: '☕' },
            { name: 'Osmania Biscuit', price: 10, icon: '🍪' },
            { name: 'Charminar Memento', price: 50, icon: '🏛️' },
            { name: 'Hyderabad Pearl', price: 100, icon: '🦪' },
          ].map((gift) => (
            <div
              key={gift.name}
              onClick={() => handleSendGift(gift.name, gift.price)}
              className="p-3 rounded-2xl bg-[#241830] border border-[#3A2A48] hover:border-[#FFB547] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{gift.icon}</span>
                <div>
                  <h4 className="font-medium text-xs text-[#F7EFE6]">{gift.name}</h4>
                  <p className="text-[10px] text-[#FFB547] font-mono">{gift.price} coins</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="!h-8 !px-3 text-xs">
                Send
              </Button>
            </div>
          ))}
        </div>
      </Sheet>

      {/* CREATE ROOM SHEET (Design 24) */}
      <Sheet
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create a Hyderabad Room"
        subtitle="Host a live voice room. Adults only, AI moderated."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
              Room Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. SRH match predictions & biryani debate"
              className="w-full h-12 px-4 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] focus:outline-none focus:border-[#FFB547]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cricket', label: 'Cricket & Sports' },
                { id: 'movies', label: 'Telugu Movies' },
                { id: 'food', label: 'Food & Cafés' },
                { id: 'late-night', label: 'Late Night Chai' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewCategory(c.id as typeof newCategory)}
                  className={`p-2.5 rounded-xl text-xs border text-left ${
                    newCategory === c.id
                      ? 'border-[#FFB547] bg-[#FFB547]/10 text-[#FFB547] font-semibold'
                      : 'border-[#3A2A48] bg-[#1E1428] text-[#B9A9C4]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            size="full"
            onClick={handleCreateRoom}
            disabled={!newTitle.trim()}
          >
            Go Live Now
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
