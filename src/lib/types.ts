export type Gender = "woman" | "man" | "nonbinary";
export type Intent = "dating" | "friends" | "both";
export type ShowMe = "women" | "men" | "everyone";
export type Food = "Vegetarian" | "Eggetarian" | "Non-vegetarian" | "Jain" | "Anything";
export type PlanKind = "coffee" | "walk" | "dinner" | "gallery";
export type AdminRole = "safety" | "ops" | "finance";
export type DisplayMode = "photo" | "avatar" | "initials";

export type Person = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  showMe: ShowMe;
  intent: Intent;
  area: string;
  verified: boolean;
  languages: string[];
  food: string;
  bio: string;
  prompts: { q: string; a: string }[];
  voice: { prompt: string; seconds: number }[];
  interests: string[];
  vouches: number;
  palette: [string, string];
  freeSlots: string[];
  likesYou: boolean;
  hideFromContacts: boolean;
  contactHashes: string[];
  allowHashes: string[];
  lastActive: string;
};

export type Draft = {
  step: string;
  phone: string;
  phoneHash: string;
  otpVerified: boolean;
  name: string;
  dob: string;
  gender: Gender | "";
  showMe: ShowMe | "";
  intent: Intent | "";
  selfieDone: boolean;
  photoCount: number;
  mainPhoto: number;
  voices: { prompt: string; recorded: boolean; seconds: number }[];
  areas: string[];
  languages: string[];
  ageMin: number;
  ageMax: number;
  foods: string[];
  interests: string[];
  freeSlots: string[];
  hideFromContacts: boolean;
  contacts: { name: string; phone: string; allowed: boolean }[];
  contactHashes: string[];
  allowHashes: string[];
  notifications: boolean;
  completed: boolean;
};

export type Like = {
  personId: string;
  note: string;
  highlights: string[];
  at: string;
};

export type Plan = {
  id: string;
  personId: string;
  venueId: string;
  slot: string;
  kind: PlanKind;
  status: "upcoming" | "past" | "closed";
  deposit: "unpaid" | "paid" | "refunded";
  bookedAt: string | null;
  createdAt: string;
  keptByMe: boolean;
  keptByThem: boolean;
  closedKindly: boolean;
  sample?: boolean;
};

export type ChatMessage = {
  id: string;
  from: "me" | "them" | "system";
  text: string;
  at: string;
};

export type Away = {
  kind: "trip" | "busy" | "seeing";
  until: string | null;
  note: string;
};

export type Streak = {
  count: number;
  lastDate: string | null;
  freezesLeft: number;
  freezeMonth: string;
  frozenByAway: boolean;
  giftsClaimed: number[];
};

export type GiftClaim = {
  milestone: number;
  gift: string;
  address: string;
  at: string;
};

export type TrustedContact = {
  id: string;
  name: string;
  phone: string;
  confirmed: boolean;
};

export type SafetySession = {
  planId: string;
  intervalMin: 30 | 60 | 90;
  checkedInAt: string | null;
  promptAt: string | null;
  answeredAt: string | null;
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  callPlaced: boolean;
  helpRequested: boolean;
};

export type SosEvent = {
  id: string;
  at: string;
  planId: string | null;
  lat: number | null;
  lng: number | null;
  alerted: string[];
};

export type Report = {
  id: string;
  at: string;
  fromName: string;
  againstName: string;
  category: string;
  severe: boolean;
  detail: string;
  evidence: string[];
  status: "open" | "dismissed" | "strike" | "banned" | "escalated";
  sample?: boolean;
  appeal?: string;
};

export type Strike = {
  id: string;
  reportId: string;
  at: string;
  againstName: string;
  category: string;
  severe: boolean;
  appeal: string;
};

export type Debrief = {
  planId: string;
  feel: string;
  again: string;
  note: string;
};

export type Room = {
  id: string;
  title: string;
  host: string;
  listeners: number;
  speakers: number;
  topic: string;
  live: boolean;
  scheduled: string | null;
  ai: boolean;
  flag?: string;
};

export type Audit = {
  id: string;
  at: string;
  role: AdminRole;
  action: string;
  detail: string;
};

export type PlusPlan = {
  tier: "month" | "quarter";
  since: string;
};

export type AppState = {
  version: 1;
  ready: boolean;
  preview: boolean;
  draft: Draft;
  likes: Like[];
  skips: string[];
  matches: string[];
  friends: string[];
  blocks: string[];
  plans: Plan[];
  messages: Record<string, ChatMessage[]>;
  debriefs: Debrief[];
  away: Away | null;
  streak: Streak;
  paused: boolean;
  discreet: boolean;
  displayMode: DisplayMode;
  coins: number;
  plus: PlusPlan | null;
  saathiMinutes: number;
  giftClaim: GiftClaim | null;
  trusted: TrustedContact[];
  checkInterval: 30 | 60 | 90;
  sessions: SafetySession[];
  sos: SosEvent[];
  reports: Report[];
  strikes: Strike[];
  bans: string[];
  myStrikes: Strike[];
  rooms: Room[];
  endedRooms: string[];
  tableSeat: boolean;
  audit: Audit[];
  adminRole: AdminRole;
  deletedAt: string | null;
  flags: number;
};

export const VOICE_PROMPTS = [
  "The small Hyderabad place I keep going back to",
  "A green flag I trust",
  "What Sunday actually sounds like",
];

export const AREAS = [
  "Jubilee Hills",
  "Banjara Hills",
  "Gachibowli",
  "Madhapur",
  "Kondapur",
  "Hitech City",
  "Secunderabad",
  "Manikonda",
  "Kokapet",
  "Begumpet",
  "Financial District",
  "Old City",
];

export const LANGUAGES = ["Telugu", "Hindi", "English", "Urdu"];

export const FOODS: Food[] = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Jain", "Anything"];

export const SLOTS = [
  "Thu · 7:00 pm",
  "Fri · 7:30 pm",
  "Sat · 6:30 pm",
  "Sat · 8:00 pm",
  "Sun · 11:00 am",
  "Sun · 5:00 pm",
];

export const PLAN_KINDS: { id: PlanKind; label: string }[] = [
  { id: "coffee", label: "Coffee" },
  { id: "walk", label: "A walk" },
  { id: "dinner", label: "Dinner" },
  { id: "gallery", label: "A gallery" },
];

export const MILESTONES = [7, 30, 90, 180, 365];

export const SEVERE_CATEGORIES = [
  "Sexual harassment",
  "Threats",
  "Money request",
  "Nudes",
  "Under 18",
  "Impersonation",
];

export function emptyDraft(): Draft {
  return {
    step: "phone",
    phone: "",
    phoneHash: "",
    otpVerified: false,
    name: "",
    dob: "",
    gender: "",
    showMe: "",
    intent: "",
    selfieDone: false,
    photoCount: 0,
    mainPhoto: 0,
    voices: VOICE_PROMPTS.map((prompt) => ({ prompt, recorded: false, seconds: 0 })),
    areas: [],
    languages: [],
    ageMin: 23,
    ageMax: 36,
    foods: [],
    interests: [],
    freeSlots: ["Fri · 7:30 pm", "Sat · 8:00 pm"],
    hideFromContacts: true,
    contacts: [
      { name: "Amma", phone: "+919000000001", allowed: false },
      { name: "Arun from college", phone: "+919000000002", allowed: false },
      { name: "Office — Neha", phone: "+919000000003", allowed: false },
      { name: "Kabir", phone: "+919000000004", allowed: false },
    ],
    contactHashes: [],
    allowHashes: [],
    notifications: false,
    completed: false,
  };
}
