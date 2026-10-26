const SEVERE: { phrase: string; rule: string }[] = [
  { phrase: "send nudes", rule: "Nudes" },
  { phrase: "nude pic", rule: "Nudes" },
  { phrase: "dick pic", rule: "Nudes" },
  { phrase: "nude bhej", rule: "Nudes" },
  { phrase: "nanga photo", rule: "Nudes" },
  { phrase: "i will kill", rule: "Threats" },
  { phrase: "kill you", rule: "Threats" },
  { phrase: "maar dalunga", rule: "Threats" },
  { phrase: "jaan se maar", rule: "Threats" },
  { phrase: "send money", rule: "Money request" },
  { phrase: "gpay", rule: "Money request" },
  { phrase: "phonepe", rule: "Money request" },
  { phrase: "paytm", rule: "Money request" },
  { phrase: "upi id", rule: "Money request" },
  { phrase: "bank account", rule: "Money request" },
  { phrase: "account number", rule: "Money request" },
  { phrase: "paisa bhej", rule: "Money request" },
  { phrase: "paise bhejo", rule: "Money request" },
  { phrase: "dabbulu pampu", rule: "Money request" },
  { phrase: "డబ్బులు పంపు", rule: "Money request" },
  { phrase: "i am 17", rule: "Under 18" },
  { phrase: "i'm 17", rule: "Under 18" },
  { phrase: "i am 16", rule: "Under 18" },
  { phrase: "i'm 16", rule: "Under 18" },
  { phrase: "main 17", rule: "Under 18" },
  { phrase: "nenu 17", rule: "Under 18" },
];

const MINOR = ["idiot", "ugly", "stupid", "shut up"];

export type Moderation = {
  severity: "ok" | "minor" | "severe";
  rule: string;
};

export function moderateMessage(text: string): Moderation {
  const hay = text.toLowerCase();
  const severe = SEVERE.find((item) => hay.includes(item.phrase));
  if (severe) return { severity: "severe", rule: severe.rule };
  const minor = MINOR.find((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  if (minor) return { severity: "minor", rule: "Insult" };
  return { severity: "ok", rule: "" };
}

export function withinGeofence(
  user: { lat: number; lng: number },
  venue: { lat: number; lng: number },
  meters = 150,
) {
  const r = 6371000;
  const dLat = ((venue.lat - user.lat) * Math.PI) / 180;
  const dLng = ((venue.lng - user.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((user.lat * Math.PI) / 180) *
      Math.cos((venue.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distance = 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance <= meters;
}

export function escalationStage(elapsedMs: number, answered: boolean, helpRequested: boolean) {
  if (helpRequested) return "alerted" as const;
  if (answered) return "ok" as const;
  if (elapsedMs < 5 * 60 * 1000) return "waiting" as const;
  if (elapsedMs < 6 * 60 * 1000) return "calling" as const;
  return "alerted" as const;
}

export function canConfirmStrike(role: "safety" | "ops" | "finance") {
  return role === "safety";
}

export function canSeeAddress(role: "safety" | "ops" | "finance") {
  return role === "finance";
}

export function canSeeFees(role: "safety" | "ops" | "finance") {
  return role === "finance" || role === "ops";
}

/** Placeholder for the liveness vendor. The client never decides verification alone. */
export function verifySelfie() {
  return { ok: true, vendor: "pending" as const };
}

export function placeCheckCall() {
  return { ok: true, vendor: "pending" as const };
}

export function sosTrigger(input: { lat: number | null; lng: number | null; contacts: string[] }) {
  return {
    ok: true,
    alerted: input.contacts,
    opened: "tel:112" as const,
  };
}
