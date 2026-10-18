import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
describe("initial shell and offline scope", () => {
  it("serves an editable capture field before the application bundle", async () => {
    const html = await readFile(
      new URL("../index.html", import.meta.url),
      "utf8",
    );
    expect(html.indexOf('id="boot-input"')).toBeLessThan(
      html.indexOf('src="/src/main.tsx"'),
    );
    expect(html).toContain('aria-label="読み込み中"');
    expect(html).toContain("prefers-reduced-motion");
  });
  it("excludes authenticated API traffic from the offline cache", async () => {
    const sw = await readFile(
      new URL("../public/sw.js", import.meta.url),
      "utf8",
    );
    const handlers = new Map<string, (event: unknown) => void>();
    runInNewContext(sw, {
      self: {
        location: { origin: "https://example.test" },
        addEventListener: (name: string, handler: (event: unknown) => void) =>
          handlers.set(name, handler),
      },
      URL,
    });
    for (const [path, method] of [
      ["/api/me", "GET"],
      ["/auth/google", "GET"],
      ["/assets/file.js", "POST"],
    ]) {
      let intercepted = false;
      handlers.get("fetch")!({
        request: { url: `https://example.test${path}`, method },
        respondWith: () => {
          intercepted = true;
        },
      });
      expect(intercepted).toBe(false);
    }
  });
  it("serves the cached public shell when navigation loses the network", async () => {
    const sw = await readFile(
      new URL("../public/sw.js", import.meta.url),
      "utf8",
    );
    const handlers = new Map<string, (event: unknown) => void>();
    const cachedShell = new Response("<html>capture</html>");
    runInNewContext(sw, {
      self: {
        location: { origin: "https://example.test" },
        addEventListener: (name: string, handler: (event: unknown) => void) =>
          handlers.set(name, handler),
      },
      URL,
      Response,
      fetch: async () => {
        throw new Error("offline");
      },
      caches: { match: async () => cachedShell },
    });
    let response: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: {
        url: "https://example.test/",
        method: "GET",
        mode: "navigate",
      },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    expect(await (await response!).text()).toContain("capture");
  });
});
