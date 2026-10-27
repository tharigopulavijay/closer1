declare module "*.sql?raw" {
  const value: string;
  export default value;
}

declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    DEV_OTP: string;
    SERVICE_TOKEN: string;
  }
}
