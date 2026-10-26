import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Calendar, 
  ArrowLeft, 
  Camera, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Lock, 
  Search, 
  Bell, 
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  Phone
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { Toggle } from '../../ui/Toggle';
import { ProgressBar } from '../../ui/ProgressBar';
import { playTapSound, playSuccessChime } from '../../lib/audio';

interface OnboardingWizardProps {
  onComplete: () => void;
  onClose?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onClose }) => {
  // Steps:
  // 1: Welcome
  // 2: Phone OTP
  // 3: Basics (About you & 18+ check)
  // 4: Connection Style
  // 5: Live Selfie (5s capture)
  // 6: Real Photos
  // 7: Voice Answers (3 prompts, waveform, re-record)
  // 8: Preferences (Areas, Languages, Age)
  // 9: Contact Privacy (Default "Hide me from all contacts" ON + Allowlist)
  // 10: First Drop Countdown & Notifications
  const [step, setStep] = useState<number>(1);

  // Form states
  const [phoneNumber, setPhoneNumber] = useState('98480 22334');
  const [otpCode, setOtpCode] = useState(['9', '2', '4', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);

  const [name, setName] = useState('Arjun');
  const [dob, setDob] = useState('1998-05-14');
  const [gender, setGender] = useState<'man' | 'woman' | 'non-binary'>('man');
  const [showMe, setShowMe] = useState<'women' | 'men' | 'everyone'>('women');

  const [intent, setIntent] = useState<'dating' | 'friends' | 'both'>('dating');

  // Selfie liveness simulation
  const [selfieStatus, setSelfieStatus] = useState<'idle' | 'capturing' | 'verifying' | 'verified'>('idle');
  const [selfieCountdown, setSelfieCountdown] = useState(5);

  // Photos
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80',
  ]);

  // Voice answers
  const [recordingPromptIndex, setRecordingPromptIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVoice, setRecordedVoice] = useState<Record<number, boolean>>({ 0: true });
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Preferences
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Gachibowli', 'Kondapur', 'Jubilee Hills']);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['Telugu', 'English', 'Hindi']);
  const [minAge, setMinAge] = useState(24);
  const [maxAge, setMaxAge] = useState(32);

  // Contact privacy
  const [hideFromAllContacts, setHideFromAllContacts] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [allowlist, setAllowlist] = useState<string[]>(['Rahul Sharma', 'Sneha Reddy']);

  const sampleContacts = [
    { name: 'Rahul Sharma', phone: '+91 98481 12345' },
    { name: 'Sneha Reddy', phone: '+91 94402 56789' },
    { name: 'Aditya Varma', phone: '+91 98490 99887' },
    { name: 'Pooja Hegde', phone: '+91 97003 44556' },
    { name: 'Karthik Rao', phone: '+91 91234 56780' },
  ];

  // Helper for selfie capture countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selfieStatus === 'capturing' && selfieCountdown > 0) {
      timer = setTimeout(() => setSelfieCountdown((c) => c - 1), 1000);
    } else if (selfieStatus === 'capturing' && selfieCountdown === 0) {
      setSelfieStatus('verifying');
      setTimeout(() => {
        setSelfieStatus('verified');
        playSuccessChime();
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [selfieStatus, selfieCountdown]);

  const handleNext = () => {
    playTapSound();
    if (step < 10) {
      setStep(step + 1);
    } else {
      playSuccessChime();
      onComplete();
    }
  };

  const handlePrev = () => {
    playTapSound();
    if (step > 1) {
      setStep(step - 1);
    } else if (onClose) {
      onClose();
    }
  };

  const startSelfieScan = () => {
    setSelfieCountdown(5);
    setSelfieStatus('capturing');
  };

  // 18+ calculation
  const calculateAge = (birthdate: string) => {
    const today = new Date();
    const dobDate = new Date(birthdate);
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    return age;
  };

  const currentAge = calculateAge(dob);
  const isAdult = currentAge >= 18;

  return (
    <div className="fixed inset-0 z-50 bg-[#160E1F] text-[#F7EFE6] flex flex-col max-w-[430px] mx-auto overflow-hidden">
      {/* Header with back button & progress */}
      {step > 1 && (
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[#3A2A48]/50">
          <button
            onClick={handlePrev}
            className="w-10 h-10 rounded-full bg-[#1E1428] border border-[#3A2A48] flex items-center justify-center text-[#B9A9C4] hover:text-[#F7EFE6]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 max-w-[160px] mx-4">
            <ProgressBar progress={(step / 10) * 100} />
          </div>
          <span className="text-xs font-mono text-[#B9A9C4]">
            {step} / 10
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 flex flex-col justify-between">
        {/* STEP 1: WELCOME SCREEN (Design 1) */}
        {step === 1 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-serif italic text-3xl text-[#F7EFE6]">closer</span>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E1428] border border-[#3A2A48] text-xs text-[#B9A9C4]">
                  <MapPin className="w-3.5 h-3.5 text-[#FFB547]" />
                  <span>Hyderabad · 18+</span>
                </div>
              </div>

              {/* 9 PM Circle Emblem */}
              <div className="my-6 flex justify-center">
                <div className="relative w-44 h-44 rounded-full border border-[#FFB547]/60 bg-gradient-to-b from-[#241830] to-[#160E1F] flex flex-col items-center justify-center p-4 text-center shadow-lg shadow-[#FFB547]/10">
                  <span className="text-[10px] tracking-widest text-[#B9A9C4] uppercase font-semibold">
                    Every Night
                  </span>
                  <span className="font-serif text-5xl text-[#F7EFE6] my-0.5 font-normal">
                    9 pm
                  </span>
                  <div className="w-8 h-0.5 bg-[#FFB547] my-1" />
                  <span className="font-serif italic text-[#FFB547] text-lg">
                    The Drop
                  </span>
                </div>
              </div>

              {/* Headline */}
              <h1 className="font-serif text-5xl leading-[1.08] text-[#F7EFE6] mb-3">
                Plans, <br />
                <span className="italic text-[#FFB547]">not swipes.</span>
              </h1>
              <p className="text-sm text-[#B9A9C4] leading-relaxed mb-6">
                Three people every night at 9. Like each other, and we book the table.
              </p>

              {/* Trust Badges */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                  <div className="w-9 h-9 rounded-xl bg-[#9FD7C7]/15 border border-[#9FD7C7]/30 flex items-center justify-center text-[#9FD7C7]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-[#F7EFE6]">
                    Everyone is live-selfie checked
                  </span>
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                  <div className="w-9 h-9 rounded-xl bg-[#FFB547]/15 border border-[#FFB547]/30 flex items-center justify-center text-[#FFB547]">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-[#F7EFE6]">
                    A ₹99 deposit means people actually show up
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button onClick={handleNext} size="full">
                Get started
              </Button>
              <p className="text-center text-[11px] text-[#B9A9C4]">
                By continuing you agree to the <span className="underline cursor-pointer">Community Rules</span> and <span className="underline cursor-pointer">Privacy Notice</span>.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: PHONE OTP (Design 2) */}
        {step === 2 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                Instant Verification
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                What’s your <span className="italic text-[#FFB547]">number?</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-6">
                We send a 6-digit code. We never spam or show your phone number to other users.
              </p>

              {/* Phone input */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] mb-6">
                <span className="text-sm font-semibold text-[#FFB547] border-r border-[#3A2A48] pr-3">
                  +91 (India)
                </span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="98480 22334"
                  className="bg-transparent flex-1 text-sm text-[#F7EFE6] focus:outline-none tracking-wider font-mono"
                />
              </div>

              {/* OTP code boxes */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs text-[#B9A9C4]">
                  <span>Enter 6-digit code</span>
                  <button
                    onClick={() => {
                      setOtpCode(['9', '2', '4', '8', '2', '1']);
                      setOtpVerified(true);
                      playSuccessChime();
                    }}
                    className="text-[#FFB547] text-xs font-semibold hover:underline"
                  >
                    Auto-fill demo (924821)
                  </button>
                </div>

                <div className="flex gap-2 justify-between">
                  {otpCode.map((val, idx) => (
                    <div
                      key={idx}
                      className={`w-12 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold border transition-colors ${
                        val
                          ? 'border-[#FFB547] bg-[#FFB547]/10 text-[#FFB547]'
                          : 'border-[#3A2A48] bg-[#1E1428] text-[#F7EFE6]'
                      }`}
                    >
                      {val || '•'}
                    </div>
                  ))}
                </div>

                {otpVerified && (
                  <p className="text-xs text-[#9FD7C7] flex items-center gap-1.5 mt-2">
                    <Check className="w-4 h-4" /> Code verified! Phone secured with Supabase Auth OTP.
                  </p>
                )}
              </div>
            </div>

            <Button onClick={handleNext} disabled={!phoneNumber} size="full">
              Continue
            </Button>
          </div>
        )}

        {/* STEP 3: BASICS (About You & 18+ Check) */}
        {step === 3 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                Step 1 of 8
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                About <span className="italic text-[#FFB547]">you</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-6">
                Closer is strictly for adults (18+) living in or visiting Hyderabad.
              </p>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                    First Name (shown on profile)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-13 px-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] text-sm text-[#F7EFE6] focus:border-[#FFB547] focus:outline-none"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full h-13 px-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] text-sm text-[#F7EFE6] focus:border-[#FFB547] focus:outline-none"
                  />
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-[#B9A9C4]">Age: {currentAge} years</span>
                    {isAdult ? (
                      <span className="text-[#9FD7C7] flex items-center gap-1 font-medium">
                        <Check className="w-3.5 h-3.5" /> 18+ Verified
                      </span>
                    ) : (
                      <span className="text-[#FF6B5E] font-medium">Must be 18 or older</span>
                    )}
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                    I identify as
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['man', 'woman', 'non-binary'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`h-12 rounded-xl text-xs font-medium border transition-colors capitalize ${
                          gender === g
                            ? 'border-[#FFB547] bg-[#FFB547]/15 text-[#FFB547]'
                            : 'border-[#3A2A48] bg-[#1E1428] text-[#B9A9C4]'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show me */}
                <div>
                  <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                    Show me in Tonight’s Drop
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['women', 'men', 'everyone'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setShowMe(s)}
                        className={`h-12 rounded-xl text-xs font-medium border transition-colors capitalize ${
                          showMe === s
                            ? 'border-[#FFB547] bg-[#FFB547]/15 text-[#FFB547]'
                            : 'border-[#3A2A48] bg-[#1E1428] text-[#B9A9C4]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleNext} disabled={!name || !isAdult} size="full">
              Continue
            </Button>
          </div>
        )}

        {/* STEP 4: INTENT (Design 5) */}
        {step === 4 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                Closer Intent
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                Choose your <span className="italic text-[#FFB547]">connection style</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-6">
                Be honest about what you are seeking. We match you only with compatible intentions.
              </p>

              <div className="space-y-3.5">
                {[
                  {
                    id: 'dating' as const,
                    title: 'Here for dating',
                    desc: 'Thoughtful 1-on-1 dates, coffee, dinner, and seeing where it goes.',
                    badge: '9 PM Drop + Dates',
                  },
                  {
                    id: 'friends' as const,
                    title: 'Making close friends',
                    desc: 'Table of 6 group hangouts, voice rooms, badminton, and food walks.',
                    badge: 'Tables of 6 + Rooms',
                  },
                  {
                    id: 'both' as const,
                    title: 'Open to both',
                    desc: 'Dating when there is a spark, friendship and group events anytime.',
                    badge: 'Full Access',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      playTapSound();
                      setIntent(item.id);
                    }}
                    className={`p-4 rounded-[22px] border cursor-pointer transition-all ${
                      intent === item.id
                        ? 'border-[#FFB547] bg-[#FFB547]/10 shadow-md shadow-[#FFB547]/10'
                        : 'border-[#3A2A48] bg-[#1E1428] hover:border-[#3A2A48]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-serif text-xl text-[#F7EFE6]">{item.title}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3A2A48] text-[#C9A7FF] font-medium">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[#B9A9C4]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleNext} size="full">
              Continue
            </Button>
          </div>
        )}

        {/* STEP 5: LIVE SELFIE (Design 7) */}
        {step === 5 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#9FD7C7] font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Live Verification
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                Live <span className="italic text-[#9FD7C7]">selfie check</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-4">
                We check that you are real. This selfie is never posted on your profile.
              </p>

              {/* Viewfinder oval */}
              <div className="relative w-64 h-72 mx-auto my-3 rounded-[36px] border-2 border-dashed border-[#9FD7C7]/60 bg-[#1E1428] flex flex-col items-center justify-center overflow-hidden">
                {selfieStatus === 'idle' && (
                  <div className="text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-[#9FD7C7]/20 flex items-center justify-center text-[#9FD7C7] mx-auto mb-3">
                      <Camera className="w-8 h-8" />
                    </div>
                    <p className="text-xs text-[#F7EFE6] font-medium">Position face inside oval</p>
                    <p className="text-[11px] text-[#B9A9C4] mt-1">Good lighting, remove sunglasses</p>
                  </div>
                )}

                {selfieStatus === 'capturing' && (
                  <div className="flex flex-col items-center justify-center animate-pulse">
                    <span className="font-serif text-6xl text-[#9FD7C7] font-bold">
                      {selfieCountdown}
                    </span>
                    <span className="text-xs text-[#9FD7C7] mt-2">Hold still & blink once</span>
                  </div>
                )}

                {selfieStatus === 'verifying' && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-2 border-[#9FD7C7] border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-xs text-[#9FD7C7]">Analyzing 3D facial depth...</span>
                  </div>
                )}

                {selfieStatus === 'verified' && (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-[#9FD7C7]/20 border border-[#9FD7C7] flex items-center justify-center text-[#9FD7C7] mb-2 shadow-lg shadow-[#9FD7C7]/20">
                      <Check className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-bold text-[#9FD7C7]">Selfie Verified!</span>
                    <span className="text-[11px] text-[#B9A9C4] mt-0.5">Matched with device biometric standards</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {selfieStatus === 'idle' && (
                <Button onClick={startSelfieScan} size="full">
                  Take 5s verification selfie
                </Button>
              )}
              {selfieStatus === 'verified' && (
                <Button onClick={handleNext} size="full">
                  Continue
                </Button>
              )}
              {selfieStatus !== 'idle' && selfieStatus !== 'verified' && (
                <Button disabled size="full">
                  Verifying...
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: REAL PHOTOS (Design 4) */}
        {step === 6 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                Your Presence
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                Real photos, <span className="italic text-[#FFB547]">real you</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-4">
                Add 3 to 6 genuine photos. No heavy filters, sunglasses-only, or group guessing games.
              </p>

              {/* Photo grid */}
              <div className="grid grid-cols-3 gap-2.5 my-2">
                {photos.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-[#3A2A48] bg-[#241830] group"
                  >
                    <img src={src} alt="Uploaded" className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 bg-[#FFB547] text-[#160E1F] text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Main
                      </span>
                    )}
                  </div>
                ))}
                {Array.from({ length: 6 - photos.length }).map((_, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      playTapSound();
                      setPhotos([...photos, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800']);
                    }}
                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-[#3A2A48] hover:border-[#FFB547]/50 bg-[#1E1428] flex flex-col items-center justify-center text-[#B9A9C4] cursor-pointer"
                  >
                    <Camera className="w-6 h-6 mb-1 text-[#B9A9C4]" />
                    <span className="text-[10px]">Add photo</span>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleNext} disabled={photos.length < 3} size="full">
              Continue ({photos.length}/6 photos)
            </Button>
          </div>
        )}

        {/* STEP 7: VOICE ANSWERS (Design 6) */}
        {step === 7 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                Voice First
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                Your voice, <span className="italic text-[#FFB547]">unfiltered</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-5">
                Record up to 30s. Hearing someone’s natural laugh and voice breaks the ice faster than 50 texts.
              </p>

              {/* Prompt choices */}
              <div className="space-y-2 mb-4">
                {[
                  'My perfect Sunday in Hyderabad looks like...',
                  'A Hyderabad food opinion that gets me in trouble...',
                  'The kind of conversation that makes me lose track of time...',
                ].map((prompt, pIdx) => (
                  <div
                    key={pIdx}
                    onClick={() => setRecordingPromptIndex(pIdx)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      recordingPromptIndex === pIdx
                        ? 'border-[#FFB547] bg-[#FFB547]/10'
                        : 'border-[#3A2A48] bg-[#1E1428]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#F7EFE6]">{prompt}</span>
                      {recordedVoice[pIdx] && (
                        <span className="text-[10px] text-[#9FD7C7] flex items-center gap-1 font-semibold">
                          <Check className="w-3 h-3" /> 0:24
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Interactive Audio Waveform Card */}
              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] my-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#B9A9C4]">Prompt #{recordingPromptIndex + 1}</span>
                  <span className="text-xs font-mono text-[#FFB547]">
                    {isRecording ? '0:18 / 0:30' : '0:24'}
                  </span>
                </div>

                {/* Animated Bars */}
                <div className="h-10 flex items-center justify-between gap-1 px-2 mb-3">
                  {Array.from({ length: 24 }).map((_, barIdx) => {
                    const heights = [10, 18, 24, 14, 30, 20, 12, 28, 32, 16, 22, 28, 12, 18, 26, 14, 20, 32, 16, 24, 18, 12, 8, 14];
                    const activeBar = isRecording || isPlayingVoice;
                    return (
                      <div
                        key={barIdx}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          activeBar ? 'bg-[#FFB547] animate-pulse' : 'bg-[#3A2A48]'
                        }`}
                        style={{ height: `${heights[barIdx % heights.length]}px` }}
                      />
                    );
                  })}
                </div>

                {/* Record / Play controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => {
                      playTapSound();
                      setIsRecording(!isRecording);
                      if (!isRecording) {
                        setRecordedVoice((prev) => ({ ...prev, [recordingPromptIndex]: true }));
                      }
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-[#FF6B5E] text-white animate-bounce'
                        : 'bg-[#FFB547] text-[#160E1F]'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={() => {
                      playTapSound();
                      setIsPlayingVoice(!isPlayingVoice);
                    }}
                    className="w-10 h-10 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-[#F7EFE6]"
                  >
                    {isPlayingVoice ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      playTapSound();
                      setIsRecording(false);
                      setIsPlayingVoice(false);
                    }}
                    className="w-10 h-10 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-[#B9A9C4] hover:text-[#F7EFE6]"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={handleNext} size="full">
              Continue
            </Button>
          </div>
        )}

        {/* STEP 8: HYDERABAD PREFERENCES (Design 9) */}
        {step === 8 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                Hyderabad Filters
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                Areas, <span className="italic text-[#FFB547]">languages</span> & age
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-4">
                We prioritize neighborhoods close to you so dates are effortless.
              </p>

              {/* Areas */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
                  Preferred Neighborhoods
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Gachibowli', 'Kondapur', 'Madhapur', 'Jubilee Hills', 'Banjara Hills', 'Hitec City', 'Begumpet', 'Secunderabad'].map((area) => {
                    const isSelected = selectedAreas.includes(area);
                    return (
                      <Chip
                        key={area}
                        label={area}
                        active={isSelected}
                        onClick={() => {
                          setSelectedAreas(
                            isSelected ? selectedAreas.filter((a) => a !== area) : [...selectedAreas, area]
                          );
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Languages */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
                  Comfortable Speaking
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Telugu', 'English', 'Hindi', 'Dakhni / Urdu'].map((lang) => {
                    const isSelected = selectedLanguages.includes(lang);
                    return (
                      <Chip
                        key={lang}
                        label={lang}
                        active={isSelected}
                        onClick={() => {
                          setSelectedLanguages(
                            isSelected ? selectedLanguages.filter((l) => l !== lang) : [...selectedLanguages, lang]
                          );
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Age Slider */}
              <div className="p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-[#B9A9C4]">Age Preference</span>
                  <span className="text-[#FFB547] font-semibold font-mono">
                    {minAge} – {maxAge} years
                  </span>
                </div>
                <input
                  type="range"
                  min="21"
                  max="45"
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full accent-[#FFB547]"
                />
              </div>
            </div>

            <Button onClick={handleNext} size="full">
              Continue
            </Button>
          </div>
        )}

        {/* STEP 9: CONTACT PRIVACY (Design 8 + Spec Fix 5.3) */}
        {step === 9 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#9FD7C7] font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Privacy First
              </span>
              <h2 className="font-serif text-3xl text-[#F7EFE6] mt-1 mb-2">
                Contact <span className="italic text-[#9FD7C7]">privacy</span>
              </h2>
              <p className="text-xs text-[#B9A9C4] mb-4">
                We never store your raw phonebook. Numbers are hashed (SHA-256) on your device before matching.
              </p>

              {/* Spec §5.3 Fix: "Hide me from all my contacts", ON by default */}
              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] mb-4">
                <Toggle
                  checked={hideFromAllContacts}
                  onChange={setHideFromAllContacts}
                  label="Hide me from all my contacts"
                  description="Default ON. Colleagues, family, and acquaintances in your phonebook will never see your profile."
                />
              </div>

              {/* Allow-list search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#B9A9C4]">
                  <span>Allow-list (Friends who CAN see you)</span>
                  <span className="text-[#FFB547] font-medium">{allowlist.length} selected</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1E1428] border border-[#3A2A48]">
                  <Search className="w-4 h-4 text-[#B9A9C4]" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="bg-transparent text-xs text-[#F7EFE6] focus:outline-none flex-1"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1.5">
                  {sampleContacts
                    .filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
                    .map((contact) => {
                      const isAllowed = allowlist.includes(contact.name);
                      return (
                        <div
                          key={contact.phone}
                          onClick={() => {
                            playTapSound();
                            setAllowlist(
                              isAllowed
                                ? allowlist.filter((n) => n !== contact.name)
                                : [...allowlist, contact.name]
                            );
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#241830] border border-[#3A2A48]/50 text-xs cursor-pointer hover:border-[#FFB547]/50"
                        >
                          <div>
                            <p className="font-medium text-[#F7EFE6]">{contact.name}</p>
                            <p className="text-[10px] text-[#B9A9C4] font-mono">{contact.phone}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              isAllowed
                                ? 'bg-[#9FD7C7] border-[#9FD7C7] text-[#160E1F]'
                                : 'border-[#3A2A48]'
                            }`}
                          >
                            {isAllowed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <Button onClick={handleNext} size="full">
              Save Privacy Settings
            </Button>
          </div>
        )}

        {/* STEP 10: FIRST DROP / NOTIFICATIONS (Design 10) */}
        {step === 10 && (
          <div className="flex flex-col h-full justify-between animate-in fade-in duration-300">
            <div>
              <div className="w-16 h-16 rounded-full bg-[#FFB547]/15 border border-[#FFB547]/40 flex items-center justify-center text-[#FFB547] mx-auto my-4 shadow-lg shadow-[#FFB547]/20">
                <Bell className="w-8 h-8" />
              </div>

              <span className="text-center block text-xs uppercase tracking-wider text-[#FFB547] font-semibold">
                You’re Ready
              </span>
              <h2 className="font-serif text-3xl text-center text-[#F7EFE6] mt-1 mb-2">
                Your first Drop arrives <br />
                <span className="italic text-[#FFB547]">tonight at 9:00 PM</span>
              </h2>
              <p className="text-center text-xs text-[#B9A9C4] mb-6 px-4">
                Three verified Hyderabad singles picked especially for your schedule and taste.
              </p>

              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#9FD7C7]/20 text-[#9FD7C7] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F7EFE6]">Daily notification at 9 PM IST</p>
                    <p className="text-[10px] text-[#B9A9C4]">You have until 2 PM next day to review</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FFB547]/20 text-[#FFB547] flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F7EFE6]">Next Drop opens in</p>
                    <p className="text-xs font-mono text-[#FFB547]">23 hrs 58 mins 12 secs</p>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleNext} size="full">
              Enter Closer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
