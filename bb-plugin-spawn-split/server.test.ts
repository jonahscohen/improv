import { describe, it, expect, vi } from "vitest";
import { buildSpawnPlan, runSpawnSplit } from "./server";

describe("buildSpawnPlan", () => {
  it("expands count into one entry per split", () => {
    const plan = buildSpawnPlan({ prompt: "do x", env: "worktree", count: 3, split: "right" });
    expect(plan).toHaveLength(3);
    expect(plan.every((p) => p.env === "worktree")).toBe(true);
  });

  it("derives a fallback title <=60 chars from a truncated prompt when title is absent", () => {
    const long = "a".repeat(120);
    const [entry] = buildSpawnPlan({ prompt: long, env: "shared", count: 1, split: "right" });
    expect(entry.title.length).toBeLessThanOrEqual(60);
    expect(entry.env).toBe("shared");
  });

  it("keeps an explicit title", () => {
    const [entry] = buildSpawnPlan({ prompt: "x", title: "Review", env: "worktree", count: 1, split: "right" });
    expect(entry.title).toBe("Review");
  });

  it("carries split and env through every entry", () => {
    const plan = buildSpawnPlan({ prompt: "x", env: "shared", count: 2, split: "down" });
    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.split === "down" && p.env === "shared")).toBe(true);
  });
});

function makeCtx(overrides: Partial<{ threadId: string; projectId: string }> = {}) {
  return {
    threadId: overrides.threadId ?? "thr_parent",
    projectId: overrides.projectId ?? "proj_1",
    signal: new AbortController().signal,
  };
}

describe("runSpawnSplit", () => {
  it("worktree env: spawns N threads with worktree environment and opens each split, no threads.get call", async () => {
    let n = 0;
    const spawnCalls: any[] = [];
    const openCalls: any[] = [];
    const bb = {
      sdk: {
        threads: {
          get: vi.fn(),
          spawn: vi.fn(async (args: any) => {
            spawnCalls.push(args);
            n += 1;
            return { id: `thr_${n}` };
          }),
          open: vi.fn(async (args: any) => {
            openCalls.push(args);
            return {};
          }),
        },
      },
    };
    const ctx = makeCtx();
    const result = await runSpawnSplit(bb as any, { prompt: "do x", env: "worktree", count: 2, split: "right" } as any, ctx);

    expect(bb.sdk.threads.get).not.toHaveBeenCalled();
    expect(spawnCalls).toHaveLength(2);
    for (const call of spawnCalls) {
      expect(call.parentThreadId).toBe("thr_parent");
      expect(call.environment).toEqual({
        type: "host",
        workspace: { type: "managed-worktree", baseBranch: { kind: "default" } },
      });
    }
    expect(openCalls).toHaveLength(2);
    expect(openCalls.map((c) => c.threadId)).toEqual(["thr_1", "thr_2"]);
    for (const call of openCalls) {
      expect(call.split).toBe("right");
      expect(call.file).toBeNull();
    }
    expect(result.isError).toBeFalsy();
    const text = typeof result === "string" ? result : result.content[0].text;
    expect(text).toContain("Spawned 2 split(s): thr_1, thr_2");
  });

  it("shared env: calls threads.get and spawns with a reuse environment", async () => {
    const bb = {
      sdk: {
        threads: {
          get: vi.fn(async () => ({ environmentId: "env_caller" })),
          spawn: vi.fn(async () => ({ id: "thr_1" })),
          open: vi.fn(async () => ({})),
        },
      },
    };
    const ctx = makeCtx();
    await runSpawnSplit(bb as any, { prompt: "do x", env: "shared", count: 1, split: "left" } as any, ctx);

    expect(bb.sdk.threads.get).toHaveBeenCalledWith({ threadId: "thr_parent" });
    const spawnArgs = (bb.sdk.threads.spawn as any).mock.calls[0][0];
    expect(spawnArgs.environment).toEqual({ type: "reuse", environmentId: "env_caller" });
  });

  it("partial failure: reports 1 spawned + 1 failed, isError false", async () => {
    let call = 0;
    const bb = {
      sdk: {
        threads: {
          get: vi.fn(),
          spawn: vi.fn(async () => {
            call += 1;
            if (call === 2) throw new Error("boom");
            return { id: `thr_${call}` };
          }),
          open: vi.fn(async () => ({})),
        },
      },
    };
    const ctx = makeCtx();
    const result = await runSpawnSplit(bb as any, { prompt: "do x", env: "worktree", count: 2, split: "right" } as any, ctx);
    const text = typeof result === "string" ? result : result.content[0].text;
    expect(text).toContain("Spawned 1 split(s): thr_1");
    expect(text).toContain("Failed 1");
    expect(result.isError).toBeFalsy();
  });

  it("shared env with no caller environmentId: that entry fails, isError true when all fail", async () => {
    const bb = {
      sdk: {
        threads: {
          get: vi.fn(async () => ({ environmentId: null })),
          spawn: vi.fn(async () => ({ id: "thr_1" })),
          open: vi.fn(async () => ({})),
        },
      },
    };
    const ctx = makeCtx();
    const result = await runSpawnSplit(bb as any, { prompt: "do x", env: "shared", count: 1, split: "right" } as any, ctx);
    expect(bb.sdk.threads.spawn).not.toHaveBeenCalled();
    const text = typeof result === "string" ? result : result.content[0].text;
    expect(text).toContain("Failed 1");
    expect(text).toContain("cannot resolve caller environment");
    expect(result.isError).toBe(true);
  });
});
