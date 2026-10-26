import { istParts } from "./time";

/** True when this date of birth is 18 or older on today's date in Asia/Kolkata. */
export function isAdult(dob: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return false;
  const born = new Date(Date.UTC(y, m - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== m - 1 || born.getUTCDate() !== d) {
    return false;
  }
  const today = istParts(now);
  const adultYear = y + 18;
  if (today.y !== adultYear) return today.y > adultYear;
  if (today.m + 1 !== m) return today.m + 1 > m;
  return today.d >= d;
}

export function maxDob(now = new Date()) {
  const today = istParts(now);
  return `${today.y - 18}-${String(today.m + 1).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
}
