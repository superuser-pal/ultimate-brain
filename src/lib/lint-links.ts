/** Markdown link targets in a note body, shared by lint and reflection (spec/cli.md §5.10, §5.32). */

/** Targets of inline links (`[x](t)`, `[x](t "title")`, `[x](<t>)`) and reference definitions (`[x]: t`). */
export function linkTargets(line: string): string[] {
  const targets: string[] = [];
  for (const match of line.matchAll(/\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
    targets.push(match[1] ?? match[2]!);
  }
  const definition = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]*)>|(\S+))/.exec(line);
  if (definition !== null) targets.push(definition[1] ?? definition[2]!);
  return targets;
}

/** Percent-decode each path segment; a segment that is not valid encoding is kept as written. */
export function decodePath(path: string): string {
  return path.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }).join("/");
}
