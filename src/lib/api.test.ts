import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, request, sessionToken, setSession } from "./api";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearSession();
});

describe("api client", () => {
  it("sends the session token as a bearer header", async () => {
    vi.stubEnv("VITE_API_URL", "http://api.test");
    vi.stubGlobal("sessionStorage", memoryStorage());
    setSession("abc");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await request("/me");
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/me", expect.anything());
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const headers = new Headers(calls[0][1].headers);
    expect(headers.get("authorization")).toBe("Bearer abc");
  });

  it("clears the token and goes to login on 401", async () => {
    vi.stubEnv("VITE_API_URL", "http://api.test");
    vi.stubGlobal("sessionStorage", memoryStorage());
    setSession("abc");
    const assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/drop" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "auth required" }), { status: 401 })));
    await expect(request("/plans")).rejects.toThrow(/auth required/);
    expect(sessionToken()).toBe("");
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("keeps a failed login code on the screen", async () => {
    vi.stubEnv("VITE_API_URL", "http://api.test");
    vi.stubGlobal("sessionStorage", memoryStorage());
    const assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/login" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "too many attempts" }), { status: 401 })));
    await expect(request("/auth/verify", { body: { phone: "+9198", code: "000000" } })).rejects.toThrow(/too many attempts/);
    expect(assign).not.toHaveBeenCalled();
  });
});
