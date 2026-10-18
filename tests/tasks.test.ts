import { describe, expect, it } from "vitest";
import {
  createTask,
  moveStatus,
  flickDirection,
  taskSchema,
  mergeTasks,
} from "../shared/tasks";

describe("capture", () => {
  it("rejects whitespace without inventing content", () => {
    expect(() => createTask("   \n")).toThrow();
  });
  it("preserves notes and defaults to inbox", () => {
    const task = createTask("  仕様を確認\n数字 120 と名前を保持  ");
    expect(task.title).toBe("仕様を確認");
    expect(task.notes).toBe("数字 120 と名前を保持");
    expect(task.status).toBe("inbox");
    expect(taskSchema.safeParse(task).success).toBe(true);
  });
  it("rejects oversized capture without truncating it", () => {
    expect(() => createTask("a".repeat(301))).toThrow();
  });
});
describe("flick status management", () => {
  it("advances and reverses while respecting boundaries", () => {
    expect(moveStatus("inbox", 1)).toBe("doing");
    expect(moveStatus("doing", 1)).toBe("done");
    expect(moveStatus("done", 1)).toBe("done");
    expect(moveStatus("doing", -1)).toBe("inbox");
    expect(moveStatus("inbox", -1)).toBe("inbox");
  });
  it("ignores short drags, vertical scroll and opposite release velocity", () => {
    expect(flickDirection(15, 0, 0)).toBe(0);
    expect(flickDirection(90, 140, 500)).toBe(0);
    expect(flickDirection(35, 5, -600)).toBe(0);
  });
  it("accepts deliberate drags or a short fast flick", () => {
    expect(flickDirection(95, 5, 0)).toBe(1);
    expect(flickDirection(-90, 5, 0)).toBe(-1);
    expect(flickDirection(35, 2, 650)).toBe(1);
  });
});
describe("sync and validation", () => {
  it("rejects unknown status, invalid dates and forged fields", () => {
    const task = createTask("check");
    expect(taskSchema.safeParse({ ...task, status: "admin" }).success).toBe(
      false,
    );
    expect(taskSchema.safeParse({ ...task, updatedAt: "bad" }).success).toBe(
      false,
    );
    expect(taskSchema.safeParse({ ...task, owner: "other" }).success).toBe(
      false,
    );
  });
  it("retains pending local content over stale remote snapshots", () => {
    const remote = createTask("remote");
    const local = { ...remote, title: "unsynced", revision: 2 };
    expect(mergeTasks([local], [remote], [local.id])[0].title).toBe("unsynced");
    expect(mergeTasks([remote], [local], [])[0].title).toBe("unsynced");
  });
});
