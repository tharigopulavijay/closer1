export function istDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function istMonth(now = new Date()) {
  return istDate(now).slice(0, 7);
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(earlier: string, later: string) {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istParts(now: Date) {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return parts;
}

function istWallToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour, minute) - (5 * 60 + 30) * 60 * 1000;
}

export function slotInstant(slot: string, createdAt: string) {
  const trimmed = slot.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const direct = Date.parse(trimmed);
    return Number.isNaN(direct) ? null : direct;
  }
  const match = trimmed.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s*[·.\-]\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  const want = WEEKDAYS.findIndex((day) => day.toLowerCase() === match[1].toLowerCase());
  let hour = Number(match[2]) % 12;
  if (match[4].toLowerCase() === "pm") hour += 12;
  const minute = Number(match[3]);
  const created = istParts(new Date(createdAt));
  const start = Date.UTC(Number(created.year), Number(created.month) - 1, Number(created.day));
  const createdMs = Date.parse(createdAt);
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(start + offset * 86_400_000);
    const parts = istParts(day);
    if (WEEKDAYS.findIndex((name) => name === parts.weekday) !== want) continue;
    const at = istWallToUtc(Number(parts.year), Number(parts.month), Number(parts.day), hour, minute);
    if (at >= createdMs) return at;
  }
  return null;
}

export function ageYears(dob: string, onDate: string) {
  const [year, month, day] = dob.split("-").map(Number);
  const [onYear, onMonth, onDay] = onDate.split("-").map(Number);
  let age = (onYear ?? 0) - (year ?? 0);
  if ((onMonth ?? 0) < (month ?? 0) || ((onMonth ?? 0) === (month ?? 0) && (onDay ?? 0) < (day ?? 0))) age -= 1;
  return age;
}

export function isAdultDob(dob: string, now = new Date()) {
  const [year, month, day] = istDate(now).split("-").map(Number);
  const cutoff = `${(year ?? 0) - 18}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dob <= cutoff;
}
