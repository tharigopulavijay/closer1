// Supabase Client & Local Mock Sync Layer for Closer
// Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when configured;
// otherwise gracefully runs on typed offline-first local storage.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mock-closer.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key-closer-hyd';

export interface StorageState {
  hasCompletedOnboarding: boolean;
  streakCount: number;
  streakFreezesRemaining: number;
  openPlansCount: number;
  likesSent: string[]; // profile ids
  matches: string[]; // profile ids
  activePlanId: string | null;
  awayMode: {
    enabled: boolean;
    reason: string;
    untilDate: string;
  };
  safetyStatus: {
    inDateMode: boolean;
    lastCheckInTime: string | null;
    emergencyTriggered: boolean;
  };
  coinsBalance: number;
}

const DEFAULT_STATE: StorageState = {
  hasCompletedOnboarding: true,
  streakCount: 23,
  streakFreezesRemaining: 2,
  openPlansCount: 1,
  likesSent: [],
  matches: ['p_ananya'],
  activePlanId: 'plan_ananya_coffee',
  awayMode: {
    enabled: false,
    reason: '',
    untilDate: '',
  },
  safetyStatus: {
    inDateMode: true,
    lastCheckInTime: '16:30 IST',
    emergencyTriggered: false,
  },
  coinsBalance: 240,
};

const STORAGE_KEY = 'closer_app_state_v1';

export function getAppState(): StorageState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
      return DEFAULT_STATE;
    }
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function updateAppState(updater: (prev: StorageState) => Partial<StorageState>): StorageState {
  const current = getAppState();
  const next = { ...current, ...updater(current) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
