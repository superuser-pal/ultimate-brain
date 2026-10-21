/** A source body's numbered parts (spec/schema.md §4 "Parts", 0043). */
export interface SourceParts {
  kind: "slides" | "sections";
  /** Text before the first part; always included. */
  preamble: string;
  parts: string[];
}

const SLIDE = /^<!-- Slide number: \d+ -->$/;
const HEADING = /^(#{1,6}) /;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Split a body into parts: slides when it has a slide marker, else the ATX headings outside
 * fenced code at the smallest level present, else one part holding the whole body.
 */
export function splitParts(body: string): SourceParts {
  const lines = body.split(/(?<=\n)/);
  const bare = (line: string) => line.replace(/\n$/, "");
  const slides = lines.some((line) => SLIDE.test(bare(line)));
  let starts: number[];
  if (slides) {
    starts = lines.flatMap((line, index) => (SLIDE.test(bare(line)) ? [index] : []));
  } else {
    const headings: Array<{ index: number; level: number }> = [];
    let fence: string | undefined;
    lines.forEach((line, index) => {
      const open = FENCE.exec(line)?.[1];
      if (fence !== undefined) {
        if (open !== undefined && open[0] === fence[0] && open.length >= fence.length && bare(line).trim() === open) fence = undefined;
        return;
      }
      if (open !== undefined) { fence = open; return; }
      const level = HEADING.exec(line)?.[1]?.length;
      if (level !== undefined) headings.push({ index, level });
    });
    const smallest = Math.min(...headings.map(({ level }) => level));
    starts = headings.filter(({ level }) => level === smallest).map(({ index }) => index);
  }
  if (starts.length === 0) return { kind: "sections", preamble: "", parts: [body] };
  const parts = starts.map((start, i) => lines.slice(start, starts[i + 1] ?? lines.length).join(""));
  return { kind: slides ? "slides" : "sections", preamble: lines.slice(0, starts[0]).join(""), parts };
}

/** Why a `notion_parts` list is invalid for a body of `count` parts, or null when it is valid. */
export function rangesProblem(ranges: readonly unknown[], count?: number): string | null {
  if (ranges.length === 0) return "must list at least one part";
  let previous = 0;
  for (const range of ranges) {
    const match = typeof range === "string" ? /^([1-9]\d*)(?:-([1-9]\d*))?$/.exec(range) : null;
    if (match === null) return `"${String(range)}" is not a part number or a range n-m`;
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (match[2] !== undefined && from >= to) return `"${range}" must run from a lower to a higher part`;
    if (from <= previous) return `"${range}" is out of order or overlaps the range before it`;
    if (count !== undefined && to > count) return `"${range}" is above the body's ${count} part${count === 1 ? "" : "s"}`;
    previous = to;
  }
  return null;
}

/** The 1-based part numbers a valid range list names, ascending. */
export function selectedParts(ranges: readonly string[]): number[] {
  return ranges.flatMap((range) => {
    const [from, to = from] = range.split("-").map(Number) as [number, number?];
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
}

/**
 * The "Full text" section of a source (spec/cli.md §5.14.4): the preamble, then the chosen
 * parts in order; a partial choice starts with a line naming it (`*Slides 3–9 of 12*`).
 */
export function fullText(body: string, ranges: readonly string[] | null): string {
  const { kind, preamble, parts } = splitParts(body);
  const chosen = ranges === null ? parts : selectedParts(ranges).map((n) => parts[n - 1]!);
  const text = `${preamble}${chosen.join("")}`;
  if (ranges === null) return text;
  const label = `*${kind === "slides" ? "Slides" : "Sections"} ${ranges.map((range) => range.replace("-", "–")).join(", ")} of ${parts.length}*`;
  return `${label}\n\n${text}`;
}
