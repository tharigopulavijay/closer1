import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Dices, 
  Film, 
  Ticket, 
  Music, 
  Sparkles, 
  Trophy, 
  RotateCcw, 
  ArrowLeft, 
  Check, 
  UserPlus, 
  Heart, 
  Clock,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TOLYYWOOD_QUIZ_QUESTIONS } from '../../mocks/seedData';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { playTapSound, playSuccessChime, playDiceRollSound } from '../../lib/audio';

interface PlayTabProps {
  onOpenSafety: () => void;
}

export const PlayTab: React.FC<PlayTabProps> = ({ onOpenSafety }) => {
  const [activeGame, setActiveGame] = useState<'none' | 'ludo' | 'quiz' | 'housie' | 'this_or_that'>('none');

  // Ludo state
  // 4 Distinct colors per spec §5.4: Marigold (#FFB547), Mint (#9FD7C7), Lavender (#C9A7FF), Coral (#FF6B5E)
  const [diceValue, setDiceValue] = useState<number>(6);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<number>(0); // 0: Marigold (You), 1: Mint (Kavya), 2: Lavender (Rohit), 3: Coral (Ananya)
  const [ludoPositions, setLudoPositions] = useState([4, 12, 22, 38]);
  const [winnerModal, setWinnerModal] = useState(false);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizTimer, setQuizTimer] = useState(15);

  // Housie state
  const [calledNumbers, setCalledNumbers] = useState<number[]>([7, 14, 23, 42, 58, 66, 81]);
  const [myHousieTicket, setMyHousieTicket] = useState<number[][]>([
    [7, 0, 23, 0, 45, 0, 66, 0, 81],
    [0, 14, 0, 31, 0, 52, 0, 74, 0],
    [3, 0, 28, 0, 49, 0, 69, 0, 88],
  ]);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([7, 14, 23, 66, 81]);

  // Quiz Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeGame === 'quiz' && !quizCompleted && quizTimer > 0) {
      timer = setTimeout(() => setQuizTimer((t) => t - 1), 1000);
    } else if (quizTimer === 0 && activeGame === 'quiz' && !quizCompleted) {
      handleQuizNext();
    }
    return () => clearTimeout(timer);
  }, [activeGame, quizTimer, quizCompleted]);

  // Dice roll function
  const rollDice = () => {
    if (isRollingDice) return;
    setIsRollingDice(true);
    playDiceRollSound();
    let rollCount = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount > 8) {
        clearInterval(interval);
        const finalVal = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalVal);
        setIsRollingDice(false);

        // Move current player's pawn
        setLudoPositions((prev) => {
          const next = [...prev];
          next[currentTurn] = Math.min(52, next[currentTurn] + finalVal);
          if (next[currentTurn] >= 48) {
            setWinnerModal(true);
            playSuccessChime();
            confetti({ particleCount: 90, spread: 70 });
          }
          return next;
        });

        // Next turn
        setCurrentTurn((t) => (t + 1) % 4);
      }
    }, 60);
  };

  const handleQuizAnswer = (optIndex: number) => {
    if (selectedOption !== null) return;
    playTapSound();
    setSelectedOption(optIndex);
    const isCorrect = optIndex === TOLYYWOOD_QUIZ_QUESTIONS[quizIndex].correctIndex;
    if (isCorrect) {
      setQuizScore((s) => s + 100);
      playSuccessChime();
    }
  };

  const handleQuizNext = () => {
    if (quizIndex < TOLYYWOOD_QUIZ_QUESTIONS.length - 1) {
      setQuizIndex((i) => i + 1);
      setSelectedOption(null);
      setQuizTimer(15);
    } else {
      setQuizCompleted(true);
      playSuccessChime();
      confetti({ particleCount: 70 });
    }
  };

  const players = [
    { name: 'Arjun (You)', color: '#FFB547', label: 'Marigold' },
    { name: 'Kavya', color: '#9FD7C7', label: 'Mint' },
    { name: 'Rohit', color: '#C9A7FF', label: 'Lavender' },
    { name: 'Ananya', color: '#FF6B5E', label: 'Coral' },
  ];

  return (
    <div className="pb-24 pt-2">
      {/* Play Lobby */}
      {activeGame === 'none' && (
        <div className="px-4 space-y-4 animate-in fade-in duration-200">
          <div className="pt-2 pb-1">
            <h1 className="font-serif text-4xl text-[#F7EFE6] leading-none mb-1">
              Games & <span className="italic text-[#FFB547]">talk</span>
            </h1>
            <p className="text-xs text-[#B9A9C4]">
              Fun casual multiplayer games. No bets or real money stakes.
            </p>
          </div>

          {/* Featured Game: Voice Ludo (Design 29 / 34) */}
          <div
            onClick={() => {
              playTapSound();
              setActiveGame('ludo');
            }}
            className="rounded-[24px] bg-gradient-to-br from-[#1E1428] via-[#241830] to-[#1E1428] border border-[#FFB547]/50 p-4 cursor-pointer hover:border-[#FFB547] transition-all shadow-md group active:scale-[0.99]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#FFB547] bg-[#FFB547]/15 px-2.5 py-0.5 rounded-full border border-[#FFB547]/30 flex items-center gap-1">
                <Dices className="w-3 h-3" /> Voice Ludo
              </span>
              <span className="text-xs font-mono text-[#9FD7C7]">
                420 playing now
              </span>
            </div>

            <h3 className="font-serif text-2xl text-[#F7EFE6] mb-1">
              Voice Ludo with 4 players
            </h3>
            <p className="text-xs text-[#B9A9C4] mb-4">
              4 distinct colours (Marigold, Mint, Lavender, Coral). Talk over voice while playing.
            </p>

            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {players.map((p, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-[#1E1428] flex items-center justify-center text-[10px] font-bold text-[#160E1F]"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name[0]}
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-[#FFB547] group-hover:underline">
                Quick Match →
              </span>
            </div>
          </div>

          {/* Grid of Other Games */}
          <div className="grid grid-cols-2 gap-3">
            {/* Tollywood Quiz */}
            <div
              onClick={() => {
                playTapSound();
                setActiveGame('quiz');
                setQuizIndex(0);
                setSelectedOption(null);
                setQuizScore(0);
                setQuizCompleted(false);
                setQuizTimer(15);
              }}
              className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] hover:border-[#C9A7FF] cursor-pointer transition-all space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-[#C9A7FF]/15 text-[#C9A7FF] flex items-center justify-center">
                <Film className="w-5 h-5" />
              </div>
              <h4 className="font-serif text-lg text-[#F7EFE6]">
                Tollywood Quiz
              </h4>
              <p className="text-[11px] text-[#B9A9C4]">
                Hyderabad cinema trivia, 15s timer.
              </p>
              <span className="text-[10px] text-[#C9A7FF] font-medium block">
                +1 Streak day on win
              </span>
            </div>

            {/* Housie / Tambola */}
            <div
              onClick={() => {
                playTapSound();
                setActiveGame('housie');
              }}
              className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] hover:border-[#9FD7C7] cursor-pointer transition-all space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-[#9FD7C7]/15 text-[#9FD7C7] flex items-center justify-center">
                <Ticket className="w-5 h-5" />
              </div>
              <h4 className="font-serif text-lg text-[#F7EFE6]">
                Housie
              </h4>
              <p className="text-[11px] text-[#B9A9C4]">
                Automated caller, mark lines and full house.
              </p>
              <span className="text-[10px] text-[#9FD7C7] font-medium block">
                Next room at 9:30 PM
              </span>
            </div>
          </div>
        </div>
      )}

      {/* GAME 1: VOICE LUDO SCREEN (Design 34) */}
      {activeGame === 'ludo' && (
        <div className="px-4 space-y-4 animate-in slide-in-from-right duration-250">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveGame('none')}
              className="flex items-center gap-1.5 text-xs text-[#B9A9C4] hover:text-[#F7EFE6]"
            >
              <ArrowLeft className="w-4 h-4" /> Exit to lobby
            </button>
            <span className="text-[10px] bg-[#9FD7C7]/20 text-[#9FD7C7] px-2.5 py-0.5 rounded-full font-bold">
              Voice Room Active
            </span>
          </div>

          {/* Header */}
          <div className="text-center">
            <h2 className="font-serif text-2xl text-[#F7EFE6]">
              Turn: <span style={{ color: players[currentTurn].color }}>{players[currentTurn].name}</span>
            </h2>
            <p className="text-xs text-[#B9A9C4]">Roll dice to move your pawn along the track</p>
          </div>

          {/* Interactive Ludo Board (SVG 4-quadrant layout with distinct colors) */}
          <div className="relative w-full aspect-square max-w-[340px] mx-auto bg-[#1E1428] border-2 border-[#3A2A48] rounded-3xl p-3 shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Top row homes */}
            <div className="flex justify-between items-center h-28">
              {/* Marigold Home (Player 1) */}
              <div className="w-28 h-28 rounded-2xl bg-[#FFB547]/20 border-2 border-[#FFB547] p-2 flex flex-col items-center justify-center relative">
                <span className="text-[10px] font-bold text-[#FFB547] mb-1">Marigold (You)</span>
                <div className="w-7 h-7 rounded-full bg-[#FFB547] shadow-md flex items-center justify-center text-[10px] font-bold text-[#160E1F]">
                  P1
                </div>
              </div>

              {/* Center track preview */}
              <div className="flex flex-col items-center justify-center font-serif text-sm text-[#B9A9C4]">
                <span>Old City</span>
                <span className="font-mono text-xs text-[#FFB547]">Track</span>
              </div>

              {/* Mint Home (Player 2 - Kavya) */}
              <div className="w-28 h-28 rounded-2xl bg-[#9FD7C7]/20 border-2 border-[#9FD7C7] p-2 flex flex-col items-center justify-center relative">
                <span className="text-[10px] font-bold text-[#9FD7C7] mb-1">Mint (Kavya)</span>
                <div className="w-7 h-7 rounded-full bg-[#9FD7C7] shadow-md flex items-center justify-center text-[10px] font-bold text-[#160E1F]">
                  P2
                </div>
              </div>
            </div>

            {/* Mid track path */}
            <div className="flex items-center justify-between px-2 py-2 bg-[#241830] rounded-xl border border-[#3A2A48]">
              {players.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-mono text-[#F7EFE6]">{ludoPositions[idx]}/52</span>
                </div>
              ))}
            </div>

            {/* Bottom row homes */}
            <div className="flex justify-between items-center h-28">
              {/* Lavender Home (Player 3 - Rohit) */}
              <div className="w-28 h-28 rounded-2xl bg-[#C9A7FF]/20 border-2 border-[#C9A7FF] p-2 flex flex-col items-center justify-center relative">
                <span className="text-[10px] font-bold text-[#C9A7FF] mb-1">Lavender (Rohit)</span>
                <div className="w-7 h-7 rounded-full bg-[#C9A7FF] shadow-md flex items-center justify-center text-[10px] font-bold text-[#160E1F]">
                  P3
                </div>
              </div>

              {/* Center Dice Control */}
              <button
                onClick={rollDice}
                disabled={isRollingDice}
                className="w-16 h-16 rounded-2xl bg-[#FFB547] text-[#160E1F] flex flex-col items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
              >
                <span className="font-mono text-3xl font-black">{diceValue}</span>
                <span className="text-[8px] uppercase tracking-wider font-bold">Roll</span>
              </button>

              {/* Coral Home (Player 4 - Ananya) */}
              <div className="w-28 h-28 rounded-2xl bg-[#FF6B5E]/20 border-2 border-[#FF6B5E] p-2 flex flex-col items-center justify-center relative">
                <span className="text-[10px] font-bold text-[#FF6B5E] mb-1">Coral (Ananya)</span>
                <div className="w-7 h-7 rounded-full bg-[#FF6B5E] shadow-md flex items-center justify-center text-[10px] font-bold text-[#160E1F]">
                  P4
                </div>
              </div>
            </div>
          </div>

          {/* Quick Chat / Reactions */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {['Gg!', 'Cut my pawn?!', 'Roll a 6!', 'Well played'].map((msg, i) => (
              <button
                key={i}
                onClick={() => playTapSound()}
                className="px-3 py-1.5 rounded-full bg-[#241830] border border-[#3A2A48] text-xs text-[#B9A9C4] hover:text-[#F7EFE6]"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GAME 2: TOLLYWOOD QUIZ SCREEN */}
      {activeGame === 'quiz' && (
        <div className="px-4 space-y-4 animate-in slide-in-from-right duration-250">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveGame('none')}
              className="flex items-center gap-1.5 text-xs text-[#B9A9C4] hover:text-[#F7EFE6]"
            >
              <ArrowLeft className="w-4 h-4" /> Quit quiz
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#FFB547] font-mono font-bold">{quizScore} pts</span>
              <span className="text-[#B9A9C4] font-mono">
                {quizIndex + 1}/{TOLYYWOOD_QUIZ_QUESTIONS.length}
              </span>
            </div>
          </div>

          {!quizCompleted ? (
            <div className="space-y-4">
              {/* Question Card */}
              <div className="p-5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-3">
                <div className="flex items-center justify-between text-xs text-[#B9A9C4]">
                  <span>Telugu Cinema Challenge</span>
                  <span className="text-[#FFB547] font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {quizTimer}s left
                  </span>
                </div>

                <h3 className="font-serif text-2xl text-[#F7EFE6] leading-snug">
                  {TOLYYWOOD_QUIZ_QUESTIONS[quizIndex].question}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {TOLYYWOOD_QUIZ_QUESTIONS[quizIndex].options.map((opt, oIdx) => {
                  const isSelected = selectedOption === oIdx;
                  const isCorrect = oIdx === TOLYYWOOD_QUIZ_QUESTIONS[quizIndex].correctIndex;
                  const showResult = selectedOption !== null;

                  let borderClass = 'border-[#3A2A48] bg-[#1E1428] text-[#F7EFE6]';
                  if (showResult && isCorrect) {
                    borderClass = 'border-[#9FD7C7] bg-[#9FD7C7]/20 text-[#9FD7C7] font-bold';
                  } else if (showResult && isSelected && !isCorrect) {
                    borderClass = 'border-[#FF6B5E] bg-[#FF6B5E]/20 text-[#FF6B5E]';
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleQuizAnswer(oIdx)}
                      className={`w-full p-4 rounded-2xl border text-left text-xs transition-all ${borderClass}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {selectedOption !== null && (
                <Button size="full" onClick={handleQuizNext}>
                  {quizIndex < TOLYYWOOD_QUIZ_QUESTIONS.length - 1 ? 'Next Question' : 'View Results'}
                </Button>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#1E1428] border border-[#3A2A48] text-center space-y-4">
              <Trophy className="w-16 h-16 text-[#FFB547] mx-auto" />
              <h3 className="font-serif text-3xl text-[#F7EFE6]">
                Tollywood Certified!
              </h3>
              <p className="text-xs text-[#B9A9C4]">
                You scored <strong className="text-[#FFB547]">{quizScore} points</strong>. +1 Day added to your streak!
              </p>
              <Button size="full" onClick={() => setActiveGame('none')}>
                Back to Lobby
              </Button>
            </div>
          )}
        </div>
      )}

      {/* GAME 3: HOUSIE / TAMBOLA SCREEN */}
      {activeGame === 'housie' && (
        <div className="px-4 space-y-4 animate-in slide-in-from-right duration-250">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveGame('none')}
              className="flex items-center gap-1.5 text-xs text-[#B9A9C4] hover:text-[#F7EFE6]"
            >
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <span className="text-xs text-[#9FD7C7] font-mono">
              Called: 81
            </span>
          </div>

          <div className="text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#FFB547]">
              Current Called Number
            </span>
            <div className="w-20 h-20 rounded-full bg-[#FFB547] text-[#160E1F] font-mono text-4xl font-black flex items-center justify-center mx-auto my-2 shadow-lg">
              81
            </div>
            <p className="text-xs text-[#B9A9C4]">Numbers called: {calledNumbers.join(', ')}</p>
          </div>

          {/* Ticket Grid */}
          <div className="p-3 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-2">
            <span className="text-[10px] text-[#B9A9C4] font-mono block text-center">
              Your Closer Housie Ticket
            </span>
            <div className="grid grid-rows-3 gap-1.5">
              {myHousieTicket.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-9 gap-1 text-center">
                  {row.map((num, cIdx) => {
                    const isMarked = markedNumbers.includes(num);
                    return (
                      <div
                        key={cIdx}
                        onClick={() => {
                          if (num > 0) {
                            playTapSound();
                            setMarkedNumbers((prev) =>
                              prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
                            );
                          }
                        }}
                        className={`h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                          num === 0
                            ? 'bg-[#241830]/40'
                            : isMarked
                            ? 'bg-[#FFB547] text-[#160E1F]'
                            : 'bg-[#241830] text-[#F7EFE6] border border-[#3A2A48] cursor-pointer'
                        }`}
                      >
                        {num || ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <Button
            size="full"
            onClick={() => {
              playSuccessChime();
              confetti({ particleCount: 70 });
            }}
          >
            Claim Line (Jaldi 5)
          </Button>
        </div>
      )}

      {/* LUDO WINNER MODAL (Design 35: Kavya Wins, Connect & Play Again) */}
      <Sheet
        isOpen={winnerModal}
        onClose={() => setWinnerModal(false)}
        title="Game Completed!"
        subtitle="You played 14 rounds of Voice Ludo."
      >
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FFB547]/20 border border-[#FFB547] flex items-center justify-center text-[#FFB547] mx-auto">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h3 className="font-serif text-3xl text-[#F7EFE6]">
              Arjun (You) <span className="italic text-[#FFB547]">Won!</span>
            </h3>
            <p className="text-xs text-[#9FD7C7] flex items-center justify-center gap-1 mt-1 font-semibold">
              <Flame className="w-4 h-4 fill-[#FFB547] text-[#FFB547]" /> +1 Day added to your streak (24 days)
            </p>
          </div>

          {/* Connect with players */}
          <div className="p-3.5 rounded-2xl bg-[#241830] border border-[#3A2A48] space-y-2.5 text-left">
            <span className="text-[10px] uppercase font-bold text-[#B9A9C4]">
              Connect with fellow Hyderabad players
            </span>
            {[
              { name: 'Kavya, 26', job: 'Architect', color: '#9FD7C7' },
              { name: 'Rohit, 28', job: 'Consultant', color: '#C9A7FF' },
              { name: 'Ananya, 28', job: 'Product Designer', color: '#FF6B5E' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <div>
                    <p className="font-medium text-[#F7EFE6]">{p.name}</p>
                    <p className="text-[10px] text-[#B9A9C4]">{p.job}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playSuccessChime();
                    confetti({ particleCount: 30 });
                  }}
                  className="px-3 py-1 rounded-full bg-[#FFB547]/15 border border-[#FFB547]/40 text-[#FFB547] text-[11px] font-semibold hover:bg-[#FFB547]/25"
                >
                  Send Like
                </button>
              </div>
            ))}
          </div>

          <Button
            size="full"
            onClick={() => {
              setWinnerModal(false);
              setActiveGame('none');
            }}
          >
            Back to Game Lobby
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
