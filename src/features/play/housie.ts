export type Ticket = (number | null)[][];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const FALLBACK: boolean[][] = [
  [true, true, false, true, false, true, false, true, false],
  [false, true, true, false, true, false, true, false, true],
  [true, false, true, true, false, true, false, true, false],
];

function mask(rng: () => number) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const rows = [0, 1, 2].map(() => {
      const row = Array(9).fill(false);
      shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], rng)
        .slice(0, 5)
        .forEach((index) => {
          row[index] = true;
        });
      return row;
    });
    const sums = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((col) =>
      rows.reduce((sum, row) => sum + (row[col] ? 1 : 0), 0),
    );
    if (sums.every((count) => count >= 1 && count <= 3)) return rows;
  }
  return FALLBACK;
}

export function createTicket(seed: number): Ticket {
  const rng = mulberry32(seed);
  const chosen = mask(rng);
  const ticket: Ticket = [Array(9).fill(null), Array(9).fill(null), Array(9).fill(null)];
  for (let col = 0; col < 9; col += 1) {
    const start = col === 0 ? 1 : col * 10;
    const end = col === 8 ? 90 : col * 10 + 9;
    const pool = shuffle(
      Array.from({ length: end - start + 1 }, (_, index) => start + index),
      rng,
    );
    const rows = [0, 1, 2].filter((row) => chosen[row][col]);
    pool
      .slice(0, rows.length)
      .sort((a, b) => a - b)
      .forEach((value, index) => {
        ticket[rows[index]][col] = value;
      });
  }
  return ticket;
}

export function createCalls(seed: number) {
  return shuffle(
    Array.from({ length: 90 }, (_, index) => index + 1),
    mulberry32(seed),
  );
}

export type Claim = "early" | "top" | "middle" | "bottom" | "full";

export function claimOk(ticket: Ticket, called: number[], claim: Claim) {
  const marked = (value: number | null) => value != null && called.includes(value);
  const rowCount = (row: number) => ticket[row].filter(marked).length;
  if (claim === "top") return rowCount(0) === 5;
  if (claim === "middle") return rowCount(1) === 5;
  if (claim === "bottom") return rowCount(2) === 5;
  if (claim === "full") return [0, 1, 2].every((row) => rowCount(row) === 5);
  const all = ticket.flat().filter(marked).length;
  return all >= 5;
}
