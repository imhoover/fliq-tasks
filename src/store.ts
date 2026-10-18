import { z } from "zod";
import { createTask, mergeTasks, taskSchema, type Task } from "../shared/tasks";

const snapshotSchema = z.object({
  tasks: z.array(taskSchema).max(5000),
  pending: z.array(z.string().uuid()),
  draft: z.string().max(5301),
  draftToken: z.string().default(""),
});
const draftSchema = z.object({
  draft: z.string().max(5300),
  token: z.string().uuid(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class TaskStore {
  private listeners = new Set<() => void>();
  private state: Snapshot = {
    tasks: [],
    pending: [],
    draft: "",
    draftToken: "",
  };
  readonly key: string;
  constructor(
    private storage: Storage,
    namespace: string,
  ) {
    this.key = `fliq.v1.${namespace}`;
    const saved = storage.getItem(this.key);
    if (saved) this.state = snapshotSchema.parse(JSON.parse(saved));
    const savedDraft = storage.getItem(`${this.key}.draft`);
    if (savedDraft) {
      const draft = draftSchema.parse(JSON.parse(savedDraft));
      if (draft.token !== this.state.draftToken)
        this.state = {
          ...this.state,
          draft: draft.draft,
          draftToken: draft.token,
        };
    }
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private commit(next: Snapshot) {
    if (next.tasks.length > 5000)
      throw new Error("端末の保存上限です。エクスポートして整理してください。");
    snapshotSchema.parse(next);
    this.write(this.key, JSON.stringify(next));
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
  private write(key: string, value: string) {
    try {
      this.storage.setItem(key, value);
    } catch {
      throw new Error(
        "端末に保存できません。入力内容をコピーして保管してください。",
      );
    }
  }
  draft(text: string) {
    const draft = draftSchema.parse({
      draft: text,
      token: crypto.randomUUID(),
    });
    // A small independent write keeps the capture path independent of library size.
    // The token lets an atomic task snapshot mark the old draft as consumed.
    this.write(`${this.key}.draft`, JSON.stringify(draft));
    this.state = { ...this.state, draft: text, draftToken: draft.token };
    this.listeners.forEach((listener) => listener());
  }
  save(task: Task, clearDraft = false) {
    const valid = taskSchema.parse(task);
    const tasks = [
      valid,
      ...this.state.tasks.filter((item) => item.id !== valid.id),
    ];
    this.commit({
      tasks,
      pending: [...new Set([...this.state.pending, task.id])],
      draft: clearDraft ? "" : this.state.draft,
      draftToken: this.state.draftToken,
    });
  }
  add(text: string) {
    const task = createTask(text);
    this.save(task, true);
    return task;
  }
  addMany(texts: string[]) {
    const tasks = texts.map(createTask);
    this.commit({
      ...this.state,
      tasks: [...tasks, ...this.state.tasks],
      pending: [...this.state.pending, ...tasks.map((task) => task.id)],
    });
  }
  update(
    id: string,
    patch: Partial<
      Pick<Task, "title" | "notes" | "status" | "starred" | "deleted">
    >,
  ) {
    const task = this.state.tasks.find((item) => item.id === id);
    if (task)
      this.save({ ...task, ...patch, updatedAt: new Date().toISOString() });
  }
  acknowledge(sent: Task, remote: Task) {
    const current = this.state.tasks.find((task) => task.id === sent.id);
    if (!current) return;
    const unchanged = JSON.stringify(current) === JSON.stringify(sent);
    this.commit({
      ...this.state,
      tasks: this.state.tasks.map((task) =>
        task.id === sent.id
          ? unchanged
            ? remote
            : { ...task, revision: remote.revision }
          : task,
      ),
      pending: unchanged
        ? this.state.pending.filter((id) => id !== sent.id)
        : this.state.pending,
    });
  }
  merge(remote: Task[]) {
    this.commit({
      ...this.state,
      tasks: mergeTasks(this.state.tasks, remote, this.state.pending),
    });
  }
  conflict(local: Task, remote: Task) {
    const current =
      this.state.tasks.find((task) => task.id === local.id) ?? local;
    const copy = {
      ...current,
      id: crypto.randomUUID(),
      revision: 0,
      deleted: false,
    };
    this.commit({
      ...this.state,
      tasks: [
        ...this.state.tasks.filter((task) => task.id !== local.id),
        remote,
        ...(!current.deleted ? [copy] : []),
      ],
      pending: [
        ...this.state.pending.filter((id) => id !== local.id),
        ...(!current.deleted ? [copy.id] : []),
      ],
    });
  }
  importGuest(guest: Snapshot) {
    const existing = new Set(this.state.tasks.map((task) => task.id));
    const incoming = guest.tasks
      .filter((task) => !task.deleted && !existing.has(task.id))
      .map((task) => ({ ...task, revision: 0 }));
    this.commit({
      ...this.state,
      tasks: [...incoming, ...this.state.tasks],
      pending: [
        ...new Set([...this.state.pending, ...incoming.map((task) => task.id)]),
      ],
    });
  }
}
