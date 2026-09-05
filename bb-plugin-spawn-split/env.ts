export type SpawnEnvironment =
  | { type: "host"; workspace: { type: "managed-worktree"; baseBranch: { kind: "default" } } }
  | { type: "reuse"; environmentId: string };

export function resolveEnvironment(
  env: "worktree" | "shared",
  callerEnvironmentId: string | null,
): SpawnEnvironment {
  if (env === "worktree") {
    return { type: "host", workspace: { type: "managed-worktree", baseBranch: { kind: "default" } } };
  }
  if (!callerEnvironmentId) {
    throw new Error("spawn_split: cannot resolve caller environment for env=shared");
  }
  return { type: "reuse", environmentId: callerEnvironmentId };
}
