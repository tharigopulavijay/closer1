import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["api/test/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "test",
            DEV_OTP: "482913",
            SERVICE_TOKEN: "service-test",
            RAZORPAY_WEBHOOK_SECRET: "razorpay-test-secret",
            RAZORPAY_KEY_ID: "rzp_test_key",
            RAZORPAY_KEY_SECRET: "rzp_test_secret",
            LIVEKIT_API_KEY: "lk-test-key",
            LIVEKIT_API_SECRET: "lk-test-secret",
            ALLOWED_ORIGINS: "http://localhost:5173",
          },
        },
      },
    },
  },
});
