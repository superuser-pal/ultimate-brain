// Tokenisation for the BM25 piece.
// Adapted from claude-obsidian scripts/bm25-index.py (`tokenize`, `_script_runs`, `_cjk_ngrams`, STOPWORDS) at commit
// 2e545563172f97f02ecaaaab376ceea1246a0583, MIT License, Copyright (c) 2026 AgriciDaniel. Written in TypeScript from
// reading the file; none of its code is run. Left out: the input/term growth ceilings, which guard its on-disk index.

const STOPWORDS = new Set(
  "a an and are as at be by for from has have he her him his i if in is it its of on or that the their them they this to was were will with you your".split(" "),
);

// Python's `\w` under re.UNICODE: letters, digits and underscore, any script; in-word apostrophes and hyphens kept.
const TOKEN = /[\p{L}\p{N}_][\p{L}\p{N}_'\-]*/gu;

const CJK: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x11ff], [0x3040, 0x309f], [0x30a0, 0x30ff], [0x3100, 0x312f], [0x3130, 0x318f], [0x31a0, 0x31bf],
  [0x31f0, 0x31ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa960, 0xa97f], [0xac00, 0xd7af], [0xd7b0, 0xd7ff],
  [0xf900, 0xfaff], [0xff66, 0xff9f], [0x20000, 0x2fa1f], [0x30000, 0x323af],
];
const isCjk = (char: string): boolean => {
  const code = char.codePointAt(0)!;
  return CJK.some(([start, end]) => code >= start && code <= end);
};

/** Split a word wherever it enters or leaves a CJK script. */
function* scriptRuns(word: string): Generator<[string, boolean]> {
  const chars = Array.from(word);
  let start = 0;
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || isCjk(chars[i]!) !== isCjk(chars[start]!)) {
      yield [chars.slice(start, i).join(""), isCjk(chars[start]!)];
      start = i;
    }
  }
}

/** 1-, 2- and 3-character n-grams of an unsegmented CJK run. */
function ngrams(run: string): string[] {
  const chars = Array.from(run);
  const out: string[] = [];
  for (const size of [1, 2, 3]) for (let i = 0; i + size <= chars.length; i++) out.push(chars.slice(i, i + size).join(""));
  return out;
}

/** NFKC, lowercase, words of any script; CJK runs as n-grams; other words longer than one character and not a stopword. */
export function tokenize(text: string): string[] {
  const terms: string[] = [];
  for (const match of text.normalize("NFKC").matchAll(TOKEN)) {
    for (let [run, cjk] of scriptRuns(match[0].toLowerCase())) {
      if (cjk) {
        terms.push(...ngrams(run));
        continue;
      }
      run = run.replace(/^['_\-]+|['_\-]+$/g, "");
      if (Array.from(run).length > 1 && !STOPWORDS.has(run)) terms.push(run);
    }
  }
  return terms;
}

// This repo's adaptation, not upstream's: the CLI's words (cli.md §5.13 step 1: NFKD, accents dropped, [a-z0-9] runs) for
// everything but CJK, plus upstream's CJK n-grams for the runs the CLI drops today. CJK runs are cut out before the CLI's
// NFKD, so marks such as the dakuten in が are never stripped from them.
export function brainWithCjk(text: string, words: (text: string) => string[]): string[] {
  const other: string[] = [];
  const terms: string[] = [];
  for (const [run, cjk] of scriptRuns(text.normalize("NFKC"))) {
    if (cjk) terms.push(...ngrams(run));
    else other.push(run);
  }
  return [...words(other.join(" ")), ...terms];
}
