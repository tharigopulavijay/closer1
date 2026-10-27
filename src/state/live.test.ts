import { afterEach, describe, expect, it, vi } from "vitest";
import { blankState } from "./logic";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("live mode switch", () => {
  it("uses preview logic and does not call fetch when VITE_API_URL is unset", async () => {
    vi.stubEnv("VITE_API_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const live = await import("./live");
    expect(live.mode()).toBe("preview");
    const result = await live.likePerson(blankState(), "nobody", "", []);
    expect(result.matched).toBe(false);
    expect(result.state.likes).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows exact plan times in India time and leaves written slots alone", async () => {
    const live = await import("./live");
    expect(live.slotLabel("2099-01-01T13:30:00.000Z")).toMatch(/Thu,? 1 Jan · 7:00 pm/);
    expect(live.slotLabel("Sat · 8:00 pm")).toBe("Sat · 8:00 pm");
  });

  it("switches to live when VITE_API_URL is set", async () => {
    vi.stubEnv("VITE_API_URL", "http://api.test");
    const live = await import("./live");
    expect(live.mode()).toBe("live");
    expect(live.isLive()).toBe(true);
  });
});
