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

  it("fetches a fresh chat ticket before every socket", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_API_URL", "http://api.test");
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    let tickets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        tickets += 1;
        return new Response(JSON.stringify({ ticket: `ticket-${tickets}`, expiresAt: "2099-01-01T00:00:00.000Z" }), { status: 200 });
      }),
    );
    const opened: { url: string; onclose: (() => void) | null }[] = [];
    class FakeSocket {
      onclose: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor(url: string) {
        opened.push({ url, onclose: null });
        queueMicrotask(() => {
          opened[opened.length - 1].onclose = this.onclose;
        });
      }
      send() {}
      close() {
        this.onclose?.();
      }
    }
    vi.stubGlobal("WebSocket", FakeSocket);
    const { setSession } = await import("../lib/api");
    setSession("session-secret");
    const live = await import("./live");
    const chat = live.openPlanChat("plan-1", () => {}, () => {});
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].url).toContain("ticket=ticket-1");
    expect(opened[0].url).not.toContain("session-secret");
    expect(opened[0].url).not.toContain("token=");
    opened[0].onclose?.();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.waitFor(() => expect(opened).toHaveLength(2));
    expect(opened[1].url).toContain("ticket=ticket-2");
    chat.close();
  });
});
