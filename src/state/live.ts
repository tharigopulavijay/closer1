import { api, clearSession, setSession, wsUrl, type PublicProfile } from "../lib/api";
import { isLive } from "../lib/env";
import type { AppState, Person, Plan, PlanKind } from "../lib/types";
import { personById } from "../mocks/people";
import * as logic from "./logic";
import { withStatus } from "./status";

export { isLive };

export function mode(): "live" | "preview" {
  return isLive() ? "live" : "preview";
}

const people = new Map<string, Person>();
const photos = new Map<string, string>();
let dropIds: string[] = [];
let meId = "";
let verified = false;

/** Plans booked with an exact time arrive as ISO strings; show them the way the app writes slots. */
export function slotLabel(slot: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(slot)) return slot;
  const at = new Date(slot);
  if (Number.isNaN(at.getTime())) return slot;
  const day = at.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
  const time = at.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  return `${day} · ${time.toLowerCase()}`;
}

export function accountVerified() {
  return !isLive() || verified;
}

export function myId() {
  return meId;
}

export function personOf(id: string) {
  if (isLive()) return people.get(id);
  return personById(id);
}

export function faceOf(id: string) {
  return isLive() ? photos.get(id) : undefined;
}

export function dropPeople() {
  return dropIds.map((id) => people.get(id)).filter((person): person is Person => Boolean(person));
}

function asPerson(profile: PublicProfile): Person {
  return {
    id: profile.id,
    name: profile.displayName,
    age: profile.age ?? 18,
    gender: (profile.gender as Person["gender"]) || "nonbinary",
    showMe: "everyone",
    intent: (profile.intent as Person["intent"]) || "both",
    area: profile.area ?? "",
    verified: profile.verified,
    languages: [],
    food: "",
    bio: "",
    prompts: [],
    voice: [],
    interests: [],
    vouches: 0,
    palette: ["#3a2448", "#1a101f"],
    freeSlots: [],
    likesYou: people.get(profile.id)?.likesYou ?? false,
    hideFromContacts: false,
    contactHashes: [],
    allowHashes: [],
    lastActive: "",
  };
}

function remember(profile: PublicProfile | { id: string; visible: false } | null | undefined) {
  if (!profile || !("displayName" in profile)) return;
  people.set(profile.id, asPerson(profile));
}

async function rememberPhoto(personId: string, key: string | undefined) {
  if (!key || photos.has(personId)) return;
  try {
    const blob = await api.mediaBlob(key);
    photos.set(personId, URL.createObjectURL(blob));
  } catch {
    /* photo stays hidden when the policy refuses it */
  }
}

function plansFrom(rows: Awaited<ReturnType<typeof api.plans>>["plans"]): Plan[] {
  return rows.map((row) => {
    const partnerId = row.partner?.id ?? "";
    remember(row.partner);
    const mine = row.deposits.find((deposit) => deposit.userId === meId);
    const deposit = mine?.status === "paid" ? "paid" : mine?.status === "refunded" ? "refunded" : "unpaid";
    return {
      id: row.id,
      personId: partnerId,
      venueId: row.venueId,
      slot: slotLabel(row.slot),
      kind: (row.kind as PlanKind) || "coffee",
      status: row.status === "closed" || row.status === "past" ? row.status : "upcoming",
      deposit,
      bookedAt: row.bookedAt,
      createdAt: row.bookedAt ?? new Date().toISOString(),
      keptByMe: row.keptByMe,
      keptByThem: row.keptByThem,
      closedKindly: false,
    };
  });
}

export async function refresh(state: AppState): Promise<AppState> {
  if (!isLive()) return state;
  const [me, prefs, drop, matchRows, likeRows, planRows, trusted] = await Promise.all([
    api.me(),
    api.preferences(),
    api.drop(),
    api.matches(),
    api.receivedLikes(),
    api.plans(),
    api.trusted(),
  ]);
  meId = me.id;
  verified = Boolean(me.verified);
  dropIds = [];
  for (const pick of drop.picks) {
    if (pick.profile) remember(pick.profile);
    dropIds.push(pick.personId);
    await rememberPhoto(pick.personId, pick.photos[0]);
  }
  for (const row of likeRows.likes) {
    remember(row.profile);
    const person = people.get(row.id);
    if (person) person.likesYou = true;
  }
  for (const row of matchRows.matches) remember(row.profile);
  return {
    ...state,
    preview: false,
    paused: me.paused,
    plus: me.closerPlus ? state.plus ?? { tier: "month", since: new Date().toISOString() } : null,
    draft: {
      ...state.draft,
      name: me.displayName || state.draft.name,
      dob: me.dob ?? state.draft.dob,
      gender: (me.gender as AppState["draft"]["gender"]) || state.draft.gender,
      showMe: (me.showMe as AppState["draft"]["showMe"]) || state.draft.showMe,
      intent: (me.intent as AppState["draft"]["intent"]) || state.draft.intent,
      hideFromContacts: me.hideFromContacts,
      areas: prefs.areas,
      languages: prefs.languages,
      ageMin: prefs.ageMin,
      ageMax: prefs.ageMax,
      foods: prefs.foods as AppState["draft"]["foods"],
    },
    matches: matchRows.matches.map((row) => row.id),
    plans: plansFrom(planRows.plans),
    trusted: trusted.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phoneEnding,
      confirmed: contact.confirmed,
    })),
  };
}

async function live<T>(work: () => Promise<T>): Promise<T> {
  return withStatus(work);
}

export async function openDrop(state: AppState, now = new Date()) {
  if (!isLive()) return logic.openDrop(state, now);
  return live(async () => {
    const activity = await api.activity("drop");
    const next = await refresh(state);
    return { ...next, streak: { ...next.streak, count: activity.count, lastDate: now.toISOString().slice(0, 10) } };
  });
}

export async function likePerson(state: AppState, personId: string, note: string, highlights: string[] = []) {
  if (!isLive()) return logic.likePerson(state, personId, note, highlights);
  return live(async () => {
    await api.like(personId, note);
    const next = await refresh({
      ...state,
      likes: state.likes.some((like) => like.personId === personId)
        ? state.likes
        : [...state.likes, { personId, note, highlights, at: new Date().toISOString() }],
    });
    return { state: next, matched: next.matches.includes(personId) };
  });
}

export async function bookPlan(state: AppState, input: { personId: string; venueId: string; slot: string; kind: PlanKind }) {
  if (!isLive()) return logic.bookPlan(state, input);
  return live(async () => {
    try {
      const created = await api.createPlan(input);
      const next = await refresh(state);
      return { state: next, error: "", planId: created.id };
    } catch (error) {
      return { state, error: error instanceof Error ? error.message : "Couldn't book", planId: "" };
    }
  });
}

/** Live deposits are marked paid by the payment desk. The screen only shows status. */
export async function payDeposit(state: AppState, planId: string, now = new Date()) {
  if (!isLive()) return logic.payDeposit(state, planId, now);
  return refresh(state);
}

export async function keepChat(state: AppState, planId: string) {
  if (!isLive()) return logic.keepChat(state, planId);
  return live(async () => {
    await api.keep(planId);
    return refresh(state);
  });
}

export async function submitDebrief(state: AppState, debrief: { planId: string; feel: string; again: string; note: string }) {
  if (!isLive()) return logic.submitDebrief(state, debrief);
  return live(async () => {
    await api.debrief(debrief.planId, { feel: debrief.feel, again: debrief.again, note: debrief.note });
    return { ...state, debriefs: [...state.debriefs, debrief] };
  });
}

export async function setAway(state: AppState, away: { kind: "trip" | "busy" | "seeing"; until: string | null; note: string }) {
  if (!isLive()) return logic.setAway(state, away);
  return live(async () => {
    await api.away(away.kind, away.until);
    return { ...state, away };
  });
}

export async function clearAway(state: AppState) {
  if (!isLive()) return logic.clearAway(state);
  return live(async () => {
    await api.clearAway();
    return { ...state, away: null };
  });
}

export async function addTrusted(state: AppState, name: string, phone: string) {
  if (!isLive()) return logic.addTrusted(state, name, phone);
  return live(async () => {
    await api.addTrusted(name, phone);
    return refresh(state);
  });
}

export async function fileReport(
  state: AppState,
  input: { againstName: string; category: string; severe: boolean; detail: string },
) {
  if (!isLive()) return logic.fileReport(state, input);
  return live(async () => {
    const found = [...people.values()].find((person) => person.name === input.againstName);
    await api.report({
      againstId: found?.id ?? input.againstName,
      category: input.category,
      detail: input.detail,
      severe: input.severe,
    });
    return logic.fileReport(state, input);
  });
}

export async function blockPerson(state: AppState, personId: string) {
  if (!isLive()) return logic.blockPerson(state, personId);
  return live(async () => {
    await api.block(personId);
    return refresh({ ...state, blocks: [...state.blocks, personId] });
  });
}

export async function claimGift(state: AppState, milestone: number, gift: string, address: string) {
  if (!isLive()) return logic.claimGift(state, milestone, gift, address);
  return live(async () => {
    await api.claimGift(milestone, gift, address);
    return {
      ...state,
      giftClaim: { milestone, gift, address, at: new Date().toISOString() },
      streak: { ...state.streak, giftsClaimed: [...state.streak.giftsClaimed, milestone] },
    };
  });
}

export async function setPaused(state: AppState, paused: boolean) {
  if (!isLive()) return logic.setPaused(state, paused);
  return live(async () => {
    await api.patchMe({ paused });
    return { ...state, paused };
  });
}

export async function deleteAccount(state: AppState) {
  if (!isLive()) return logic.deleteAccount(state);
  return live(async () => {
    await api.deleteAccount();
    clearSession();
    return logic.deleteAccount(state);
  });
}

export async function logout(state: AppState) {
  if (!isLive()) return logic.blankState();
  void state;
  try {
    await api.logout();
  } catch {
    /* the token is cleared either way */
  }
  clearSession();
  verified = false;
  meId = "";
  return { ...logic.blankState(), preview: false };
}

export async function triggerSos(state: AppState, planId: string | null, coords: { lat: number | null; lng: number | null }) {
  if (!isLive()) return logic.triggerSos(state, planId, coords);
  return live(async () => {
    await api.sos({
      planId: planId ?? undefined,
      lat: coords.lat ?? undefined,
      lng: coords.lng ?? undefined,
    });
    return logic.triggerSos(state, planId, coords);
  });
}

export async function recordStreak(state: AppState, kind: string) {
  if (!isLive()) return state;
  return live(async () => {
    const activity = await api.activity(kind);
    return { ...state, streak: { ...state.streak, count: activity.count } };
  });
}

export async function saveProfile(patch: Record<string, unknown>) {
  if (!isLive()) return;
  await live(() => api.patchMe(patch));
}

export async function savePreferences(body: { areas: string[]; languages: string[]; ageMin: number; ageMax: number; foods: string[] }) {
  if (!isLive()) return;
  await live(() => api.savePreferences(body));
}

export async function saveContacts(hashes: string[], allowlist: string[]) {
  if (!isLive()) return;
  await live(async () => {
    await api.replaceContacts(hashes);
    await api.replaceAllowlist(allowlist);
  });
}

export async function uploadSelfie(file: Blob) {
  if (!isLive()) return;
  await live(() => api.upload("selfie", file, "selfie.jpg"));
}

export async function uploadPhoto(file: Blob, main: boolean) {
  if (!isLive()) return;
  await live(async () => {
    const saved = await api.upload("photo", file, "photo.jpg");
    await api.addPhoto(saved.key, main);
  });
}

export async function uploadVoice(file: Blob, prompt: string, seconds: number) {
  if (!isLive()) return;
  await live(async () => {
    const saved = await api.upload("voice", file, "voice.webm", Math.min(30, Math.max(1, Math.round(seconds))));
    await api.addVoice(saved.key, prompt, Math.min(30, Math.max(1, Math.round(seconds))));
  });
}

export async function signIn(phone: string, code: string) {
  const session = await api.verifyOtp(phone, code);
  setSession(session.token);
  meId = session.userId;
  return session;
}

export function openPlanChat(
  planId: string,
  onMessage: (message: { from: string; body: string }) => void,
  onBlocked: (reason: string) => void,
) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let timer = 0;
  const connect = () => {
    socket = new WebSocket(wsUrl(`/plans/${planId}/chat`));
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { type?: string; reason?: string; from?: string; body?: string };
        if (data.type === "blocked") onBlocked(data.reason ?? "");
        if (data.type === "message" && data.body) onMessage({ from: data.from ?? "", body: data.body });
      } catch {
        /* ignore a frame that is not JSON */
      }
    };
    socket.onclose = () => {
      if (!stopped) timer = window.setTimeout(connect, 1500);
    };
  };
  connect();
  return {
    send(body: string) {
      socket?.send(JSON.stringify({ body }));
    },
    close() {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
    },
  };
}

export async function loadMessages(planId: string) {
  if (!isLive()) return [];
  const rows = await api.messages(planId);
  return rows.messages;
}
