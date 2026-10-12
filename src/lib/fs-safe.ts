import { link, lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";

import { BrainError } from "./errors.ts";

export type AtomicWriteData = string | Uint8Array;

export interface WritableTarget {
  root: string;
  target: string;
  parent: string;
}

/**
 * Resolve a write target inside a root: the target and its real parent must be contained,
 * the parent must exist, and an existing target must not be a symbolic link.
 * Every refusal is an OUTSIDE_ROOT BrainError (spec/cli.md §3.6.4).
 */
export async function resolveWritableTarget(rootDirectory: string, targetPath: string): Promise<WritableTarget> {
  const root = await realpath(resolve(rootDirectory));
  const target = isAbsolute(targetPath) ? resolve(targetPath) : resolve(root, targetPath);
  assertContained(root, target);

  const parent = await realpath(dirname(target));
  assertContained(root, parent);

  try {
    const targetMetadata = await lstat(target);
    if (targetMetadata.isSymbolicLink()) {
      throw new BrainError("OUTSIDE_ROOT", `Refusing to replace a symbolic link: ${target}`);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  return { root, target, parent };
}

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
  const { root: brainRoot, target, parent } = await resolveWritableTarget(brainDirectory, targetPath);

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

/**
 * Atomically create a file, refusing to replace anything that appeared after the caller scanned
 * the directory. Linking the completed temporary file is exclusive: unlike rename, it fails with
 * EEXIST rather than overwriting a concurrent writer's file.
 */
export async function atomicCreateFile(
  brainDirectory: string,
  targetPath: string,
  data: AtomicWriteData,
  linkFile: typeof link = link,
): Promise<void> {
  const { root: brainRoot, target, parent } = await resolveWritableTarget(brainDirectory, targetPath);
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
    try {
      await linkFile(temporary, target);
    } catch (error) {
      if (!isNodeError(error) || !["ENOTSUP", "EPERM", "ENOSYS", "EXDEV"].includes(error.code ?? "")) {
        if (isNodeError(error) && error.code === "EEXIST") throw new BrainError("WRITE_CONFLICT", `A file appeared while creating ${target}`);
        throw error;
      }
      const direct = await open(target, "wx", 0o600).catch((openError: unknown) => {
        if (isNodeError(openError) && openError.code === "EEXIST") throw new BrainError("WRITE_CONFLICT", `A file appeared while creating ${target}`);
        throw openError;
      });
      try {
        await direct.writeFile(data);
        await direct.sync();
      } catch (writeError) {
        await unlink(target).catch(() => undefined);
        throw writeError;
      } finally {
        await direct.close().catch(() => undefined);
      }
    }
    await unlink(temporary).catch(() => undefined);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/**
 * Create a directory (and parents) inside a root, refusing anything that resolves outside it.
 * The nearest existing ancestor is checked with realpath so a symlinked folder cannot escape.
 */
export async function ensureDirectory(rootDirectory: string, targetPath: string): Promise<void> {
  const root = await realpath(resolve(rootDirectory));
  const target = isAbsolute(targetPath) ? resolve(targetPath) : resolve(root, targetPath);
  assertContained(root, target);

  let existing = target;
  while (true) {
    try {
      assertContained(root, await realpath(existing));
      break;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
      existing = dirname(existing);
    }
  }
  await mkdir(target, { recursive: true });
}

/** Throw unless target is the brain root or one of its descendants. */
export function assertPathInsideBrain(brainRoot: string, target: string): void {
  assertContained(resolve(brainRoot), resolve(target));
}

function assertContained(root: string, target: string): void {
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === "") return;
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new BrainError("OUTSIDE_ROOT", `Refusing to write outside the brain directory: ${target}`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
