/**
 * Since Git 2.5x every commit starts a detached `git maintenance run --auto`, which can still be writing into `.git/objects`
 * (a repack, then `.git/info/refs` and `.git/objects/info/packs`) while a test removes its temp repo, and the removal fails
 * with ENOTEMPTY (CC-158, CC-230). A test file calls this once, before any git runs: every git it starts, directly or through a
 * script or the in-process CLI, inherits this environment, so automatic maintenance and gc are off for the whole test process.
 * Added after any GIT_CONFIG_* entries already set, so those keep their meaning. No imports: the release scripts' tests load it.
 */
export function disableGitAutoMaintenance(env: NodeJS.ProcessEnv = process.env): void {
  const count = Number(env.GIT_CONFIG_COUNT ?? 0) || 0;
  const entries: Array<[string, string]> = [["maintenance.auto", "false"], ["gc.auto", "0"]];
  entries.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${count + index}`] = key;
    env[`GIT_CONFIG_VALUE_${count + index}`] = value;
  });
  env.GIT_CONFIG_COUNT = String(count + entries.length);
}
