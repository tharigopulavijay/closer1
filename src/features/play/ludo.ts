import type { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";

export const COLOURS = [
  { id: "marigold", hex: "#FFB547", ink: "#160E1F" },
  { id: "mint", hex: "#9FD7C7", ink: "#160E1F" },
  { id: "lavender", hex: "#C9A7FF", ink: "#160E1F" },
  { id: "coral", hex: "#FF6B5E", ink: "#160E1F" },
] as const;

/** 52-cell ring. Index 0 is mint's start, on the left arm. */
export const PATH: [number, number][] = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
];

export const START_INDEX = [39, 0, 13, 26];

export const HOME: [number, number][][] = [
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];

export const YARD: [number, number][][] = [
  [[11, 1], [11, 3], [13, 1], [13, 3]],
  [[1, 1], [1, 3], [3, 1], [3, 3]],
  [[1, 10], [1, 12], [3, 10], [3, 12]],
  [[11, 10], [11, 12], [13, 10], [13, 12]],
];

const SAFE = new Set(START_INDEX);

export type Token =
  | { where: "yard" }
  | { where: "track"; index: number }
  | { where: "home"; step: number }
  | { where: "done" };

export type LudoState = {
  players: number;
  tokens: Token[][];
  current: number;
  phase: "roll" | "move";
  dice: number | null;
  sixes: number;
  winner: number | null;
  lastCapture: boolean;
};

export function seatColour(player: number, total: number) {
  if (total === 2) return player === 0 ? 0 : 2;
  return player;
}

export function createLudo(players = 4): LudoState {
  return {
    players,
    tokens: Array.from({ length: players }, () =>
      Array.from({ length: 4 }, () => ({ where: "yard" as const })),
    ),
    current: 0,
    phase: "roll",
    dice: null,
    sixes: 0,
    winner: null,
    lastCapture: false,
  };
}

function startOf(state: LudoState, player: number) {
  return START_INDEX[seatColour(player, state.players)];
}

export function destination(token: Token, steps: number, start: number): Token | null {
  if (token.where === "done") return null;
  if (token.where === "yard") {
    if (steps !== 6) return null;
    return { where: "track", index: start };
  }
  if (token.where === "home") {
    const dest = token.step + steps;
    if (dest < 5) return { where: "home", step: dest };
    if (dest === 5) return { where: "done" };
    return null;
  }
  const travelled = (token.index - start + 52) % 52;
  const left = 51 - travelled;
  if (steps <= left) return { where: "track", index: (token.index + steps) % 52 };
  const homeIndex = steps - left - 1;
  if (homeIndex < 5) return { where: "home", step: homeIndex };
  if (homeIndex === 5) return { where: "done" };
  return null;
}

function cloneTokens(tokens: Token[][]) {
  return tokens.map((row) => row.map((token) => ({ ...token })));
}

export function legalTokens(state: LudoState) {
  if (state.phase !== "move" || state.dice == null || state.winner != null) return [];
  const start = startOf(state, state.current);
  const found: number[] = [];
  state.tokens[state.current].forEach((token, index) => {
    if (destination(token, state.dice as number, start)) found.push(index);
  });
  return found;
}

function pass(state: LudoState): LudoState {
  return {
    ...state,
    current: (state.current + 1) % state.players,
    phase: "roll",
    dice: null,
    sixes: 0,
    lastCapture: false,
  };
}

export function roll(state: LudoState, value: number): LudoState {
  if (state.phase !== "roll" || state.winner != null) return state;
  if (value < 1 || value > 6) return state;
  if (value === 6) {
    const sixes = state.sixes + 1;
    if (sixes >= 3) return pass({ ...state, sixes: 0, dice: null, phase: "roll" });
    const next = { ...state, dice: 6, sixes, phase: "move" as const, lastCapture: false };
    if (legalTokens(next).length === 0) return pass(next);
    return next;
  }
  const next = { ...state, dice: value, sixes: 0, phase: "move" as const, lastCapture: false };
  if (legalTokens(next).length === 0) return pass(next);
  return next;
}

export function move(state: LudoState, tokenIndex: number): LudoState {
  if (!legalTokens(state).includes(tokenIndex) || state.dice == null) return state;
  const player = state.current;
  const start = startOf(state, player);
  const landed = destination(state.tokens[player][tokenIndex], state.dice, start);
  if (!landed) return state;
  const tokens = cloneTokens(state.tokens);
  tokens[player][tokenIndex] = landed;
  let lastCapture = false;
  if (landed.where === "track" && !SAFE.has(landed.index)) {
    tokens.forEach((row, owner) => {
      if (owner === player) return;
      row.forEach((token, index) => {
        if (token.where === "track" && token.index === landed.index) {
          tokens[owner][index] = { where: "yard" };
          lastCapture = true;
        }
      });
    });
  }
  const won = tokens[player].every((token) => token.where === "done");
  const withSix = state.dice === 6;
  const base: LudoState = { ...state, tokens, lastCapture, dice: null };
  if (won) return { ...base, winner: player, phase: "roll", sixes: 0 };
  if (withSix) return { ...base, phase: "roll" };
  return { ...pass(base), lastCapture };
}

export function botToken(state: LudoState) {
  const options = legalTokens(state);
  if (options.length === 0) return null;
  let best = options[0];
  let bestScore = -1;
  for (const option of options) {
    const next = move(state, option);
    const token = next.tokens[state.current][option];
    let score = next.lastCapture ? 100 : 0;
    if (token.where === "done") score += 80;
    if (token.where === "home") score += 40 + token.step;
    if (token.where === "track") score += 10;
    if (token.where === "yard") score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

export function tokenCell(state: LudoState, player: number, tokenIndex: number) {
  const colour = seatColour(player, state.players);
  const token = state.tokens[player][tokenIndex];
  if (token.where === "yard") return YARD[colour][tokenIndex];
  if (token.where === "track") return PATH[token.index];
  if (token.where === "home") return HOME[colour][token.step];
  return null;
}

export const CloserLudo: Game<LudoState> = {
  name: "closer-ludo",
  minPlayers: 2,
  maxPlayers: 4,
  setup: ({ ctx }) => createLudo(ctx.numPlayers),
  moves: {
    rollDice({ G, random, playerID }) {
      if (playerID !== String(G.current)) return INVALID_MOVE;
      return roll(G, random.D6());
    },
    moveToken({ G, playerID }, tokenIndex: number) {
      if (playerID !== String(G.current)) return INVALID_MOVE;
      const next = move(G, tokenIndex);
      if (next === G) return INVALID_MOVE;
      return next;
    },
  },
  endIf: ({ G }) => (G.winner == null ? undefined : { winner: G.winner }),
};
