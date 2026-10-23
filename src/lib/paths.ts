/** Slugs and paths for new files (spec/cli.md §3.8). */

/** `"María López — PM"` → `maria-lopez-pm`; at most 60 characters, never cutting a word. */
export function slugify(title: string): string {
  let slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 60) {
    slug = slug.slice(0, 60);
    const cut = slug.lastIndexOf("-");
    if (cut !== -1) slug = slug.slice(0, cut);
  }
  return slug === "" ? "note" : slug;
}

/**
 * The path of a new file of `type`, or for a project its folder's `project.md`. `date` is the
 * note's `date`, else the input `file_date`, else `created`. `taken` says whether a path (for
 * projects: the folder) already exists; `-2`, `-3`, … are appended until it is free.
 */
export function newNotePath(type: string, title: string, date: string, taken: (path: string) => boolean, sourceKey?: unknown): string {
  const base = slugify(title);
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const { path, claim } = layout(type, slug, date, sourceKey);
    if (!taken(claim)) return path;
  }
}

/** The folder for a source key (decision 0032). Unknown keys stay in the legacy notion folder for schema validation. */
export function sourceFolder(sourceKey: unknown): "notion" | "files" | "text" {
  if (typeof sourceKey === "string") {
    if (sourceKey.startsWith("file:")) return "files";
    if (sourceKey.startsWith("url:") || sourceKey.startsWith("agent:")) return "text";
  }
  return "notion";
}

function layout(type: string, slug: string, date: string, sourceKey?: unknown): { path: string; claim: string } {
  const file = (path: string) => ({ path, claim: path });
  switch (type) {
    case "area": return file(`areas/${slug}.md`);
    case "goal": return file(`goals/${slug}.md`);
    case "project": return { path: `projects/${slug}/project.md`, claim: `projects/${slug}` };
    case "person": return file(`knowledge/people/${slug}.md`);
    case "org": return file(`knowledge/orgs/${slug}.md`);
    case "question": return file(`knowledge/questions/${slug}.md`);
    case "concept": return file(`knowledge/concepts/${slug}.md`);
    case "reference": return file(`knowledge/references/${slug}.md`);
    case "meeting": return file(`knowledge/meetings/${date}-${slug}.md`);
    case "decision": return file(`knowledge/decisions/${date}-${slug}.md`);
    case "source": return file(`sources/${sourceFolder(sourceKey)}/${date}-${slug}.md`);
    case "memory": return file(`memories/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}-${slug}.md`);
    case "proposal": return file(`_proposals/${date}-${slug}.md`);
    default: throw new Error(`No path layout for type ${type}`);
  }
}
