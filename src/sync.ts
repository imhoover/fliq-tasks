import { useEffect, useState } from "react";
import { TaskStore } from "./store";
import { taskSchema } from "../shared/tasks";
import { z } from "zod";

export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "接続できませんでした。");
  return body as T;
}
export function useSync(
  store: TaskStore,
  authenticated: boolean,
  notify: (message: string) => void,
) {
  const [state, setState] = useState("端末に保存");
  useEffect(() => {
    if (!authenticated) {
      setState("端末に保存");
      return;
    }
    let busy = false,
      cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function sync() {
      if (busy || cancelled) return;
      if (!navigator.onLine) {
        setState("オフライン・同期待ち");
        return;
      }
      busy = true;
      setState("同期中");
      try {
        for (let i = 0; i < 100 && !cancelled; i++) {
          const snapshot = store.getSnapshot();
          const task = snapshot.tasks.find((item) =>
            snapshot.pending.includes(item.id),
          );
          if (!task) break;
          const response = await fetch(`/api/tasks/${task.id}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(task),
            signal: AbortSignal.timeout(15000),
          });
          const body = (await response.json()) as {
            task?: unknown;
            error?: string;
          };
          if (cancelled) return;
          if (response.status === 409 && body.task) {
            store.conflict(task, taskSchema.parse(body.task));
            notify("端末とクラウドの変更を両方保持しました。");
          } else if (response.ok)
            store.acknowledge(task, taskSchema.parse(body.task));
          else throw new Error(body.error ?? "同期できませんでした。");
        }
        const result = await api<{ tasks: unknown }>("/api/tasks");
        if (cancelled) return;
        store.merge(z.array(taskSchema).parse(result.tasks));
        setState(store.getSnapshot().pending.length ? "同期待ち" : "同期済み");
      } catch (error) {
        if (!cancelled) {
          setState("同期待ち");
          notify(
            error instanceof Error ? error.message : "同期できませんでした。",
          );
        }
      } finally {
        busy = false;
      }
    }
    const schedule = () => {
      if (!busy) {
        clearTimeout(timer);
        timer = setTimeout(sync, 450);
      }
    };
    let lastTasks = store.getSnapshot().tasks;
    const unsubscribe = store.subscribe(() => {
      const tasks = store.getSnapshot().tasks;
      if (tasks !== lastTasks) {
        lastTasks = tasks;
        schedule();
      }
    });
    const offline = () => setState("オフライン・同期待ち");
    window.addEventListener("online", schedule);
    window.addEventListener("offline", offline);
    const interval = setInterval(sync, 20000);
    void sync();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("online", schedule);
      window.removeEventListener("offline", offline);
    };
  }, [store, authenticated, notify]);
  return state;
}
