import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";

export type AtomicWriteData = string | Uint8Array;

/**
 * Atomically replace a file inside a brain directory.
 *
 * The parent directory must already exist. Existing symlink targets are rejected,
 * and the real parent path is checked to prevent writes through escaping symlinks.
 */
export async function atomicWriteFile(
  brainDirectory: string,
  targetPath: string,
  data: AtomicWriteData,
): Promise<void> {
  const brainRoot = await realpath(resolve(brainDirectory));
  const target = isAbsolute(targetPath)
    ? resolve(targetPath)
    : resolve(brainRoot, targetPath);

  assertContained(brainRoot, target);

  const parent = await realpath(dirname(target));
  assertContained(brainRoot, parent);

  try {
    const targetMetadata = await lstat(target);
    if (targetMetadata.isSymbolicLink()) {
      throw new Error(`Refusing to replace a symbolic link: ${target}`);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  const temporary = resolve(
    parent,
    `.${basename(target)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  assertContained(brainRoot, temporary);

  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, target);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/** Throw unless target is the brain root or one of its descendants. */
export function assertPathInsideBrain(brainRoot: string, target: string): void {
  assertContained(resolve(brainRoot), resolve(target));
}

function assertContained(root: string, target: string): void {
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === "") return;
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new Error(`Refusing to write outside the brain directory: ${target}`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
