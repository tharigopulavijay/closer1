import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canUsePush, installTarget } from "./pwa";

describe("installable app", () => {
  it("hints only on a phone that has not already installed Closer", () => {
    expect(installTarget("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", false)).toBe("ios");
    expect(installTarget("Mozilla/5.0 (Linux; Android 14)", false)).toBe("android");
    expect(installTarget("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", true)).toBeNull();
    expect(installTarget("Mozilla/5.0 (Macintosh; Intel Mac OS X)", false)).toBeNull();
  });

  it("keeps push out of preview", () => {
    expect(canUsePush(false)).toBe(false);
    expect(canUsePush(true)).toBe(true);
  });

  it("caches the app shell and leaves API and media on the network", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    expect(worker).toContain('path.startsWith("/api") || path.startsWith("/media")');
    expect(worker).toContain("return path === \"/\" || path === \"/index.html\"");
    expect(worker).toContain('path.startsWith("/assets/")');
    expect(worker).toMatch(/if \(event\.request\.method !== "GET" \|\| !isAppShell\(url\)\) return;/);
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { name: string; theme_color: string; icons: { src: string }[] };
    expect(manifest.name).toBe("Closer");
    expect(manifest.theme_color).toBe("#160E1F");
    expect(manifest.icons[0]?.src).toBe("/favicon.svg");
  });
});
