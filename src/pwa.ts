export function installTarget(ua: string, standalone: boolean): "ios" | "android" | null {
  if (standalone) return null;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return null;
}

/** Reminders exist only in live mode. Preview never registers a push subscription. */
export function canUsePush(live: boolean) {
  return live;
}
