import { Dice5, HelpCircle, Music, Ticket as TicketIcon, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isLive } from "../../lib/env";
import { ANTAKSHARI_LETTERS, QUIZ, THIS_OR_THAT } from "../../mocks/catalog";
import { PEOPLE, personById } from "../../mocks/people";
import { addFriend, finishGame } from "../../state/logic";
import { likePerson, recordStreak } from "../../state/live";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Headline } from "../../ui/primitives";
import { Screen } from "../../ui/shell";
import { claimOk, createCalls, createTicket, type Claim, type Ticket } from "./housie";
import { COLOURS, botToken, createLudo, legalTokens, move, roll, seatColour, tokenCell, type LudoState } from "./ludo";

export function PlayLobby() {
  const navigate = useNavigate();
  const games = [
    ["/play/ludo", "Ludo", "2–4 · four colours", "128 playing", Dice5],
    ["/play/this-or-that", "This or That", "Two people, eight prompts", "64 playing", Users],
    ["/play/quiz", "Tollywood quiz", "Ten questions · a timer", "41 playing", HelpCircle],
    ["/play/housie", "Housie", "One ticket, the room calls", "210 playing", TicketIcon],
    ["/play/antakshari", "Antakshari", "A letter, 20 seconds, honour", "36 playing", Music],
  ] as const;
  // Live games are solo until the multiplayer server exists: no invented players, counts or partners.
  const live = isLive();
  const shown = live
    ? ([
        ["/play/ludo", "Ludo", "You against the computer · four colours", "", Dice5],
        ["/play/quiz", "Tollywood quiz", "Ten questions · a timer", "", HelpCircle],
      ] as const)
    : games;
  return (
    <Screen tab>
      <Headline text="Play, then talk" italic="talk" />
      <p className="mt-3 text-sm text-mute">No money on the table. A finished game can keep today's streak.</p>
      <div className="mt-5 space-y-3">
        {shown.map(([path, title, copy, count, Icon]) => (
          <button key={path} type="button" onClick={() => navigate(path)} className="flex min-h-11 w-full items-center gap-3 rounded-3xl border border-line bg-card p-4 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold"><Icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-mute">{copy}</span>
              {count ? <span className="mt-2 block text-xs text-gold">{count}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {live ? (
        <Card className="mt-5">
          <p className="text-xs uppercase tracking-[0.16em] text-gold">Coming next</p>
          <p className="mt-2 font-medium">This or That, Housie and Antakshari with real people.</p>
          <p className="text-sm text-mute">They open here once live multiplayer is switched on.</p>
        </Card>
      ) : <Card className="mt-5">
        <p className="text-xs uppercase tracking-[0.16em] text-gold">Sunday board</p>
        <p className="mt-2 font-medium">Housie tonight is hosted at Chaiholic.</p>
        <p className="text-sm text-mute">The game is free. This note stays on Play, never in a date chat.</p>
      </Card>}
    </Screen>
  );
}

/** A finished game keeps today's streak: on the server when live, in the preview state otherwise. */
function useFinishGame() {
  const { current, commit } = useStore();
  return () => {
    if (isLive()) void recordStreak(current(), "play").then(commit);
    else commit(finishGame(current()));
  };
}

function AfterGame({
  onFriend,
  onLike,
  showLike,
  solo = false,
}: {
  onFriend: () => void;
  onLike: () => void;
  showLike: boolean;
  solo?: boolean;
}) {
  return (
    <Card className="mt-4">
      <Headline text="That's the game" italic="game" className="!text-4xl" />
      <p className="mt-1 text-sm text-mute">Streak day is kept once, on the server, if today wasn't already counted.</p>
      {solo ? null : <div className="mt-3 space-y-2">
        <Button variant="ghost" onClick={onFriend}>Add friend</Button>
        {showLike ? <Button onClick={onLike}>Send a like</Button> : null}
      </div>}
    </Card>
  );
}

export function LudoScreen() {
  const [state, setState] = useState<LudoState>(() => createLudo(4));
  const { state: app, current, commit } = useStore();
  const [done, setDone] = useState(false);
  const names = isLive() ? ["You", "Computer", "Computer", "Computer"] : ["You", "Meher", "Karthik", "Saanvi"];
  const finish = useFinishGame();
  useEffect(() => {
    if (state.winner != null || state.current === 0) return undefined;
    const timer = window.setTimeout(() => {
      setState((currentState) => {
        if (currentState.current === 0 || currentState.winner != null) return currentState;
        if (currentState.phase === "roll") return roll(currentState, 1 + Math.floor(Math.random() * 6));
        const pick = botToken(currentState);
        return pick == null ? currentState : move(currentState, pick);
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (state.winner != null && !done) {
      setDone(true);
      finish();
    }
  }, [state.winner, done, finish]);
  const cells = Array.from({ length: 15 }, (_, row) =>
    Array.from({ length: 15 }, (_, col) => {
      const home = COLOURS.findIndex((_, colour) => HOME_HAS(colour, row, col));
      const onPath = pathHas(row, col);
      const yard = yardOf(row, col);
      const start = startCellIndex(row, col);
      let background = "transparent";
      if (isSeat(yard)) background = `${COLOURS[yard].hex}22`;
      if (onPath) background = "#1E1428";
      if (isSeat(home)) background = `${COLOURS[home].hex}88`;
      if (isSeat(start) && COLOURS.some((_, colour) => startCell(colour, row, col))) background = COLOURS[start].hex;
      return { row, col, background };
    }),
  );
  return (
    <Screen title="Ludo" back="/play">
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {COLOURS.map((colour, index) => (
          <span key={colour.id} className="flex min-h-11 flex-col items-center justify-center rounded-2xl px-1 py-1 text-center font-semibold" style={{ background: colour.hex, color: colour.ink }}>
            {names[index]}
            <span className="block font-medium capitalize">{colour.id}</span>
          </span>
        ))}
      </div>
      <div className="relative mt-3 aspect-square w-full rounded-2xl bg-[#120a18] p-1">
        <div className="grid h-full w-full gap-px" style={{ gridTemplateColumns: "repeat(15, 1fr)" }}>
          {cells.flat().map((cell) => (
            <div key={`${cell.row}-${cell.col}`} style={{ background: cell.background }} className="rounded-[2px]" />
          ))}
        </div>
        {state.tokens.flatMap((row, player) =>
          row.map((_, token) => {
            const at = tokenCell(state, player, token);
            if (!at) return null;
            const colour = COLOURS[seatColour(player, state.players)];
            const legal = state.current === 0 && legalTokens(state).includes(token);
            return (
              <button
                key={`${player}-${token}`}
                type="button"
                disabled={!legal}
                onClick={() => setState((currentState) => move(currentState, token))}
                className="absolute h-3.5 w-3.5 rounded-full border border-ink"
                style={{
                  background: colour.hex,
                  left: `${((at[1] + 0.5) / 15) * 100}%`,
                  top: `${((at[0] + 0.5) / 15) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  boxShadow: legal ? "0 0 0 2px #F7EFE6" : undefined,
                }}
                aria-label={`${names[player]} token ${token + 1}`}
              />
            );
          }),
        )}
      </div>
      <div className="mt-4">
        <Button
          disabled={state.phase !== "roll" || state.current !== 0 || state.winner != null}
          onClick={() => setState((currentState) => roll(currentState, 1 + Math.floor(Math.random() * 6)))}
        >
          {state.winner != null ? `${names[state.winner]} wins` : state.phase === "move" && state.current === 0 ? `Move a token · ${state.dice}` : state.current === 0 ? "Roll" : "Their turn"}
        </Button>
      </div>
      {done ? (
        <AfterGame
          solo={isLive()}
          showLike={app.draft.intent !== "friends"}
          onFriend={() => commit(addFriend(current(), "meher"))}
          onLike={() => {
            void likePerson(current(), "meher", "From Ludo", []).then((result) => commit(result.state));
            void recordStreak(current(), "play");
          }}
        />
      ) : null}
    </Screen>
  );
}

function pathHas(row: number, col: number) {
  return tokenPath().some(([r, c]) => r === row && c === col);
}
function tokenPath() {
  return [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0],
  ];
}
function HOME_HAS(colour: number, row: number, col: number) {
  const homes = [
    [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  ];
  return homes[colour].some(([r, c]) => r === row && c === col);
}
function yardOf(row: number, col: number) {
  if (row <= 5 && col <= 5) return 1;
  if (row <= 5 && col >= 9) return 2;
  if (row >= 9 && col <= 5) return 0;
  if (row >= 9 && col >= 9) return 3;
  return -1;
}
function startCell(colour: number, row: number, col: number) {
  const starts = [[14, 6], [6, 0], [0, 8], [8, 14]];
  return starts[colour][0] === row && starts[colour][1] === col;
}
function isSeat(index: number): index is 0 | 1 | 2 | 3 {
  return index === 0 || index === 1 || index === 2 || index === 3;
}

function startCellIndex(row: number, col: number) {
  return [0, 1, 2, 3].find((colour) => startCell(colour, row, col)) ?? -1;
}

export function ThisOrThat() {
  const [index, setIndex] = useState(0);
  const [mine, setMine] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const { current, commit } = useStore();
  const [done, setDone] = useState(false);
  const pair = THIS_OR_THAT[index];
  const partner = PEOPLE[2];
  return (
    <Screen title="This or That" back="/play">
      {pair && !done ? (
        <>
          <p className="text-sm text-mute">{index + 1} of {THIS_OR_THAT.length} · with {partner.name.split(" ")[0]}</p>
          <div className="mt-4 grid gap-3">
            {pair.map((choice, choiceIndex) => (
              <Button key={choice} variant={mine === choiceIndex ? "primary" : "ghost"} onClick={() => setMine(choiceIndex)}>
                {choice}
              </Button>
            ))}
          </div>
          <div className="mt-4">
            <Button
              disabled={mine == null}
              onClick={() => {
                const theirs = (index + partner.age) % 2;
                if (mine === theirs) setScore((value) => value + 1);
                if (index + 1 >= THIS_OR_THAT.length) {
                  setDone(true);
                  commit(finishGame(current()));
                } else {
                  setIndex((value) => value + 1);
                  setMine(null);
                }
              }}
            >
              Reveal
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-serif text-5xl">{score} matched</h2>
          <AfterGame showLike onFriend={() => commit(addFriend(current(), partner.id))} onLike={() => { void likePerson(current(), partner.id, "This or That", []).then((result) => commit(result.state)); }} />
        </>
      )}
    </Screen>
  );
}

export function Quiz() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(15);
  const [done, setDone] = useState(false);
  const { current, commit } = useStore();
  const question = QUIZ[index];
  useEffect(() => {
    if (done) return undefined;
    const timer = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setIndex((currentIndex) => {
            if (currentIndex + 1 >= QUIZ.length) {
              setDone(true);
              return currentIndex;
            }
            return currentIndex + 1;
          });
          return 15;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [done]);
  const finish = useFinishGame();
  const counted = useRef(false);
  useEffect(() => {
    if (!done || counted.current) return;
    counted.current = true;
    finish();
  }, [done, finish]);
  if (!question || done) {
    return (
      <Screen title="Quiz" back="/play">
        <h2 className="font-serif text-5xl">{score} / {QUIZ.length}</h2>
        {isLive() ? (
          <p className="mt-4 text-sm text-mute">Your score is yours alone. A weekly city board comes with live multiplayer.</p>
        ) : <>
        <Card className="mt-4">
          <p className="text-sm text-mute">Sample week in Hyderabad</p>
          <p className="mt-2">Saanvi · 9</p>
          <p>Imran · 7</p>
          <p>You · {score}</p>
        </Card>
        <AfterGame showLike={false} onFriend={() => commit(addFriend(current(), "saanvi"))} onLike={() => undefined} />
        </>}
      </Screen>
    );
  }
  return (
    <Screen title="Tollywood quiz" back="/play">
      <p className="text-sm text-gold">{left}s</p>
      <h2 className="mt-2 text-xl font-semibold">{question.q}</h2>
      <div className="mt-4 space-y-2">
        {question.options.map((option, optionIndex) => (
          <Button
            key={option}
            variant="ghost"
            onClick={() => {
              if (optionIndex === question.answer) setScore((value) => value + 1);
              if (index + 1 >= QUIZ.length) setDone(true);
              else {
                setIndex((value) => value + 1);
                setLeft(15);
              }
            }}
          >
            {option}
          </Button>
        ))}
      </div>
    </Screen>
  );
}

export function Housie() {
  const [ticket] = useState<Ticket>(() => createTicket(26));
  const [calls] = useState(() => createCalls(7));
  const [calledCount, setCalledCount] = useState(8);
  const [locked, setLocked] = useState<Claim[]>([]);
  const [message, setMessage] = useState("");
  const { current, commit } = useStore();
  const called = calls.slice(0, calledCount);
  useEffect(() => {
    if (calledCount >= 90) return undefined;
    const timer = window.setTimeout(() => setCalledCount((value) => value + 1), 2500);
    return () => window.clearTimeout(timer);
  }, [calledCount]);
  function claim(kind: Claim) {
    if (locked.includes(kind)) return;
    if (claimOk(ticket, called, kind)) {
      setMessage(`${kind} is good.`);
      commit(finishGame(current()));
    } else {
      setLocked((list) => [...list, kind]);
      setMessage(`${kind} was early, so that claim is closed for you.`);
    }
  }
  return (
    <Screen title="Housie" back="/play">
      <p className="text-sm text-mute">Latest call · {called[called.length - 1]}</p>
      <div className="mt-3 space-y-1">
        {ticket.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-9 gap-1">
            {row.map((value, col) => (
              <span key={col} className={`grid h-8 place-items-center rounded text-[10px] ${value && called.includes(value) ? "bg-gold text-ink" : "bg-card text-mute"}`}>
                {value ?? ""}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["early", "top", "middle", "bottom", "full"] as Claim[]).map((kind) => (
          <Chip key={kind} active={false} onClick={() => claim(kind)}>{locked.includes(kind) ? `${kind} closed` : kind}</Chip>
        ))}
      </div>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </Screen>
  );
}

export function Antakshari() {
  const [round, setRound] = useState(0);
  const [letter, setLetter] = useState("S");
  const [left, setLeft] = useState(20);
  const [score, setScore] = useState([0, 0]);
  const [last, setLast] = useState("");
  const [done, setDone] = useState(false);
  const { current, commit } = useStore();
  useEffect(() => {
    if (done) return undefined;
    const timer = window.setInterval(() => {
      setLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [done, round]);
  function next(point: boolean) {
    const follow = last.trim().toUpperCase().slice(-1);
    const upcoming = ANTAKSHARI_LETTERS.includes(follow) ? follow : ANTAKSHARI_LETTERS[(round + 3) % ANTAKSHARI_LETTERS.length];
    setScore(([you, them]) => [you + (point ? 1 : 0), them]);
    if (round + 1 >= 4) {
      setDone(true);
      commit(finishGame(current()));
      return;
    }
    setLetter(upcoming);
    setLast("");
    setLeft(20);
    setRound((value) => value + 1);
  }
  const friend = personById("laya");
  return (
    <Screen title="Antakshari" back="/play">
      {done ? (
        <>
          <Headline text={`${score[0]} to ${score[1]}`} italic="to" />
          <p className="mt-2 text-sm text-mute">Honour scoring. The room doesn't check the song.</p>
          {friend ? <AfterGame showLike onFriend={() => commit(addFriend(current(), friend.id))} onLike={() => { void likePerson(current(), friend.id, "Antakshari", []).then((result) => commit(result.state)); }} /> : null}
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-mute"><Music size={16} className="text-gold" /> Honour round</p>
          <p className="font-serif text-7xl text-gold">{letter}</p>
          <p className="text-sm text-mute">{left}s · round {round + 1} of 4 · You {score[0]}</p>
          <input className="mt-4 h-12 w-full rounded-2xl border border-line bg-card px-3" maxLength={1} placeholder="Last letter" value={last} onChange={(event) => setLast(event.target.value)} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={() => next(true)}>We sang</Button>
            <Button variant="ghost" onClick={() => next(false)}>Pass</Button>
          </div>
        </>
      )}
    </Screen>
  );
}
