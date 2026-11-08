// CJK n-grams for query terms (spec/cli.md §5.13 step 1, "Terms").
// Adapted from claude-obsidian scripts/bm25-index.py (`_script_runs`, `_cjk_ngrams`) at commit
// 2e545563172f97f02ecaaaab376ceea1246a0583, MIT License, Copyright (c) 2026 AgriciDaniel. Written in TypeScript from
// reading the file, through eval/retrieval-0.12/tokenize.ts (`brainWithCjk`); none of its code is run.
// This repo's adaptation: the CLI's own words for everything but CJK, and upstream's n-grams for the CJK runs the words drop.
// CJK runs are cut out before the words' NFKD, so marks such as the dakuten in が are never stripped from them.

const CJK: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x11ff], [0x3040, 0x309f], [0x30a0, 0x30ff], [0x3100, 0x312f], [0x3130, 0x318f], [0x31a0, 0x31bf],
  [0x31f0, 0x31ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa960, 0xa97f], [0xac00, 0xd7af], [0xd7b0, 0xd7ff],
  [0xf900, 0xfaff], [0xff66, 0xff9f], [0x20000, 0x2fa1f], [0x30000, 0x323af],
];

function isCjk(char: string): boolean {
  const code = char.codePointAt(0)!;
  return CJK.some(([start, end]) => code >= start && code <= end);
}

/** A term that is a CJK n-gram (its first character is CJK); the CLI's words are `[a-z0-9]` only. */
export function isCjkTerm(term: string): boolean {
  return term.length > 0 && isCjk(term);
}

/** 1-, 2- and 3-character n-grams of a CJK run, each size left to right. */
function ngrams(chars: readonly string[]): string[] {
  const out: string[] = [];
  for (const size of [1, 2, 3]) for (let i = 0; i + size <= chars.length; i++) out.push(chars.slice(i, i + size).join(""));
  return out;
}

/** NFKC, then the words of the non-CJK runs (joined by one space), then each CJK run's n-grams in order. */
export function withCjkNgrams(text: string, words: (text: string) => string[]): string[] {
  const other: string[] = [];
  const grams: string[] = [];
  let run: string[] = [];
  let cjk = false;
  const flush = () => {
    if (run.length === 0) return;
    if (cjk) grams.push(...ngrams(run));
    else other.push(run.join(""));
    run = [];
  };
  for (const char of text.normalize("NFKC")) {
    const next = isCjk(char);
    if (run.length > 0 && next !== cjk) flush();
    cjk = next;
    run.push(char);
  }
  flush();
  return [...words(other.join(" ")), ...grams];
}
