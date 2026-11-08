// Okapi BM25 over in-memory documents (spec/cli.md §5.13 step 3).
// Adapted from claude-obsidian scripts/bm25-index.py (`build_index`, `query`: k1 = 1.5, b = 0.75,
// idf = ln(1 + (N − df + 0.5) / (df + 0.5))) at commit 2e545563172f97f02ecaaaab376ceea1246a0583, MIT License,
// Copyright (c) 2026 AgriciDaniel. Written in TypeScript from reading the file, through eval/retrieval-0.12/bm25.ts;
// none of its code is run. Left out: the JSON index on disk, its schema validation and the vault lock (the CLI keeps no index).
// Added here: the prefix match, so a word matches as cli.md §5.13 says (`deci` matches `decision`); an exact term matches only itself.

const K1 = 1.5;
const B = 0.75;

/** BM25 scores of every document for the query's terms, in document order (0 where none matches).
 *  A repeated query term counts each time; `exact(term)` says a term matches only itself, otherwise it matches every
 *  document term that starts with it: its frequency in a document is the sum over those terms, its df the documents with any. */
export function bm25Scores(docs: readonly (readonly string[])[], query: readonly string[], exact: (term: string) => boolean): number[] {
  const tfs = docs.map((terms) => {
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    return tf;
  });
  const n = docs.length;
  const avg = docs.reduce((sum, terms) => sum + terms.length, 0) / (n || 1) || 1;
  const vocab = new Set(tfs.flatMap((tf) => [...tf.keys()]));

  // Per distinct query term: its frequency in each document and its idf.
  const perTerm = new Map<string, { freq: number[]; idf: number }>();
  for (const term of new Set(query)) {
    const matching = exact(term) ? (vocab.has(term) ? [term] : []) : [...vocab].filter((word) => word.startsWith(term));
    const freq = tfs.map((tf) => matching.reduce((sum, word) => sum + (tf.get(word) ?? 0), 0));
    const df = freq.filter((f) => f > 0).length;
    perTerm.set(term, { freq, idf: Math.log(1 + (n - df + 0.5) / (df + 0.5)) });
  }

  return docs.map((terms, i) => {
    let score = 0;
    for (const term of query) {
      const { freq, idf } = perTerm.get(term)!;
      const f = freq[i]!;
      if (f === 0) continue;
      score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * terms.length) / avg));
    }
    return score;
  });
}
