/**
 * The response style (decision 0081; spec/schema.md §12 `settings.style`, spec/cli.md §5.3.1): the effective dials, the style lines,
 * the brain's style block in AGENTS.md and the style paragraph of a linked folder's block.
 */

export interface Style { preset: "standard" | "simple"; explain: string; length: string; directness: string }

const DIALS = {
  explain: ["expert", "some", "plain"],
  length: ["short", "normal", "full"],
  directness: ["answer-first", "context-first"],
} as const;
type Dial = keyof typeof DIALS;

const PRESETS: Record<Style["preset"], Record<Dial, string>> = {
  standard: { explain: "some", length: "normal", directness: "context-first" },
  simple: { explain: "plain", length: "short", directness: "answer-first" },
};

/** cli.md §5.3.1's table, normative bytes; Standard's levels have no line. */
const LINES: Record<Dial, Record<string, string>> = {
  explain: {
    expert: "Don't define terms: the user knows them.",
    plain: "Use plain words and no jargon. When a term is needed, explain it with a short example the first time you use it.",
  },
  length: {
    short: "Keep answers short: show at most five items at a time, say how many more there are, and show them when the user says \"more\".",
    full: "Give full answers: the details and the reasons, not only the outcome.",
  },
  directness: {
    "answer-first": "Put the answer or the next action on the first line. In work with several steps, say where the user is (\"step 3 of 5\") in every reply.",
  },
};

export const STYLE_START = "<!-- ultimate-brain:style:start -->";
export const STYLE_END = "<!-- ultimate-brain:style:end -->";
const RULES_START = /^<!-- ultimate-brain:rules:start\b[^\n]*-->$/gm;
const RULES_END = "<!-- ultimate-brain:rules:end -->";

/**
 * The stored preset and each dial's effective value. A key whose value the schema doesn't allow counts as absent, and a `style` that
 * isn't an object as `{}` (cli.md §5.15 step 1a: `upgrade` also reads a `brain.json` that fails the schema).
 */
export function effectiveStyle(config: Record<string, unknown>): Style {
  const settings = isRecord(config.settings) ? config.settings : {};
  const stored = isRecord(settings.style) ? settings.style : {};
  const preset = stored.preset === "simple" ? "simple" : "standard";
  const value = (dial: Dial): string => {
    const set = stored[dial];
    return typeof set === "string" && (DIALS[dial] as readonly string[]).includes(set) ? set : PRESETS[preset][dial];
  };
  return { preset, explain: value("explain"), length: value("length"), directness: value("directness") };
}

/** One line per dial whose effective value isn't Standard's, in the order explain, length, directness. */
export function styleLines(config: Record<string, unknown>): string[] {
  const style = effectiveStyle(config);
  return (Object.keys(DIALS) as Dial[]).flatMap((dial) => LINES[dial][style[dial]] ?? []);
}

/** The style block of the brain's AGENTS.md (§5.3.1), without a trailing newline. */
export function styleBlock(lines: readonly string[]): string {
  return [
    STYLE_START,
    "## How to answer me",
    "",
    "Written by `brain` from `settings.style` in `brain.json`; edits inside this block are overwritten. To change it, ask in this brain (\"talk to me more simply\", \"shorter answers\", \"go back to normal\"). It shapes your own words only: show text a command returns, such as a report, exactly as it is.",
    "",
    ...lines.map((line) => `- ${line}`),
    STYLE_END,
  ].join("\n");
}

/** The style paragraph of a linked folder's instruction block (§5.3.1, §5.12), without a trailing newline. */
export function styleParagraph(lines: readonly string[]): string {
  return [
    "The user's response style, from the brain's `settings.style`. It shapes your own words only; show text a command returns exactly as it is.",
    ...lines.map((line) => `- ${line}`),
  ].join("\n");
}

export type StyleAction = "created" | "updated" | "removed" | "unchanged";

/**
 * The brain's AGENTS.md with its style block written, replaced or removed for `lines` (§5.3.1 "Where"), or `undefined` when the rules
 * markers or the style markers are missing, out of order or duplicated (the caller reports `skipped`, `AGENTS_BLOCK_NOT_FOUND`).
 * A new block goes after one blank line right after the rules end marker; removing one also removes that blank line, so adding then
 * removing restores the bytes.
 */
export function withStyleBlock(text: string, lines: readonly string[]): { text: string; action: StyleAction } | undefined {
  const rulesStarts = [...text.matchAll(RULES_START)].map((match) => match.index!);
  const rulesEnds = lineStarts(text, RULES_END);
  if (rulesStarts.length !== 1 || rulesEnds.length !== 1 || rulesEnds[0]! < rulesStarts[0]!) return undefined;
  const rulesEnd = rulesEnds[0]! + RULES_END.length;
  const starts = lineStarts(text, STYLE_START);
  const ends = lineStarts(text, STYLE_END);
  if (starts.length > 1 || ends.length > 1 || starts.length !== ends.length) return undefined;

  if (starts.length === 0) {
    if (lines.length === 0) return { text, action: "unchanged" };
    return { text: `${text.slice(0, rulesEnd)}\n\n${styleBlock(lines)}${text.slice(rulesEnd)}`, action: "created" };
  }
  const start = starts[0]!;
  const end = ends[0]! + STYLE_END.length;
  if (end < start || start < rulesEnd) return undefined;
  if (lines.length > 0) {
    const next = `${text.slice(0, start)}${styleBlock(lines)}${text.slice(end)}`;
    return { text: next, action: next === text ? "unchanged" : "updated" };
  }
  // Remove the block's lines and the one blank line before its start marker.
  const blankBefore = text.slice(0, start).endsWith("\n\n");
  if (text[end] === "\n") return { text: `${text.slice(0, blankBefore ? start - 1 : start)}${text.slice(end + 1)}`, action: "removed" };
  return { text: `${text.slice(0, blankBefore ? start - 2 : start)}${text.slice(end)}`, action: "removed" };
}

/** The offsets of the lines that are exactly `marker`. */
function lineStarts(text: string, marker: string): number[] {
  const out: number[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    if (line === marker) out.push(at);
    at += line.length + 1;
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
