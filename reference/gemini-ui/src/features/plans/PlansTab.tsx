import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Coffee, 
  CheckCircle2, 
  Shield, 
  PhoneCall, 
  AlertTriangle, 
  Send, 
  ArrowLeft, 
  Plane, 
  Sparkles,
  ExternalLink,
  Lock,
  ChevronRight,
  Star,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Plan } from '../../types';
import { SEED_PLANS } from '../../mocks/seedData';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { Sheet } from '../../ui/Sheet';
import { Toggle } from '../../ui/Toggle';
import { playTapSound, playSuccessChime, playPhoneRingSound, playSosAlertSound } from '../../lib/audio';

interface PlansTabProps {
  onOpenSafety: () => void;
}

export const PlansTab: React.FC<PlansTabProps> = ({ onOpenSafety }) => {
  const [subTab, setSubTab] = useState<'upcoming' | 'chats' | 'past'>('upcoming');
  const [plans, setPlans] = useState<Plan[]>(SEED_PLANS);
  const [activeChatPlan, setActiveChatPlan] = useState<Plan | null>(null);
  const [showAwayModal, setShowAwayModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [incomingRescueCall, setIncomingRescueCall] = useState(false);
  const [rescueCallActive, setRescueCallActive] = useState(false);

  // Away mode state
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayReason, setAwayReason] = useState<'trip' | 'busy' | 'seeing_someone'>('trip');
  const [awayUntilDate, setAwayUntilDate] = useState('Monday, 2 Nov');

  // Active chat state
  const [chatMessage, setChatMessage] = useState('');
  const [isLiveLocationSharing, setIsLiveLocationSharing] = useState(true);

  // SOS button press-and-hold timer state
  const [sosProgress, setSosProgress] = useState(0);
  const [isHoldingSos, setIsHoldingSos] = useState(false);
  const [sosFired, setSosFired] = useState(false);

  // Active plan for Upcoming view
  const currentUpcomingPlan = plans[0];

  // SOS Press & Hold handler (2.0s hold)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isHoldingSos && sosProgress < 100) {
      interval = setInterval(() => {
        setSosProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setSosFired(true);
            playSosAlertSound();
            return 100;
          }
          return p + 5;
        });
      }, 100);
    } else if (!isHoldingSos && sosProgress > 0 && sosProgress < 100) {
      setSosProgress(0);
    }
    return () => clearInterval(interval);
  }, [isHoldingSos, sosProgress]);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !activeChatPlan) return;
    playTapSound();
    const newMsg = {
      id: `m_${Date.now()}`,
      senderId: 'user_arjun',
      text: chatMessage.trim(),
      timestamp: 'Just now',
    };
    setActiveChatPlan({
      ...activeChatPlan,
      messages: [...activeChatPlan.messages, newMsg],
    });
    setChatMessage('');
  };

  const triggerRescueCall = () => {
    playTapSound();
    playPhoneRingSound(5);
    setIncomingRescueCall(true);
  };

  const handleCheckInVenue = () => {
    playSuccessChime();
    confetti({ particleCount: 70 });
    setPlans((prev) =>
      prev.map((p) =>
        p.id === currentUpcomingPlan.id
          ? { ...p, checkInStatus: 'checked_in', depositStatus: 'refunded' }
          : p
      )
    );
  };

  return (
    <div className="pb-24 pt-2">
      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <h1 className="font-serif text-3xl text-[#F7EFE6] leading-none mb-1">
          Plans & <span className="italic text-[#FFB547]">dates</span>
        </h1>
        <p className="text-xs text-[#B9A9C4]">
          Real-world bookings, date safety check-ins, and active chats.
        </p>

        {/* Sub-tabs switcher */}
        <div className="flex bg-[#1E1428] border border-[#3A2A48] rounded-xl p-1 mt-4">
          {(['upcoming', 'chats', 'past'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                playTapSound();
                setSubTab(tab);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all select-none ${
                subTab === tab
                  ? 'bg-[#FFB547] text-[#160E1F] shadow'
                  : 'text-[#B9A9C4] hover:text-[#F7EFE6]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: UPCOMING PLAN & DATE SAFETY */}
      {subTab === 'upcoming' && (
        <div className="px-4 space-y-4 animate-in fade-in duration-200">
          {/* Confirmed Coffee Date Ticket Card (Design 15 / 18 / 20) */}
          <div className="rounded-[24px] bg-[#1E1428] border border-[#3A2A48] p-4 text-[#F7EFE6] space-y-3 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-[#3A2A48]">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-[#FFB547]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#FFB547]">
                  Confirmed Date
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#B9A9C4]">
                Ref: {currentUpcomingPlan.bookingReference}
              </span>
            </div>

            {/* Partner Header */}
            <div className="flex items-center gap-3">
              <img
                src={currentUpcomingPlan.partner.mainPhoto}
                alt={currentUpcomingPlan.partner.name}
                className="w-13 h-13 rounded-2xl object-cover border border-[#9FD7C7]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-2xl text-[#F7EFE6]">
                    {currentUpcomingPlan.partner.name}, {currentUpcomingPlan.partner.age}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#9FD7C7]/20 text-[#9FD7C7] font-semibold border border-[#9FD7C7]/40">
                    Vouched
                  </span>
                </div>
                <p className="text-xs text-[#B9A9C4]">
                  {currentUpcomingPlan.partner.job} • {currentUpcomingPlan.partner.location.split(',')[0]}
                </p>
              </div>

              <button
                onClick={() => setActiveChatPlan(currentUpcomingPlan)}
                className="px-3 py-2 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs font-semibold text-[#FFB547] hover:border-[#FFB547]"
              >
                Chat
              </button>
            </div>

            {/* Venue & Time details */}
            <div className="p-3.5 rounded-2xl bg-[#241830] border border-[#3A2A48]/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#F7EFE6]">
                  <Calendar className="w-4 h-4 text-[#FFB547]" />
                  <span>{currentUpcomingPlan.dateStr}</span>
                </div>
                <span className="font-mono text-[#FFB547] font-semibold">
                  {currentUpcomingPlan.timeStr}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[#B9A9C4]">
                <MapPin className="w-4 h-4 text-[#9FD7C7] flex-shrink-0" />
                <span className="truncate">
                  {currentUpcomingPlan.venueName}, {currentUpcomingPlan.venueArea}
                </span>
              </div>
            </div>

            {/* Deposit Status Pill */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#9FD7C7]/10 border border-[#9FD7C7]/30 text-xs">
              <span className="text-[#9FD7C7] flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                ₹99 Deposit Locked & Table Reserved
              </span>
              <span className="text-[10px] text-[#B9A9C4]">
                100% refunded on arrival
              </span>
            </div>
          </div>

          {/* DATE DAY SAFETY & RESCUE TOOLS (Design 20) */}
          <div className="rounded-[24px] bg-[#1E1428] border border-[#3A2A48] p-4 text-[#F7EFE6] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9FD7C7] flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Date Day Safety Suite
              </span>
              <button
                onClick={onOpenSafety}
                className="text-[11px] text-[#C9A7FF] hover:underline"
              >
                3 Trusted Contacts
              </button>
            </div>

            {/* Venue Geofence Check-in Button */}
            {currentUpcomingPlan.checkInStatus === 'checked_in' ? (
              <div className="p-3.5 rounded-2xl bg-[#9FD7C7]/15 border border-[#9FD7C7] text-center">
                <p className="text-xs font-bold text-[#9FD7C7] flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> Checked in at Roastery Coffee House!
                </p>
                <p className="text-[10px] text-[#B9A9C4] mt-0.5">
                  ₹99 deposit refunded to your UPI account. Trusted contacts informed you arrived safely.
                </p>
              </div>
            ) : (
              <button
                onClick={handleCheckInVenue}
                className="w-full py-3 px-4 rounded-2xl bg-[#9FD7C7]/20 border border-[#9FD7C7] text-[#9FD7C7] font-bold text-xs hover:bg-[#9FD7C7]/30 transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                <span>I’ve Arrived (Venue Geofence 150m Check-in)</span>
              </button>
            )}

            {/* Live Location Sharing & Rescue Phone Call */}
            <div className="pt-1 space-y-2.5">
              <Toggle
                checked={isLiveLocationSharing}
                onChange={setIsLiveLocationSharing}
                label="Live location sharing with trusted contacts"
                description="Sends background link to Karthik & Lakshmi during the date duration."
              />

              {/* Rescue Fake Call Button */}
              <div className="p-3 rounded-2xl bg-[#241830] border border-[#3A2A48] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#F7EFE6]">Rescue Call</p>
                  <p className="text-[10px] text-[#B9A9C4]">Triggers an urgent incoming call in 3 seconds.</p>
                </div>
                <button
                  onClick={triggerRescueCall}
                  className="px-3 py-1.5 rounded-xl bg-[#3A2A48] hover:bg-[#4B365E] text-xs font-medium text-[#F7EFE6] flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#9FD7C7]" />
                  <span>Call me now</span>
                </button>
              </div>

              {/* SOS 2-Second Hold Button */}
              <div className="pt-2">
                <div
                  onMouseDown={() => setIsHoldingSos(true)}
                  onMouseUp={() => setIsHoldingSos(false)}
                  onTouchStart={() => setIsHoldingSos(true)}
                  onTouchEnd={() => setIsHoldingSos(false)}
                  className="w-full h-14 rounded-2xl bg-[#FF6B5E]/20 border border-[#FF6B5E] text-[#FF6B5E] font-bold text-xs flex items-center justify-center relative overflow-hidden select-none cursor-pointer"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#FF6B5E] transition-all duration-75 opacity-40"
                    style={{ width: `${sosProgress}%` }}
                  />
                  <div className="relative z-10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {sosFired
                        ? 'EMERGENCY ALERT SENT & 112 READY'
                        : isHoldingSos
                        ? `HOLD FOR SOS (${Math.round((2 * (100 - sosProgress)) / 100)}s)...`
                        : 'PRESS & HOLD 2s FOR EMERGENCY SOS'}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-center text-[#B9A9C4] mt-1">
                  Instantly dials 112 & transmits GPS link to trusted contacts & Closer Safety desk.
                </p>
              </div>
            </div>
          </div>

          {/* Away Mode & Break Option */}
          <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Plane className="w-4 h-4 text-[#C9A7FF]" />
              <div>
                <p className="text-xs font-medium text-[#F7EFE6]">Taking a break?</p>
                <p className="text-[10px] text-[#B9A9C4]">Pause Drop, freeze streak, and notify matches.</p>
              </div>
            </div>
            <button
              onClick={() => {
                playTapSound();
                setShowAwayModal(true);
              }}
              className="text-xs text-[#FFB547] font-semibold underline"
            >
              Away mode
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CHATS */}
      {subTab === 'chats' && (
        <div className="px-4 space-y-3 animate-in fade-in duration-200">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setActiveChatPlan(plan)}
              className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] hover:border-[#FFB547]/40 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99]"
            >
              <img
                src={plan.partner.mainPhoto}
                alt={plan.partner.name}
                className="w-12 h-12 rounded-2xl object-cover border border-[#3A2A48]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="font-serif text-lg text-[#F7EFE6] leading-none">
                    {plan.partner.name}
                  </h4>
                  <span className="text-[10px] font-mono text-[#B9A9C4]">
                    {plan.messages[plan.messages.length - 1]?.timestamp || '11:22 AM'}
                  </span>
                </div>
                <p className="text-xs text-[#B9A9C4] truncate">
                  {plan.messages[plan.messages.length - 1]?.text || 'Tap to chat'}
                </p>
                {plan.partnerAwayStatus?.isAway && (
                  <span className="text-[9px] text-[#C9A7FF] flex items-center gap-1 mt-1 font-medium">
                    <Plane className="w-3 h-3" /> Away until {plan.partnerAwayStatus.returnDate}
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-[#B9A9C4]" />
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: PAST DATES & DEBRIEF (Design 22) */}
      {subTab === 'past' && (
        <div className="px-4 space-y-3 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#9FD7C7] uppercase tracking-wider">
                Completed Date
              </span>
              <span className="text-xs text-[#B9A9C4]">24 Oct 2026</span>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={SEED_PLANS[1].partner.mainPhoto}
                alt="Meera"
                className="w-12 h-12 rounded-2xl object-cover"
              />
              <div className="flex-1">
                <h4 className="font-serif text-xl text-[#F7EFE6]">
                  Meera, 27 • Autumn Leaf Cafe
                </h4>
                <p className="text-xs text-[#9FD7C7] flex items-center gap-1 mt-0.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ₹99 deposit refunded
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playTapSound();
                setShowDebriefModal(true);
              }}
            >
              View Date Debrief & Feedback
            </Button>
          </div>
        </div>
      )}

      {/* FULL CHAT SCREEN MODAL (Design 15 / 17) */}
      {activeChatPlan && (
        <div className="fixed inset-0 z-50 bg-[#160E1F] flex flex-col max-w-[430px] mx-auto overflow-hidden animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-[#3A2A48] bg-[#1E1428] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveChatPlan(null)}
                className="w-9 h-9 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-[#B9A9C4] hover:text-[#F7EFE6]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={activeChatPlan.partner.mainPhoto}
                alt={activeChatPlan.partner.name}
                className="w-10 h-10 rounded-full object-cover border border-[#9FD7C7]"
              />
              <div>
                <h3 className="font-serif text-lg text-[#F7EFE6] leading-none">
                  {activeChatPlan.partner.name}
                </h3>
                <span className="text-[10px] text-[#9FD7C7]">
                  {activeChatPlan.venueName} • {activeChatPlan.timeStr}
                </span>
              </div>
            </div>

            <button
              onClick={onOpenSafety}
              className="w-9 h-9 rounded-full bg-[#9FD7C7]/15 border border-[#9FD7C7]/40 text-[#9FD7C7] flex items-center justify-center"
            >
              <Shield className="w-4 h-4" />
            </button>
          </div>

          {/* Away Banner (Design 17: Meera away until Monday) */}
          {activeChatPlan.partnerAwayStatus?.isAway && (
            <div className="bg-[#241830] border-b border-[#3A2A48] px-4 py-2 flex items-center gap-2 text-xs text-[#C9A7FF]">
              <Plane className="w-4 h-4 flex-shrink-0" />
              <span>
                {activeChatPlan.partner.name} is away ({activeChatPlan.partnerAwayStatus.reason}) until{' '}
                {activeChatPlan.partnerAwayStatus.returnDate}.
              </span>
            </div>
          )}

          {/* 48-hour auto-close timer banner */}
          <div className="bg-[#1E1428] border-b border-[#3A2A48] px-4 py-1.5 flex items-center justify-between text-[11px] text-[#B9A9C4]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#FFB547]" /> Chat closes 48h after booking
            </span>
            <span className="text-[#FFB547] font-semibold underline cursor-pointer">
              Keep open forever
            </span>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
            {activeChatPlan.messages.map((msg) => {
              const isMe = msg.senderId === 'user_arjun';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-[#FFB547] text-[#160E1F] font-medium rounded-br-none'
                        : 'bg-[#241830] text-[#F7EFE6] border border-[#3A2A48] rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-[#B9A9C4] mt-1 px-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-[#1E1428] border-t border-[#3A2A48] flex items-center gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Message ${activeChatPlan.partner.name}...`}
              className="flex-1 h-11 px-4 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] focus:outline-none focus:border-[#FFB547]"
            />
            <button
              onClick={handleSendMessage}
              className="w-11 h-11 rounded-xl bg-[#FFB547] text-[#160E1F] flex items-center justify-center hover:bg-[#ffa82e] active:scale-95"
            >
              <Send className="w-4 h-4 fill-[#160E1F]" />
            </button>
          </div>
        </div>
      )}

      {/* INCOMING RESCUE CALL SIMULATOR MODAL */}
      {incomingRescueCall && (
        <div className="fixed inset-0 z-50 bg-[#160E1F]/95 backdrop-blur-xl flex flex-col justify-between p-8 max-w-[430px] mx-auto animate-in zoom-in-95">
          <div className="text-center pt-12">
            <span className="text-xs uppercase tracking-widest text-[#9FD7C7] font-semibold">
              Closer Rescue Assistant
            </span>
            <h2 className="font-serif text-4xl text-[#F7EFE6] mt-2 mb-1">
              Urgent Work Alert
            </h2>
            <p className="text-xs text-[#B9A9C4]">+91 40 6822 0000 · Hyderabad</p>

            <div className="w-28 h-28 rounded-full border-4 border-[#9FD7C7] mx-auto my-12 flex items-center justify-center bg-[#241830] animate-pulse">
              <PhoneCall className="w-12 h-12 text-[#9FD7C7]" />
            </div>
            <p className="text-xs text-[#F7EFE6]">
              {rescueCallActive
                ? '“Arjun, your deployment server at Gachibowli requires emergency signoff...”'
                : 'Slide or tap to accept call for a polite exit.'}
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={() => {
                playTapSound();
                setIncomingRescueCall(false);
                setRescueCallActive(false);
              }}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1 !bg-[#9FD7C7] !text-[#160E1F]"
              onClick={() => {
                playTapSound();
                setRescueCallActive(true);
              }}
            >
              Accept Call
            </Button>
          </div>
        </div>
      )}

      {/* AWAY MODE MODAL (Design 19) */}
      <Sheet
        isOpen={showAwayModal}
        onClose={() => setShowAwayModal(false)}
        title="Taking a Break: Away Mode"
        subtitle="Pause your 9 PM Drop and protect your 23-day streak."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#241830] border border-[#3A2A48]">
            <Toggle
              checked={awayEnabled}
              onChange={setAwayEnabled}
              label="Enable Away Mode"
              description="Hides you from Tonight's Drop and freezes your streak automatically."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
              Reason (Shown as a subtle status badge to matches)
            </label>
            <div className="space-y-2">
              {[
                { id: 'trip', title: 'Out of Hyderabad on a trip' },
                { id: 'busy', title: 'Crazy busy work week' },
                { id: 'seeing_someone', title: 'Seeing someone exclusively' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setAwayReason(item.id as typeof awayReason)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer ${
                    awayReason === item.id
                      ? 'border-[#FFB547] bg-[#FFB547]/10 text-[#FFB547] font-semibold'
                      : 'border-[#3A2A48] bg-[#1E1428] text-[#F7EFE6]'
                  }`}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
              Away Until Date
            </label>
            <input
              type="text"
              value={awayUntilDate}
              onChange={(e) => setAwayUntilDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6]"
            />
          </div>

          <Button
            size="full"
            onClick={() => {
              playSuccessChime();
              setShowAwayModal(false);
            }}
          >
            Save Away Status
          </Button>
        </div>
      </Sheet>

      {/* DEBRIEF MODAL (Design 22) */}
      <Sheet
        isOpen={showDebriefModal}
        onClose={() => setShowDebriefModal(false)}
        title="Saturday Debrief & Refund"
        subtitle="Private feedback for Meera at Autumn Leaf Cafe"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#9FD7C7]/15 border border-[#9FD7C7]/40 flex items-center justify-between text-xs text-[#9FD7C7]">
            <span className="font-semibold">Deposit Refunded</span>
            <span className="font-mono">₹99.00 to HDFC UPI</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                Did Meera match her photos and profile?
              </label>
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-xl bg-[#241830] border border-[#9FD7C7] text-xs text-[#9FD7C7] font-bold">
                  100% Yes
                </button>
                <button className="flex-1 py-2 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#B9A9C4]">
                  Somewhat
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                Overall comfort & safety
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-6 h-6 fill-[#FFB547] text-[#FFB547]" />
                ))}
              </div>
            </div>
          </div>

          <Button
            size="full"
            onClick={() => {
              playTapSound();
              setShowDebriefModal(false);
            }}
          >
            Done
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
