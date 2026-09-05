import { describe, it, expect } from "vitest";
import { resolveEnvironment } from "./env";

describe("resolveEnvironment", () => {
  it("returns a fresh managed worktree for env=worktree, ignoring caller env", () => {
    expect(resolveEnvironment("worktree", "env_abc")).toEqual({
      type: "host",
      workspace: { type: "managed-worktree", baseBranch: { kind: "default" } },
    });
  });
  it("returns a reuse env for env=shared", () => {
    expect(resolveEnvironment("shared", "env_abc")).toEqual({ type: "reuse", environmentId: "env_abc" });
  });
  it("throws for env=shared with no caller environment", () => {
    expect(() => resolveEnvironment("shared", null)).toThrow(/cannot resolve caller environment/);
  });
});
