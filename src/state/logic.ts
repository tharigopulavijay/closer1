import { VENUES } from "../mocks/catalog";
import { personById } from "../mocks/people";
import { applyFreeze, previewPrefs, recordActivity } from "../features/drop/api";
import { canCreatePlan } from "../features/plans/api";
import { canConfirmStrike, moderateMessage, sosTrigger } from "../features/safety/api";
import { istDate, istMonth } from "../lib/time";
import {
  emptyDraft,
  type AppState,
  type Audit,
  type Away,
  type ChatMessage,
  type Debrief,
  type Draft,
  type Plan,
  type PlanKind,
  type Report,
  type Room,
  type AdminRole,
  type DisplayMode,
} from "../lib/types";

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const SAMPLE_ROOMS: Room[] = [
  {
    id: "late-chai",
    title: "Late chai and nothing serious",
    host: "Meher",
    listeners: 18,
    speakers: 4,
    topic: "The best Irani chai still open",
    live: true,
    scheduled: null,
    ai: true,
  },
  {
    id: "tollywood",
    title: "Sunday Tollywood",
    host: "Saanvi",
    listeners: 42,
    speakers: 6,
    topic: "Was that ending fair?",
    live: true,
    scheduled: null,
    ai: true,
    flag: "Raised voices for 20s",
  },
  {
    id: "old-city",
    title: "Old City walks",
    host: "Imran",
    listeners: 9,
    speakers: 3,
    topic: "After the shops close",
    live: true,
    scheduled: null,
    ai: true,
  },
  {
    id: "friday",
    title: "New in Gachibowli",
    host: "Rohan",
    listeners: 0,
    speakers: 1,
    topic: "Introduce yourself in one minute",
    live: false,
    scheduled: "Friday · 8:00 pm",
    ai: true,
  },
];

function sampleReport(): Report {
  return {
    id: "report_sample",
    at: "2026-10-12T18:40:00.000Z",
    fromName: "N. Reddy",
    againstName: "S. Malik",
    category: "Money request",
    severe: true,
    detail: "Asked for a UPI transfer before agreeing to meet.",
    evidence: [
      "S. Malik · 12 Oct 2026, 6:12 pm: send me something on gpay and then we can meet",
      "N. Reddy · 12 Oct 2026, 6:14 pm: I don't send money to people I haven't met",
    ],
    status: "open",
    sample: true,
  };
}

export function blankState(now = new Date()): AppState {
  return {
    version: 1,
    ready: false,
    preview: false,
    draft: emptyDraft(),
    likes: [],
    skips: [],
    matches: [],
    friends: [],
    blocks: [],
    plans: [],
    messages: {},
    debriefs: [],
    away: null,
    streak: {
      count: 0,
      lastDate: null,
      freezesLeft: 2,
      freezeMonth: istMonth(now),
      frozenByAway: false,
      giftsClaimed: [],
    },
    paused: false,
    discreet: false,
    displayMode: "photo",
    coins: 40,
    plus: null,
    saathiMinutes: 0,
    giftClaim: null,
    trusted: [],
    checkInterval: 60,
    sessions: [],
    sos: [],
    reports: [sampleReport()],
    strikes: [],
    bans: [],
    myStrikes: [],
    rooms: SAMPLE_ROOMS,
    endedRooms: [],
    tableSeat: false,
    audit: [],
    adminRole: "safety",
    deletedAt: null,
    flags: 0,
  };
}

export function previewState(now = new Date()): AppState {
  const state = blankState(now);
  const bookedAt = now.toISOString();
  const coffee: Plan = {
    id: "plan_coffee",
    personId: "meher",
    venueId: "heartcup",
    slot: "Sat · 8:00 pm",
    kind: "coffee",
    status: "upcoming",
    deposit: "paid",
    bookedAt,
    createdAt: bookedAt,
    keptByMe: false,
    keptByThem: true,
    closedKindly: false,
    sample: true,
  };
  const past: Plan = {
    id: "plan_past",
    personId: "karthik",
    venueId: "niloufer",
    slot: "Sun · 11:00 am",
    kind: "coffee",
    status: "past",
    deposit: "refunded",
    bookedAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
    createdAt: new Date(now.getTime() - 12 * 86400000).toISOString(),
    keptByMe: false,
    keptByThem: false,
    closedKindly: false,
    sample: true,
  };
  return {
    ...state,
    ready: true,
    preview: true,
    draft: {
      ...emptyDraft(),
      step: "ready",
      phone: "+919000000111",
      phoneHash: "preview",
      otpVerified: true,
      name: "Aisha Khan",
      dob: "1998-04-12",
      gender: "woman",
      showMe: "everyone",
      intent: "both",
      selfieDone: true,
      photoCount: 3,
      languages: previewPrefs().languages,
      foods: ["Anything"],
      interests: previewPrefs().interests,
      ageMin: 23,
      ageMax: 36,
      areas: [],
      notifications: true,
      completed: true,
      freeSlots: ["Fri · 7:30 pm", "Sat · 8:00 pm", "Sun · 11:00 am"],
    },
    matches: ["meher"],
    plans: [coffee, past],
    messages: {
      plan_coffee: [
        { id: "m1", from: "them", text: "Heart Cup is quiet after 8. I'll take the table by the window.", at: bookedAt },
        { id: "m2", from: "me", text: "I'll be there. I'll wear a marigold scarf so you don't have to guess.", at: bookedAt },
      ],
    },
    streak: {
      count: 23,
      lastDate: istDate(now),
      freezesLeft: 2,
      freezeMonth: istMonth(now),
      frozenByAway: false,
      giftsClaimed: [7],
    },
    coins: 120,
    saathiMinutes: 12,
    trusted: [
      { id: "tc1", name: "Fatima Khan", phone: "+919000000010", confirmed: true },
      { id: "tc2", name: "Rahul Menon", phone: "+919000000011", confirmed: true },
    ],
  };
}

function audit(state: AppState, action: string, detail: string, now: Date): Audit {
  return { id: uid("audit"), at: now.toISOString(), role: state.adminRole, action, detail };
}

export function saveDraft(state: AppState, patch: Partial<Draft>): AppState {
  return { ...state, draft: { ...state.draft, ...patch } };
}

export function completeOnboarding(state: AppState): AppState {
  return { ...state, ready: true, preview: false, draft: { ...state.draft, completed: true, step: "ready" } };
}

export function enterPreview(now = new Date()) {
  return previewState(now);
}

export function openDrop(state: AppState, now = new Date()) {
  const activity = recordActivity(state.streak, now, Boolean(state.away) || state.paused);
  return { ...state, streak: activity.streak };
}

export function freezeStreak(state: AppState, now = new Date()) {
  const next = applyFreeze(state.streak, now);
  if (!next) return state;
  return { ...state, streak: next };
}

export function likePerson(
  state: AppState,
  personId: string,
  note: string,
  highlights: string[],
  now = new Date(),
) {
  const person = personById(personId);
  if (!person?.verified || state.blocks.includes(personId)) {
    return { state, matched: false };
  }
  if (state.likes.some((like) => like.personId === personId)) {
    return { state, matched: state.matches.includes(personId) };
  }
  const likes = [...state.likes, { personId, note, highlights, at: now.toISOString() }];
  const matched = person.likesYou && !state.matches.includes(personId);
  return {
    state: {
      ...state,
      likes,
      skips: state.skips.filter((id) => id !== personId),
      matches: matched ? [...state.matches, personId] : state.matches,
    },
    matched,
  };
}

export function skipPerson(state: AppState, personId: string) {
  if (state.skips.includes(personId)) return state;
  return { ...state, skips: [...state.skips, personId] };
}

export function bookPlan(
  state: AppState,
  input: { personId: string; venueId: string; slot: string; kind: PlanKind },
  now = new Date(),
) {
  if (!state.matches.includes(input.personId)) {
    return { state, error: "A plan starts from a mutual like.", planId: "" };
  }
  if (state.plans.some((plan) => plan.personId === input.personId && plan.status === "upcoming")) {
    return { state, error: "You already have an open plan with them.", planId: "" };
  }
  if (!canCreatePlan(state.plans, Boolean(state.plus))) {
    return { state, error: state.plus ? "Four open plans is the Closer+ limit." : "Three open plans is the limit.", planId: "" };
  }
  const plan: Plan = {
    id: uid("plan"),
    personId: input.personId,
    venueId: input.venueId,
    slot: input.slot,
    kind: input.kind,
    status: "upcoming",
    deposit: "unpaid",
    bookedAt: null,
    createdAt: now.toISOString(),
    keptByMe: false,
    keptByThem: false,
    closedKindly: false,
  };
  return { state: { ...state, plans: [plan, ...state.plans] }, error: "", planId: plan.id };
}

export function payDeposit(state: AppState, planId: string, now = new Date()) {
  return {
    ...state,
    plans: state.plans.map((plan) =>
      plan.id === planId ? { ...plan, deposit: "paid" as const, bookedAt: plan.bookedAt ?? now.toISOString() } : plan,
    ),
  };
}

export function sendMessage(state: AppState, planId: string, text: string, now = new Date()) {
  const body = text.trim();
  const plan = state.plans.find((item) => item.id === planId);
  const person = plan ? personById(plan.personId) : undefined;
  if (!body || !plan) return { state, status: "blocked" as const, severity: "minor" as const, rule: "Empty" };
  const verdict = moderateMessage(body);
  if (verdict.severity !== "ok") {
    const flags = state.flags + 1;
    const reports = [...state.reports];
    if (verdict.severity === "severe" || flags >= 3) {
      reports.unshift({
        id: uid("report"),
        at: now.toISOString(),
        fromName: "Moderation",
        againstName: state.draft.name || "You",
        category: verdict.rule,
        severe: verdict.severity === "severe",
        detail: "Stopped before delivery.",
        evidence: [`${state.draft.name || "You"} · ${body}`],
        status: "open",
      });
    }
    return {
      state: { ...state, flags, reports },
      status: "blocked" as const,
      severity: verdict.severity,
      rule: verdict.rule,
    };
  }
  const message: ChatMessage = { id: uid("msg"), from: "me", text: body, at: now.toISOString() };
  const thread = [...(state.messages[planId] ?? []), message];
  return {
    state: { ...state, messages: { ...state.messages, [planId]: thread } },
    status: "sent" as const,
    severity: "ok" as const,
    rule: "",
    personName: person?.name ?? "",
  };
}

export function keepChat(state: AppState, planId: string) {
  return {
    ...state,
    plans: state.plans.map((plan) => (plan.id === planId ? { ...plan, keptByMe: true } : plan)),
  };
}

export function closeKindly(state: AppState, planId: string, now = new Date()) {
  const thread = [
    ...(state.messages[planId] ?? []),
    {
      id: uid("msg"),
      from: "system" as const,
      text: "Closed kindly. Wishing you a good week.",
      at: now.toISOString(),
    },
  ];
  return {
    ...state,
    messages: { ...state.messages, [planId]: thread },
    plans: state.plans.map((plan) =>
      plan.id === planId ? { ...plan, status: "closed" as const, closedKindly: true } : plan,
    ),
  };
}

export function submitDebrief(state: AppState, debrief: Debrief) {
  return {
    ...state,
    debriefs: [...state.debriefs.filter((item) => item.planId !== debrief.planId), debrief],
    plans: state.plans.map((plan) => (plan.id === debrief.planId ? { ...plan, status: "past" as const } : plan)),
  };
}

export function setAway(state: AppState, away: Away) {
  return {
    ...state,
    away,
    streak: { ...state.streak, frozenByAway: true },
  };
}

export function clearAway(state: AppState) {
  return { ...state, away: null, streak: { ...state.streak, frozenByAway: false } };
}

export function addTrusted(state: AppState, name: string, phone: string) {
  if (state.trusted.length >= 5) return state;
  return {
    ...state,
    trusted: [...state.trusted, { id: uid("tc"), name, phone, confirmed: false }],
  };
}

export function confirmTrusted(state: AppState, id: string) {
  return {
    ...state,
    trusted: state.trusted.map((contact) => (contact.id === id ? { ...contact, confirmed: true } : contact)),
  };
}

export function setCheckInterval(state: AppState, checkInterval: 30 | 60 | 90) {
  return { ...state, checkInterval };
}

export function checkIn(
  state: AppState,
  planId: string,
  coords: { lat: number; lng: number } | null,
  now = new Date(),
) {
  const existing = state.sessions.find((session) => session.planId === planId);
  const next = {
    planId,
    intervalMin: state.checkInterval,
    checkedInAt: now.toISOString(),
    promptAt: now.toISOString(),
    answeredAt: null,
    sharing: existing?.sharing ?? false,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    callPlaced: false,
    helpRequested: false,
  };
  return {
    ...state,
    sessions: [...state.sessions.filter((session) => session.planId !== planId), next],
  };
}

export function setSharing(state: AppState, planId: string, sharing: boolean) {
  return {
    ...state,
    sessions: state.sessions.map((session) => (session.planId === planId ? { ...session, sharing } : session)),
  };
}

export function markCheckCall(state: AppState, planId: string) {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.planId === planId ? { ...session, callPlaced: true } : session,
    ),
  };
}

export function answerCheck(state: AppState, planId: string, ok: boolean, now = new Date()) {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.planId === planId
        ? { ...session, answeredAt: ok ? now.toISOString() : session.answeredAt, helpRequested: ok ? false : true }
        : session,
    ),
  };
}

export function triggerSos(
  state: AppState,
  planId: string | null,
  coords: { lat: number | null; lng: number | null },
  now = new Date(),
) {
  const contacts = state.trusted.filter((contact) => contact.confirmed).map((contact) => contact.name);
  const result = sosTrigger({ lat: coords.lat, lng: coords.lng, contacts });
  return {
    ...state,
    sos: [
      {
        id: uid("sos"),
        at: now.toISOString(),
        planId,
        lat: coords.lat,
        lng: coords.lng,
        alerted: result.alerted,
      },
      ...state.sos,
    ],
  };
}

export function fileReport(
  state: AppState,
  input: { againstName: string; category: string; severe: boolean; detail: string },
  now = new Date(),
) {
  const report: Report = {
    id: uid("report"),
    at: now.toISOString(),
    fromName: state.draft.name || "You",
    againstName: input.againstName,
    category: input.category,
    severe: input.severe,
    detail: input.detail,
    evidence: [input.detail],
    status: "open",
  };
  return { ...state, reports: [report, ...state.reports] };
}

export function appealStrike(state: AppState, id: string, appeal: string) {
  return {
    ...state,
    myStrikes: state.myStrikes.map((strike) => (strike.id === id ? { ...strike, appeal } : strike)),
    strikes: state.strikes.map((strike) => (strike.id === id ? { ...strike, appeal } : strike)),
  };
}

export function adminAct(
  state: AppState,
  reportId: string,
  action: "confirm" | "dismiss" | "ban" | "escalate",
  now = new Date(),
) {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report || report.status !== "open") return { state, error: "That report is already closed." };
  if ((action === "confirm" || action === "ban") && !canConfirmStrike(state.adminRole)) {
    return { state, error: "Only the safety role can confirm a strike or a ban." };
  }
  if (action === "dismiss") {
    return {
      state: {
        ...state,
        reports: state.reports.map((item) => (item.id === reportId ? { ...item, status: "dismissed" as const } : item)),
        audit: [audit(state, "Dismiss report", report.againstName, now), ...state.audit],
      },
      error: "",
    };
  }
  if (action === "escalate") {
    return {
      state: {
        ...state,
        reports: state.reports.map((item) => (item.id === reportId ? { ...item, status: "escalated" as const } : item)),
        audit: [audit(state, "Escalate report", report.againstName, now), ...state.audit],
      },
      error: "",
    };
  }
  const prior = state.strikes.filter((strike) => strike.againstName === report.againstName).length;
  const shouldBan = action === "ban" || report.severe || prior + 1 >= 3;
  const strike = {
    id: uid("strike"),
    reportId,
    at: now.toISOString(),
    againstName: report.againstName,
    category: report.category,
    severe: report.severe,
    appeal: "",
  };
  return {
    state: {
      ...state,
      strikes: [...state.strikes, strike],
      bans: shouldBan ? [...state.bans, report.againstName] : state.bans,
      reports: state.reports.map((item) =>
        item.id === reportId ? { ...item, status: shouldBan ? ("banned" as const) : ("strike" as const) } : item,
      ),
      audit: [
        audit(state, shouldBan ? "Confirm ban" : "Confirm strike", `${report.againstName} · ${report.category}`, now),
        ...state.audit,
      ],
    },
    error: "",
  };
}

export function endRoom(state: AppState, roomId: string, now = new Date()) {
  if (state.adminRole === "finance") return state;
  const room = state.rooms.find((item) => item.id === roomId);
  return {
    ...state,
    endedRooms: [...state.endedRooms, roomId],
    audit: [audit(state, "End room", room?.title ?? roomId, now), ...state.audit],
  };
}

export function setRole(state: AppState, adminRole: AdminRole) {
  return { ...state, adminRole };
}

export function purchasePlan(state: AppState, tier: "month" | "quarter", now = new Date()) {
  return { ...state, plus: { tier, since: now.toISOString() } };
}

export function claimGift(state: AppState, milestone: number, gift: string, address: string, now = new Date()) {
  if (state.streak.count < milestone || state.streak.giftsClaimed.includes(milestone)) return state;
  if (!address.trim()) return state;
  return {
    ...state,
    streak: { ...state.streak, giftsClaimed: [...state.streak.giftsClaimed, milestone] },
    giftClaim: { milestone, gift, address: address.trim(), at: now.toISOString() },
  };
}

export function spendSaathiMinute(state: AppState) {
  if (state.saathiMinutes <= 0) return state;
  return { ...state, saathiMinutes: state.saathiMinutes - 1 };
}

export function rechargeSaathi(state: AppState, minutes: number) {
  return { ...state, saathiMinutes: state.saathiMinutes + minutes };
}

export function spendCoins(state: AppState, amount: number, _reason: string) {
  if (state.coins < amount) return { state, ok: false as const };
  return { state: { ...state, coins: state.coins - amount }, ok: true as const };
}

export function finishGame(state: AppState, now = new Date()) {
  const activity = recordActivity(state.streak, now, Boolean(state.away));
  return { ...state, streak: activity.streak };
}

export function addFriend(state: AppState, personId: string) {
  if (state.friends.includes(personId)) return state;
  return { ...state, friends: [...state.friends, personId] };
}

export function blockPerson(state: AppState, personId: string) {
  return {
    ...state,
    blocks: state.blocks.includes(personId) ? state.blocks : [...state.blocks, personId],
    matches: state.matches.filter((id) => id !== personId),
  };
}

export function setPaused(state: AppState, paused: boolean) {
  return { ...state, paused };
}

export function setDiscreet(state: AppState, discreet: boolean) {
  return { ...state, discreet };
}

export function setDisplayMode(state: AppState, displayMode: DisplayMode) {
  return { ...state, displayMode };
}

export function deleteAccount(state: AppState, now = new Date()) {
  return { ...state, deletedAt: now.toISOString(), ready: false, paused: true };
}

export function restoreAccount(state: AppState) {
  return { ...state, deletedAt: null, ready: state.draft.completed, paused: false };
}

export function joinTable(state: AppState) {
  return { ...state, tableSeat: true };
}

export function createRoom(state: AppState, room: Omit<Room, "listeners" | "speakers" | "live" | "ai"> & { ai?: boolean }) {
  return {
    ...state,
    rooms: [
      {
        listeners: 0,
        speakers: 1,
        live: true,
        ai: room.ai ?? true,
        ...room,
      },
      ...state.rooms,
    ],
  };
}

export function venueList() {
  return VENUES;
}
