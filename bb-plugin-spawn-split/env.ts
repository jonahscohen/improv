export type SpawnEnvironment =
  | {
      type: "host";
      hostId: string;
      workspace: { type: "managed-worktree"; baseBranch: { kind: "default" } };
    }
  | { type: "reuse"; environmentId: string };

// A managed-worktree environment REQUIRES a hostId at runtime - the daemon
// rejects a host-type environment with HTTP 400 ("hostId is required unless
// workspace.type is personal") when it is omitted. See CONTRACTS.md section
// 1 for the resolution strategy the caller (server.ts) uses to find one.
export function resolveEnvironment(
  env: "worktree" | "shared",
  callerEnvironmentId: string | null,
  hostId: string | null,
): SpawnEnvironment {
  if (env === "worktree") {
    if (!hostId) {
      throw new Error("spawn_split: cannot resolve a host for env=worktree");
    }
    return {
      type: "host",
      hostId,
      workspace: { type: "managed-worktree", baseBranch: { kind: "default" } },
    };
  }
  if (!callerEnvironmentId) {
    throw new Error("spawn_split: cannot resolve caller environment for env=shared");
  }
  return { type: "reuse", environmentId: callerEnvironmentId };
}
