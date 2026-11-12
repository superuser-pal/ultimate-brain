import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Command, Warning } from "../lib/command.ts";
import { isProductRepository } from "../lib/brain-path.ts";
import { BrainError } from "../lib/errors.ts";
import { applyLinkedRepo, plannedAction, planLinkedRepo, type LinkSource } from "../lib/managed-block.ts";
import { scanNotes } from "../lib/notes.ts";
import { installedProduct } from "../lib/skills.ts";
import { competingCopies } from "../lib/skills-competing.ts";
import { homeOf, pinState, snapshotInvalid } from "../lib/skills-pin.ts";
import { packageProblem, packageSnapshot, sha256 } from "../lib/skills-snapshot.ts";

/** `brain link <repo-path>` (spec/cli.md §5.12). */
export const linkCommand: Command = {
  name: "link",
  usage: "brain link <repo-path> [--project <id>] [--area <id>] [--stack <name>]… [--repo-name <name>] [--json]",
  summary: "Link a consuming repository to this brain and install its consult instruction.",
  options: { project: "string", area: "string", stack: "list", "repo-name": "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, environment }) {
    const [requested] = args.positionals;
    if (requested === undefined) throw new BrainError("USAGE", "brain link needs a repository path");
    const root = await openRepo(requested);
    if (root === brain!.root || await isProductRepository(root)) {
      throw new BrainError("OUTSIDE_ROOT", "Refusing to write a brain or product repository as a consuming repository");
    }

    const warnings: Warning[] = [];
    const source = await linkSource(brain!.root, warnings);
    const { notes } = await scanNotes(brain!.root);
    const { planned, marker, retired, names } = await planLinkedRepo(root, { notes, config: brain!.config, source, options: args.options });
    await applyLinkedRepo(root, planned, retired);

    const competing = competingCopies({ treeRoot: root, names, home: homeOf(environment.env), brainRoot: brain!.root });
    if (competing.length > 0) warnings.push({ code: "SKILLS_COMPETING", message: `${competing.length} competing skill copies; see data.skills.competing and remove them.` });

    return {
      data: {
        repo_abs: root,
        marker: { path: ".brain", written: planned[0]!.before !== planned[0]!.after, value: marker },
        files: planned.slice(1).map((file) => ({ path: file.path, action: plannedAction(file) })),
        skills: { source: source.source, name: source.manifest.name, version: source.manifest.version, integrity: source.manifest.integrity, names, competing },
      },
      warnings,
      human: `Linked ${root} to the brain.\n`,
    };
  },
};

async function openRepo(requested: string): Promise<string> {
  const path = resolve(requested);
  try {
    if (!(await stat(path)).isDirectory()) throw new BrainError("USAGE", `Repository path is not a directory: ${path}`);
    return await realpath(path);
  } catch (error) {
    if (error instanceof BrainError) throw error;
    throw new BrainError("USAGE", `Repository path does not exist or cannot be read: ${path}`);
  }
}

/**
 * The linked skills and their source (spec/skills-delivery.md §6.2): a pinned brain's own `.agents/skills` copy, each file checked against
 * the lock before any write; an unpinned brain's package snapshot, which must be compatible.
 */
async function linkSource(brainRoot: string, warnings: Warning[]): Promise<LinkSource> {
  const product = installedProduct();
  const pin = pinState(brainRoot, () => product.version, { drift: false });
  if (pin.lock !== null) {
    const manifest = pin.lock.snapshot;
    const skills = manifest.skills.filter((skill) => skill.targets.includes("linked_repo"));
    for (const skill of skills) {
      for (const file of skill.files) {
        const path = `.agents/skills/${skill.name}/${file.path}`;
        let bytes: Buffer | null = null;
        try { if ((await lstat(join(brainRoot, path))).isFile()) bytes = await readFile(join(brainRoot, path)); } catch { /* missing */ }
        if (bytes === null || bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
          throw new BrainError("SKILLS_SNAPSHOT_MISSING", `${path} differs from the pinned skills (${manifest.name} ${manifest.version}). Run brain upgrade in the brain, then brain link again.`, {
            state: pin.state, name: manifest.name, version: manifest.version, cli: manifest.cli, running: product.version, installed_by: pin.lock.installed_by, path,
          });
        }
      }
    }
    return { source: "brain", manifest, folder: join(brainRoot, ".agents", "skills"), skills };
  }
  const pkg = packageSnapshot(product.root, product.version);
  const problem = packageProblem(pkg);
  if (problem !== null) throw snapshotInvalid(problem, product.version);
  warnings.push({ code: "SKILLS_UNPINNED", message: `The brain's skills are not pinned; the linked repo got the skills of ultimate-brain ${product.version}. Run brain upgrade in the brain.` });
  return { source: "package", manifest: pkg.manifest!, folder: pkg.folder, skills: pkg.manifest!.skills.filter((skill) => skill.targets.includes("linked_repo")) };
}

