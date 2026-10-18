import { z } from "zod";

export const statuses = ["inbox", "doing", "done"] as const;
export type Status = (typeof statuses)[number];
export const labels: Record<Status, string> = {
  inbox: "未着手",
  doing: "進行中",
  done: "完了",
};
export const taskSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(300),
    notes: z.string().max(5000),
    status: z.enum(statuses),
    starred: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    revision: z.number().int().min(0),
    deleted: z.boolean(),
  })
  .strict();
export type Task = z.infer<typeof taskSchema>;
export function createTask(text: string): Task {
  const [title, ...lines] = text.trim().split("\n");
  const now = new Date().toISOString();
  if (!title) throw new Error("タスク名を入力してください。");
  if (title.length > 300)
    throw new Error("1行目のタスク名は300文字以内にしてください。");
  if (lines.join("\n").length > 5000)
    throw new Error("詳細は5000文字以内にしてください。");
  return taskSchema.parse({
    id: crypto.randomUUID(),
    title,
    notes: lines.join("\n"),
    status: "inbox",
    starred: false,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    deleted: false,
  });
}
export function moveStatus(status: Status, direction: -1 | 1): Status {
  return statuses[
    Math.max(0, Math.min(2, statuses.indexOf(status) + direction))
  ];
}
export function flickDirection(
  x: number,
  y: number,
  velocity: number,
): -1 | 0 | 1 {
  if (Math.abs(y) > Math.abs(x) || Math.abs(x) < 28) return 0;
  if (
    Math.abs(x) >= 76 ||
    (Math.abs(velocity) > 520 && Math.sign(x) === Math.sign(velocity))
  )
    return x > 0 ? 1 : -1;
  return 0;
}
export function mergeTasks(
  local: Task[],
  remote: Task[],
  pending: string[],
): Task[] {
  const merged = new Map(remote.map((task) => [task.id, task]));
  for (const task of local) {
    if (pending.includes(task.id) || !merged.has(task.id))
      merged.set(task.id, task);
  }
  return [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
