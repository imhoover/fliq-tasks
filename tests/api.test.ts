import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
import { app, type Bindings } from "../worker/index";
import { createTask } from "../shared/tasks";

let mf: Miniflare;
let env: Bindings;
const origin = "https://fliq.example";
const cookie = "__Host-fliq=test-session";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  authenticated = true,
  requestOrigin = origin,
) {
  return app.request(
    origin + path,
    {
      method,
      headers: {
        ...(authenticated ? { cookie } : {}),
        ...(method !== "GET"
          ? { Origin: requestOrigin, "Content-Type": "application/json" }
          : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    },
    env,
  );
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: "2026-10-17",
      d1Databases: ["DB"],
    }),
  );
  const db = await mf.getD1Database("DB");
  const sql = await readFile(
    new URL("../migrations/0001_initial.sql", import.meta.url),
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("test-session"),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  await db.prepare("INSERT INTO users VALUES (?, ?)").bind("a", "Test A").run();
  await db.prepare("INSERT INTO users VALUES (?, ?)").bind("b", "Test B").run();
  await db
    .prepare("INSERT INTO sessions VALUES (?, ?, ?)")
    .bind(hash, "a", Date.now() + 60000)
    .run();
  env = {
    DB: db as unknown as D1Database,
    APP_ORIGIN: origin,
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
  };
});
afterAll(async () => {
  await mf?.dispose();
});
describe("Worker boundary and real D1", () => {
  it("denies unauthenticated data access", async () => {
    expect((await request("/api/tasks", "GET", undefined, false)).status).toBe(
      401,
    );
  });
  it("rejects foreign origins before mutation", async () => {
    expect(
      (await request("/api/tasks/x", "PUT", {}, true, "https://evil.example"))
        .status,
    ).toBe(403);
  });
  it("fails closed when Google OAuth is unconfigured", async () => {
    expect((await request("/auth/google")).status).toBe(503);
  });
  it("rejects a forged callback without an OAuth cookie", async () => {
    expect((await request("/auth/callback?code=fake&state=fake")).status).toBe(
      400,
    );
  });
  it("validates task input and prevents user-field injection", async () => {
    const task = createTask("safe");
    expect(
      (await request(`/api/tasks/${task.id}`, "PUT", { ...task, user_id: "b" }))
        .status,
    ).toBe(400);
  });
  it("creates, reads, updates and rejects stale revisions", async () => {
    const task = createTask("original");
    const created = await request(`/api/tasks/${task.id}`, "PUT", task);
    expect(created.status).toBe(200);
    const first = (await created.json()) as { task: typeof task };
    expect(first.task.revision).toBe(1);
    const updated = await request(`/api/tasks/${task.id}`, "PUT", {
      ...first.task,
      status: "doing",
    });
    expect(updated.status).toBe(200);
    const conflict = await request(`/api/tasks/${task.id}`, "PUT", {
      ...task,
      title: "stale",
    });
    expect(conflict.status).toBe(409);
    const result = await request("/api/tasks");
    const body = (await result.json()) as { tasks: (typeof task)[] };
    expect(body.tasks[0].title).toBe("original");
    expect(body.tasks[0].status).toBe("doing");
  });
  it("isolates records even when another user chooses the same UUID", async () => {
    const task = createTask("private to b");
    await env.DB.prepare(
      "INSERT INTO tasks (user_id,id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    )
      .bind("b", task.id, task.title, "inbox", task.createdAt, task.updatedAt)
      .run();
    const response = await request("/api/tasks");
    expect(JSON.stringify(await response.json())).not.toContain("private to b");
    const write = await request(`/api/tasks/${task.id}`, "PUT", {
      ...task,
      title: "belongs to a",
    });
    expect(write.status).toBe(200);
    const other = await env.DB.prepare(
      "SELECT title FROM tasks WHERE user_id=? AND id=?",
    )
      .bind("b", task.id)
      .first<{ title: string }>();
    expect(other?.title).toBe("private to b");
  });
  it("returns an explicit unavailable result instead of fake AI output", async () => {
    expect(
      (await request("/api/ai/breakdown", "POST", { text: "prepare meeting" }))
        .status,
    ).toBe(503);
  });
  it("sets security headers and prevents session caching", async () => {
    const response = await request("/api/me");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });
  it("rejects oversized bodies before parsing", async () => {
    expect(
      (await request("/api/ai/breakdown", "POST", { text: "a".repeat(40000) }))
        .status,
    ).toBe(413);
  });
  it("accepts an identical retry without increasing its revision", async () => {
    const task = createTask("idempotent");
    const first = await request(`/api/tasks/${task.id}`, "PUT", task);
    const retry = await request(`/api/tasks/${task.id}`, "PUT", task);
    expect(await retry.json()).toEqual(await first.json());
  });
  it("validates AI output and enforces quota with an explicitly stubbed AI binding", async () => {
    env.AI = {
      run: async () => ({
        response: '[{"title":"確認する","notes":"数字120を保持"}]',
      }),
    };
    try {
      const result = await request("/api/ai/breakdown", "POST", {
        text: "数字120を確認",
      });
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({
        suggestions: [{ title: "確認する", notes: "数字120を保持" }],
      });
      env.AI = { run: async () => ({ response: "invalid JSON" }) };
      expect(
        (await request("/api/ai/breakdown", "POST", { text: "check" })).status,
      ).toBe(502);
      env.AI = { run: async () => ({ response: '[{"title":"check"}]' }) };
      for (let i = 0; i < 18; i++)
        expect(
          (await request("/api/ai/breakdown", "POST", { text: "check" }))
            .status,
        ).toBe(200);
      expect(
        (await request("/api/ai/breakdown", "POST", { text: "check" })).status,
      ).toBe(429);
    } finally {
      delete env.AI;
    }
  });
  it("creates a Google-only authorization redirect with PKCE and a short HttpOnly cookie", async () => {
    const configured = {
      ...env,
      GOOGLE_CLIENT_ID: "example.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-only",
      SESSION_SECRET: "test-secret-is-not-production-".repeat(2),
    };
    const response = await app.request(origin + "/auth/google", {}, configured);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toHaveLength(64);
    expect(location.searchParams.get("nonce")).toHaveLength(64);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("Secure");
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=600");
  });
  it("invalidates a session on logout", async () => {
    expect((await request("/auth/logout", "POST")).status).toBe(200);
    expect((await request("/api/tasks")).status).toBe(401);
  });
});
