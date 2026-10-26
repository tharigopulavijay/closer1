import { PEOPLE } from "../../mocks/people";
import { daysBetween, istDate, istMonth } from "../../lib/time";
import type { Intent, Person, ShowMe, Streak } from "../../lib/types";

export type Prefs = {
  intent: Intent;
  showMe: ShowMe;
  gender: "woman" | "man" | "nonbinary" | "";
  areas: string[];
  languages: string[];
  ageMin: number;
  ageMax: number;
  foods: string[];
  interests: string[];
};

export function intentCompatible(a: Intent, b: Intent) {
  if (a === "both" || b === "both") return true;
  return a === b;
}

function wantsGender(show: ShowMe, gender: Person["gender"]) {
  if (show === "everyone") return true;
  if (show === "women") return gender === "woman";
  return gender === "man";
}

export function hiddenByContacts(person: Person, viewerHash: string) {
  if (!viewerHash || !person.hideFromContacts) return false;
  if (!person.contactHashes.includes(viewerHash)) return false;
  return !person.allowHashes.includes(viewerHash);
}

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function eligiblePeople(
  people: Person[],
  prefs: Prefs,
  opts: { viewerHash: string; blocked: string[]; banned: string[]; now: Date },
) {
  return people.filter((person) => {
    if (!person.verified) return false;
    if (opts.blocked.includes(person.id) || opts.banned.includes(person.id)) return false;
    if (person.age < prefs.ageMin || person.age > prefs.ageMax) return false;
    if (prefs.areas.length > 0 && !prefs.areas.includes(person.area)) return false;
    if (!intentCompatible(prefs.intent, person.intent)) return false;
    if (!wantsGender(prefs.showMe, person.gender)) return false;
    if (prefs.gender && !wantsGender(person.showMe, prefs.gender)) return false;
    if (
      prefs.foods.length > 0 &&
      !prefs.foods.includes("Anything") &&
      person.food !== "Anything" &&
      !prefs.foods.includes(person.food)
    ) {
      return false;
    }
    if (hiddenByContacts(person, opts.viewerHash)) return false;
    return true;
  });
}

export function selectDrop(
  people: Person[],
  prefs: Prefs,
  dropDate: string,
  opts: { viewerHash: string; blocked: string[]; banned: string[]; now: Date; away: boolean; paused: boolean },
) {
  if (opts.away || opts.paused) return [];
  const pool = eligiblePeople(people, prefs, opts);
  const ranked = pool
    .map((person) => {
      const sharedInterests = person.interests.filter((item) => prefs.interests.includes(item)).length;
      const sharedLanguages = person.languages.filter((item) => prefs.languages.includes(item)).length;
      const days = Math.max(0, (opts.now.getTime() - Date.parse(person.lastActive)) / 86_400_000);
      const recency = Math.max(0, 10 - days);
      const jitter = hashString(`${person.id}:${dropDate}`) % 5;
      return { person, score: sharedInterests * 5 + sharedLanguages * 3 + recency + jitter };
    })
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
  return ranked.slice(0, 3).map((row) => row.person);
}

export function previewPrefs(): Prefs {
  return {
    intent: "both",
    showMe: "everyone",
    gender: "woman",
    areas: [],
    languages: ["English", "Hindi", "Telugu"],
    ageMin: 23,
    ageMax: 36,
    foods: ["Anything"],
    interests: ["Irani chai", "Film photography", "Old City walks", "Tollywood", "Cooking"],
  };
}

export const ALL_PEOPLE = PEOPLE;

export function recordActivity(streak: Streak, now: Date, away: boolean) {
  const month = istMonth(now);
  const freezesLeft = streak.freezeMonth === month ? streak.freezesLeft : 2;
  const base = { ...streak, freezesLeft, freezeMonth: month };
  if (away || streak.frozenByAway) {
    return { streak: { ...base, frozenByAway: true }, gained: false as const };
  }
  const today = istDate(now);
  if (base.lastDate === today) {
    return { streak: { ...base, frozenByAway: false }, gained: false as const };
  }
  if (base.lastDate == null) {
    const count = Math.max(1, base.count);
    return {
      streak: { ...base, count, lastDate: today, frozenByAway: false },
      gained: base.count === 0,
    };
  }
  const gap = daysBetween(base.lastDate, today);
  if (gap === 1) {
    return {
      streak: { ...base, count: base.count + 1, lastDate: today, frozenByAway: false },
      gained: true as const,
    };
  }
  return {
    streak: { ...base, count: 1, lastDate: today, frozenByAway: false },
    gained: true as const,
  };
}

export function applyFreeze(streak: Streak, now: Date) {
  if (streak.freezesLeft <= 0 || !streak.lastDate) return null;
  const today = istDate(now);
  if (daysBetween(streak.lastDate, today) !== 2) return null;
  const yesterday = istDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return { ...streak, freezesLeft: streak.freezesLeft - 1, lastDate: yesterday };
}
