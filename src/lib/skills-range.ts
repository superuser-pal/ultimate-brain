/** SemVer 2.0.0 precedence and the CLI range of a skill snapshot (spec/skills-delivery.md §1, §2.1). No build metadata. */

export interface Version { major: number; minor: number; patch: number; prerelease: string[] }
export interface Comparator { operator: ">=" | ">" | "<=" | "<" | "="; version: string }

const NUMBER = "(?:0|[1-9][0-9]*)";
const IDENTIFIER = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
const VERSION = new RegExp(`^(${NUMBER})\\.(${NUMBER})\\.(${NUMBER})(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?$`);
const COMPARATOR = /^(>=|>|<=|<|=)(.+)$/;

export function parseVersion(value: string): Version | undefined {
  const match = VERSION.exec(value);
  if (match === null) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] === undefined ? [] : match[4].split(".") };
}

/** Negative when `left` has lower precedence than `right`, 0 when equal. Both must parse. */
export function comparePrecedence(left: string, right: string): number {
  const a = parseVersion(left); const b = parseVersion(right);
  if (a === undefined || b === undefined) throw new Error(`not a version: ${a === undefined ? left : right}`);
  for (const key of ["major", "minor", "patch"] as const) if (a[key] !== b[key]) return a[key] - b[key];
  if (a.prerelease.length === 0 || b.prerelease.length === 0) return b.prerelease.length - a.prerelease.length;
  for (let index = 0; index < Math.min(a.prerelease.length, b.prerelease.length); index += 1) {
    const x = a.prerelease[index]!; const y = b.prerelease[index]!;
    if (x === y) continue;
    const xNumeric = /^[0-9]+$/.test(x); const yNumeric = /^[0-9]+$/.test(y);
    if (xNumeric && yNumeric) return Number(x) - Number(y);
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.prerelease.length - b.prerelease.length;
}

export function parseRange(range: string): Comparator[] | undefined {
  if (range === "") return undefined;
  const comparators: Comparator[] = [];
  for (const part of range.split(" ")) {
    const match = COMPARATOR.exec(part);
    if (match === null || parseVersion(match[2]!) === undefined) return undefined;
    comparators.push({ operator: match[1] as Comparator["operator"], version: match[2]! });
  }
  return comparators;
}

function holds(version: string, comparator: Comparator): boolean {
  const order = comparePrecedence(version, comparator.version);
  switch (comparator.operator) {
    case ">=": return order >= 0;
    case ">": return order > 0;
    case "<=": return order <= 0;
    case "<": return order < 0;
    case "=": return order === 0;
  }
}

function comparators(range: string): Comparator[] {
  const parsed = parseRange(range);
  if (parsed === undefined) throw new Error(`not a CLI range: ${range}`);
  return parsed;
}

export function satisfies(version: string, range: string): boolean {
  return comparators(range).every((comparator) => holds(version, comparator));
}

/** Fails a `<` or `<=` comparator, or an `=` comparator whose version it exceeds. */
export function isNewerThanRange(version: string, range: string): boolean {
  return comparators(range).some((comparator) => !holds(version, comparator)
    && (comparator.operator === "<" || comparator.operator === "<=" || (comparator.operator === "=" && comparePrecedence(version, comparator.version) > 0)));
}

/** Fails a `>` or `>=` comparator, or an `=` comparator whose version exceeds it. */
export function isOlderThanRange(version: string, range: string): boolean {
  return comparators(range).some((comparator) => !holds(version, comparator)
    && (comparator.operator === ">" || comparator.operator === ">=" || (comparator.operator === "=" && comparePrecedence(version, comparator.version) < 0)));
}
