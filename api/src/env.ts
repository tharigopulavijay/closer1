export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  PLAN_CHAT: DurableObjectNamespace;
  DEV_OTP?: string;
  SERVICE_TOKEN?: string;
  MSG91_KEY?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
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
