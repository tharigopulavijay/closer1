export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  PLAN_CHAT: DurableObjectNamespace;
  /** "development" or "test" allow DEV_OTP; anything else (production) ignores it. */
  ENVIRONMENT?: string;
  DEV_OTP?: string;
  SERVICE_TOKEN?: string;
  MSG91_KEY?: string;
  /** MSG91 OTP template. A secret in production; never commit a real value. */
  MSG91_TEMPLATE_ID?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  /** Razorpay key id. A secret in production; never commit a real value. */
  RAZORPAY_KEY_ID?: string;
  /** Razorpay key secret. A secret in production; never commit a real value. */
  RAZORPAY_KEY_SECRET?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  /** VAPID public key for Web Push. Not a secret, but it ships from the environment so it is not committed. */
  VAPID_PUBLIC_KEY?: string;
  /** VAPID private key. A secret. Never commit a real value. */
  VAPID_PRIVATE_KEY?: string;
  /** Comma-separated browser origins. Empty means no cross-origin browser access. */
  ALLOWED_ORIGINS?: string;
}

export class PolicyError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function fail(message: string, status = 403): never {
  throw new PolicyError(message, status);
}
