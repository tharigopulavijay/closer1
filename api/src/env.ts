export interface Env {
  DB: D1Database;
  DEV_OTP?: string;
  SERVICE_TOKEN?: string;
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
