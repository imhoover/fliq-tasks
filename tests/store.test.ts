import { describe, it, expect } from "vitest";
import { TaskStore, type Storage } from "../src/store";

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
describe("durable capture", () => {
  it("persists a keystroke with a small write even with many saved tasks", () => {
    const storage = memory();
    const store = new TaskStore(storage, "guest");
    store.addMany(Array.from({ length: 200 }, (_, index) => `Task ${index}`));
    const original = storage.setItem;
    let writtenBytes = 0;
    storage.setItem = (key, value) => {
      writtenBytes = new TextEncoder().encode(value).length;
      original(key, value);
    };
    store.draft("即時入力");
    expect(writtenBytes).toBeLessThan(1000);
    expect(new TaskStore(storage, "guest").getSnapshot().draft).toBe(
      "即時入力",
    );
  });
  it("does not resurrect a consumed draft after saving a task", () => {
    const storage = memory();
    const store = new TaskStore(storage, "guest");
    store.draft("same text");
    store.add("same text");
    expect(new TaskStore(storage, "guest").getSnapshot().draft).toBe("");
    store.draft("same text");
    expect(new TaskStore(storage, "guest").getSnapshot().draft).toBe(
      "same text",
    );
  });
  it("survives refresh with draft and pending tasks intact", () => {
    const storage = memory();
    const store = new TaskStore(storage, "guest");
    store.draft("書きかけ");
    expect(new TaskStore(storage, "guest").getSnapshot().draft).toBe(
      "書きかけ",
    );
    const task = store.add("保存\n詳細");
    const loaded = new TaskStore(storage, "guest").getSnapshot();
    expect(loaded.tasks[0].notes).toBe("詳細");
    expect(loaded.draft).toBe("");
    expect(loaded.pending).toContain(task.id);
  });
  it("does not clear draft or falsely report a save when storage fails", () => {
    const storage = memory();
    const store = new TaskStore(storage, "guest");
    store.draft("大事なメモ");
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(() => store.add("大事なメモ")).toThrow("端末に保存できません");
    expect(store.getSnapshot().draft).toBe("大事なメモ");
    expect(store.getSnapshot().tasks).toHaveLength(0);
  });
  it("keeps accounts and guest data isolated", () => {
    const storage = memory();
    new TaskStore(storage, "user-a").add("private A");
    expect(new TaskStore(storage, "user-b").getSnapshot().tasks).toHaveLength(
      0,
    );
    expect(new TaskStore(storage, "guest").getSnapshot().tasks).toHaveLength(0);
  });
  it("keeps edits made during an in-flight save pending with the new server revision", () => {
    const store = new TaskStore(memory(), "a");
    const sent = store.add("v1");
    store.update(sent.id, { title: "v2" });
    store.acknowledge(sent, { ...sent, revision: 1 });
    expect(store.getSnapshot().tasks[0].title).toBe("v2");
    expect(store.getSnapshot().tasks[0].revision).toBe(1);
    expect(store.getSnapshot().pending).toContain(sent.id);
  });
  it("preserves both versions on conflict and queues a copy", () => {
    const store = new TaskStore(memory(), "a");
    const local = store.add("local");
    store.conflict(local, { ...local, title: "remote", revision: 3 });
    expect(
      store
        .getSnapshot()
        .tasks.map((task) => task.title)
        .sort(),
    ).toEqual(["local", "remote"]);
    expect(store.getSnapshot().pending).not.toContain(local.id);
    expect(store.getSnapshot().pending).toHaveLength(1);
  });
});
