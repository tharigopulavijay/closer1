const IST_MS = 5.5 * 60 * 60 * 1000;

export function istParts(now: Date) {
  const shifted = new Date(now.getTime() + IST_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
    ss: shifted.getUTCSeconds(),
  };
}

export function istDate(now: Date) {
  const p = istParts(now);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function istMonth(now: Date) {
  const p = istParts(now);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}`;
}

export function addDays(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Next 21:00 in Asia/Kolkata, strictly after `now` if that instant has passed. */
export function nextDropAt(now: Date) {
  const p = istParts(now);
  let target = Date.UTC(p.y, p.m, p.d, 21, 0, 0) - IST_MS;
  if (now.getTime() >= target) {
    target = Date.UTC(p.y, p.m, p.d + 1, 21, 0, 0) - IST_MS;
  }
  return new Date(target);
}

/** The drop currently on screen was generated at the most recent 21:00 IST. */
export function currentDropDate(now: Date) {
  const prev = new Date(nextDropAt(now).getTime() - 24 * 60 * 60 * 1000);
  return istDate(prev);
}

export function formatRemain(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatIstDay(now: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(now);
}

export function daysBetween(earlierIso: string, laterIso: string) {
  const a = Date.parse(`${earlierIso}T00:00:00Z`);
  const b = Date.parse(`${laterIso}T00:00:00Z`);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
