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

export function isAdultDob(dob: string, now = new Date()) {
  const [year, month, day] = istDate(now).split("-").map(Number);
  const cutoff = `${(year ?? 0) - 18}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dob <= cutoff;
}
