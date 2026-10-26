/** Normalise an Indian mobile number to E.164. Returns "" when it isn't usable. */
export function normaliseE164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^91[6-9]/.test(digits)) {
    return `+${digits}`;
  }
  if (input.trim().startsWith("+") && digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return "";
}

export async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPhone(input: string) {
  const e164 = normaliseE164(input);
  if (!e164) return "";
  return sha256(e164);
}

/** What actually leaves the device. Raw numbers are not in this object. */
export async function contactPayload(
  contacts: { name: string; phone: string; allowed: boolean }[],
) {
  const rows = await Promise.all(
    contacts.map(async (contact) => ({
      name: contact.name,
      hash: await hashPhone(contact.phone),
      allowed: contact.allowed,
    })),
  );
  const valid = rows.filter((row) => row.hash);
  return {
    hashes: valid.map((row) => row.hash),
    allowlist: valid.filter((row) => row.allowed).map((row) => row.hash),
  };
}
