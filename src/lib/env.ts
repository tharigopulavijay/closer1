export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "",
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL ?? "",
};

/** Live mode is on only when the API base URL is set. Preview never uses it. */
export function isLive() {
  return Boolean(String(import.meta.env.VITE_API_URL ?? "").trim());
}
