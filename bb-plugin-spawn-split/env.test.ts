import { describe, it, expect } from "vitest";
import { resolveEnvironment } from "./env";

describe("resolveEnvironment", () => {
  it("returns a fresh managed worktree with the resolved hostId for env=worktree", () => {
    expect(resolveEnvironment("worktree", "env_abc", "host_x")).toEqual({
      type: "host",
      hostId: "host_x",
      workspace: { type: "managed-worktree", baseBranch: { kind: "default" } },
    });
  });
  it("throws for env=worktree with no resolved hostId", () => {
    expect(() => resolveEnvironment("worktree", "env_abc", null)).toThrow(
      /cannot resolve a host for env=worktree/,
    );
  });
  it("returns a reuse env for env=shared", () => {
    expect(resolveEnvironment("shared", "env_abc", null)).toEqual({ type: "reuse", environmentId: "env_abc" });
  });
  it("throws for env=shared with no caller environment", () => {
    expect(() => resolveEnvironment("shared", null, null)).toThrow(/cannot resolve caller environment/);
  });
});
