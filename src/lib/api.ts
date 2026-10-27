const SESSION = "closer.session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function apiBase() {
  return String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
}

export function sessionToken() {
  try {
    return sessionStorage.getItem(SESSION) ?? "";
  } catch {
    return "";
  }
}

export function setSession(token: string) {
  sessionStorage.setItem(SESSION, token);
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION);
  } catch {
    /* node tests */
  }
}

function goLogin() {
  const loc = globalThis.location;
  if (!loc || typeof loc.assign !== "function") return;
  if (loc.pathname === "/login") return;
  loc.assign("/login");
}

export function wsUrl(path: string, ticket: string) {
  const base = apiBase();
  const join = path.includes("?") ? "&" : "?";
  const withTicket = `${path}${join}ticket=${encodeURIComponent(ticket)}`;
  if (base.startsWith("https://")) return `${base.replace("https://", "wss://")}${withTicket}`;
  if (base.startsWith("http://")) return `${base.replace("http://", "ws://")}${withTicket}`;
  const loc = globalThis.location;
  const proto = loc?.protocol === "https:" ? "wss:" : "ws:";
  const host = loc?.host ?? "localhost:5173";
  return `${proto}//${host}${base}${withTicket}`;
}

/** Server codes that would read as jargon on a phone get a plain sentence; the rest pass through. */
const FRIENDLY: Record<string, string> = {
  "not configured": "This isn't switched on yet. Please try again later.",
  "payment desk": "The payment service didn't answer. Please try again.",
  "could not send code": "We couldn't text you a code. Please try again in a minute.",
  "room full": "This room is full right now.",
  error: "Something went wrong. Please try again.",
};

function friendly(message: string) {
  return FRIENDLY[message] ?? message;
}

export async function request<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const token = sessionToken();
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  let body: BodyInit | undefined;
  if (init.form) {
    body = init.form;
  } else if (init.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.body);
  }
  const response = await fetch(`${apiBase()}${path}`, {
    method: init.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  if (response.status === 401 && token && !path.startsWith("/auth")) {
    clearSession();
    goLogin();
  }
  const text = await response.text();
  let json: { error?: string } | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as { error?: string };
    } catch {
      json = null;
    }
  }
  if (!response.ok) throw new ApiError(friendly(json?.error || "error"), response.status);
  return json as T;
}

export type PublicProfile = {
  id: string;
  displayName: string;
  age: number | null;
  gender: string | null;
  intent: string | null;
  area: string | null;
  verified: boolean;
  closerPlus: boolean;
};

export type OwnProfile = {
  id: string;
  displayName: string;
  dob: string | null;
  gender: string | null;
  showMe: string | null;
  intent: string | null;
  area: string | null;
  verified: boolean;
  hideFromContacts: boolean;
  paused: boolean;
  closerPlus: boolean;
  retakeNote?: string | null;
  staffRoles?: string[];
};

export const api = {
  requestOtp: (phone: string) => request<{ sent: boolean }>("/auth/otp", { body: { phone } }),
  verifyOtp: (phone: string, code: string) => request<{ token: string; userId: string; expiresAt: string }>("/auth/verify", { body: { phone, code } }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<OwnProfile>("/me"),
  patchMe: (patch: Record<string, unknown>) => request<OwnProfile>("/me", { method: "PATCH", body: patch }),
  preferences: () => request<{ areas: string[]; languages: string[]; ageMin: number; ageMax: number; foods: string[] }>("/preferences"),
  savePreferences: (body: { areas: string[]; languages: string[]; ageMin: number; ageMax: number; foods: string[] }) =>
    request<typeof body>("/preferences", { method: "PUT", body }),
  replaceContacts: (hashes: string[]) => request<{ ok: boolean }>("/contacts", { method: "PUT", body: { hashes } }),
  replaceAllowlist: (hashes: string[]) => request<{ ok: boolean }>("/contacts/allowlist", { method: "PUT", body: { hashes } }),
  upload: async (kind: "photo" | "voice" | "selfie", file: Blob, name: string, seconds?: number) => {
    const form = new FormData();
    form.set("kind", kind);
    if (seconds !== undefined) form.set("seconds", String(seconds));
    form.set("file", file, name);
    return request<{ key: string; kind: string }>("/media", { form });
  },
  addPhoto: (key: string, main?: boolean) => request<{ id: string; main: boolean }>("/me/photos", { body: { key, main } }),
  deletePhoto: (id: string) => request<{ ok: boolean }>(`/me/photos/${id}`, { method: "DELETE" }),
  addVoice: (key: string, prompt: string, seconds: number) => request<{ id: string }>("/me/voice", { body: { key, prompt, seconds } }),
  drop: () => request<{ date: string; picks: { personId: string; position: number; profile: PublicProfile | null; photos: string[] }[] }>("/drop/today"),
  matches: () => request<{ matches: { id: string; profile: PublicProfile }[] }>("/matches"),
  receivedLikes: () => request<{ likes: { id: string; profile: PublicProfile }[] }>("/likes/received"),
  like: (personId: string, note: string) => request<{ ok: boolean }>("/likes", { body: { personId, note } }),
  plans: () =>
    request<{
      plans: {
        id: string;
        status: string;
        venueId: string;
        slot: string;
        kind: string;
        bookedAt: string | null;
        partner: PublicProfile | { id: string; visible: false } | null;
        deposits: { userId: string; status: string }[];
        chatOpen: boolean;
        keptByMe: boolean;
        keptByThem: boolean;
      }[];
    }>("/plans"),
  createPlan: (body: { personId: string; venueId: string; slot: string; kind: string }) =>
    request<{ id: string; deposit: string }>("/plans", { body }),
  messages: (planId: string, before?: string) =>
    request<{ messages: { id: string; senderId: string | null; body: string; createdAt: string }[] }>(
      `/plans/${planId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    ),
  keep: (planId: string) => request<{ ok: boolean }>(`/plans/${planId}/keep`, { method: "POST" }),
  chatTicket: (planId: string) => request<{ ticket: string; expiresAt: string }>(`/plans/${planId}/chat-ticket`, { method: "POST" }),
  depositOrder: (planId: string) =>
    request<{ orderId: string; amount: number; currency: string; keyId: string }>(`/plans/${planId}/deposit/order`, { method: "POST" }),
  rooms: () =>
    request<{ rooms: { id: string; title: string; topic: string; host: string; speakers: number; createdAt: string }[] }>("/rooms"),
  createRoom: (title: string, topic: string) => request<{ id: string }>("/rooms", { body: { title, topic } }),
  roomToken: (roomId: string) => request<{ token: string }>(`/rooms/${roomId}/token`, { method: "POST" }),
  joinChai: () => request<{ id: string; guestName: string }>("/rooms/chai", { method: "POST" }),
  revealChai: (roomId: string) =>
    request<{ revealed: boolean; people?: { id: string; name: string }[] }>(`/rooms/chai/${roomId}/reveal`, { method: "POST" }),
  verifyQueue: () => request<{ queue: { id: string; displayName: string; selfies: string[]; photos: string[] }[] }>("/admin/verify-queue"),
  verifyMember: (userId: string) => request<{ ok: boolean }>(`/admin/users/${userId}/verify`, { method: "POST" }),
  rejectMember: (userId: string, reason: string) => request<{ ok: boolean }>(`/admin/users/${userId}/reject`, { body: { reason } }),
  adminReports: () =>
    request<{ reports: { id: string; againstId: string | null; category: string; detail: string; status: string; severe: boolean; createdAt: string }[] }>(
      "/admin/reports",
    ),
  confirmReport: (reportId: string, action: string) => request<{ ok: boolean }>(`/admin/reports/${reportId}/confirm`, { body: { action } }),
  debrief: (planId: string, body: { feel: string; again: string; note: string }) =>
    request<{ ok: boolean }>(`/plans/${planId}/debrief`, { body }),
  report: (body: { againstId: string; category: string; detail: string; severe?: boolean }) => request<{ ok: boolean }>("/reports", { body }),
  block: (personId: string) => request<{ ok: boolean }>("/blocks", { body: { personId } }),
  away: (kind: string, until: string | null) => request<{ ok: boolean }>("/away", { body: { kind, until } }),
  clearAway: () => request<{ ok: boolean }>("/away", { method: "DELETE" }),
  trusted: () => request<{ contacts: { id: string; name: string; phoneEnding: string; confirmed: boolean }[] }>("/trusted-contacts"),
  addTrusted: (name: string, phone: string) => request<{ id: string; confirmed: boolean }>("/trusted-contacts", { body: { name, phone } }),
  activity: (kind: string) => request<{ count: number }>("/streak/activity", { body: { kind } }),
  claimGift: (milestone: number, gift: string, address: string) =>
    request<{ id: string }>("/gifts/claim", { body: { milestone, gift, address } }),
  deleteAccount: () => request<{ ok: boolean }>("/account", { method: "DELETE" }),
  pushStatus: () => request<{ optedIn: boolean; publicKey: string | null }>("/push"),
  subscribePush: (body: { endpoint: string; p256dh: string; auth: string }) => request<{ optedIn: boolean }>("/push", { body }),
  unsubscribePush: () => request<{ optedIn: boolean }>("/push", { method: "DELETE" }),
  sos: (body: { planId?: string; lat?: number; lng?: number }) => request<unknown>("/sos", { body }),
  mediaBlob: async (key: string) => {
    const token = sessionToken();
    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetch(`${apiBase()}/media/${key}`, { headers });
    if (!response.ok) throw new ApiError("not visible", response.status);
    return response.blob();
  },
};
