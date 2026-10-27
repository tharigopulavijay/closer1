declare module "*.sql?raw" {
  const value: string;
  export default value;
}

declare module "*.jsonc?raw" {
  const value: string;
  export default value;
}

declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    MEDIA: R2Bucket;
    PLAN_CHAT: DurableObjectNamespace;
    DEV_OTP: string;
    SERVICE_TOKEN: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    LIVEKIT_API_KEY: string;
    LIVEKIT_API_SECRET: string;
    ALLOWED_ORIGINS: string;
    MSG91_KEY?: string;
    MSG91_TEMPLATE_ID?: string;
  }
}
