export type ModerationRule = (body: string) => string | null;

const BLOCKED_WORDS = /\b(fuck|fucking|shit|bitch|slut|whore|rape|chutiya|madarchod|behenchod)\b/i;
const UPI = /\b[\w.\-]{2,}@(okaxis|okhdfcbank|okicici|oksbi|ybl|paytm|upi|ibl|axl|apl|fbl)\b/i;
const LINK = /https?:\/\/|www\./i;

const defaultRules: ModerationRule[] = [
  (body) => (BLOCKED_WORDS.test(body) ? "blocked word" : null),
  // Ten digits in a row, allowing spaces, dots or dashes between them. Counting every
  // digit in the message blocked ordinary lines like "7:30 on 12/11/2026".
  (body) => (/(?:\+?\d[\s.\-]{0,2}){10,}/.test(body) ? "phone" : null),
  (body) => (UPI.test(body) ? "upi" : null),
  (body) => (LINK.test(body) ? "link" : null),
];

let rules = defaultRules;

export function setModerationRules(next: ModerationRule[]) {
  rules = next;
}

export function resetModerationRules() {
  rules = defaultRules;
}

export function moderate(body: string) {
  for (const rule of rules) {
    const reason = rule(body);
    if (reason) return { ok: false as const, reason };
  }
  return { ok: true as const, reason: "" };
}
