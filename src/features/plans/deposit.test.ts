import { describe, expect, it } from "vitest";
import { DEPOSIT_POLL_MS, DEPOSIT_WAIT_MS, watchDeposit, type DepositPlan } from "./deposit";

describe("deposit confirmation", () => {
  it("waits for the server to say paid and does not treat an open checkout as paid", async () => {
    let clock = 0;
    const seen: number[] = [];
    const result = await watchDeposit(
      "plan-1",
      "me",
      async () => {
        seen.push(clock);
        const status = clock >= DEPOSIT_WAIT_MS ? "paid" : "unpaid";
        return [{ id: "plan-1", deposits: [{ userId: "me", status }] }];
      },
      async (ms) => {
        clock += ms;
      },
      () => clock,
    );
    expect(result).toBe("paid");
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(DEPOSIT_WAIT_MS);
    expect(seen).toHaveLength(DEPOSIT_WAIT_MS / DEPOSIT_POLL_MS + 1);
  });

  it("stops after 30 seconds while the deposit is still unpaid", async () => {
    let clock = 0;
    let reads = 0;
    const result = await watchDeposit(
      "plan-1",
      "me",
      async (): Promise<DepositPlan[]> => {
        reads += 1;
        return [{ id: "plan-1", deposits: [{ userId: "me", status: "unpaid" }] }];
      },
      async (ms) => {
        clock += ms;
      },
      () => clock,
    );
    expect(result).toBe("unpaid");
    expect(reads).toBe(DEPOSIT_WAIT_MS / DEPOSIT_POLL_MS + 1);
    expect(clock).toBe(DEPOSIT_WAIT_MS);
  });
});
