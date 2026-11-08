// Okapi BM25 over in-memory documents (whole notes or chunks).
// Adapted from claude-obsidian scripts/bm25-index.py (`build_index`, `query`: k1 = 1.5, b = 0.75,
// idf = ln(1 + (N − df + 0.5) / (df + 0.5))) at commit 2e545563172f97f02ecaaaab376ceea1246a0583, MIT License,
// Copyright (c) 2026 AgriciDaniel. Written in TypeScript from reading the file; none of its code is run.
// Left out: the JSON index on disk, its schema validation and the vault lock. Ties break by key, so the order is deterministic.
// Added here: the optional prefix match, so a ranking change could keep cli.md §5.13's matching rule.

export interface Doc {
  /** Unique within the index: a note id, or `<note id>:<chunk index>`. */
  key: string;
  terms: string[];
}

export interface Index {
  docs: { key: string; len: number; tf: Map<string, number> }[];
  df: Map<string, number>;
  avg: number;
  /** Query terms tokenised as the documents were. */
  tokenize: (text: string) => string[];
}

export function buildIndex(docs: readonly Doc[], tokenize: (text: string) => string[]): Index {
  const built = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc.terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    return { key: doc.key, len: doc.terms.length, tf };
  });
  const df = new Map<string, number>();
  for (const doc of built) for (const term of doc.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avg = built.reduce((sum, doc) => sum + doc.len, 0) / (built.length || 1) || 1;
  return { docs: built, df, avg, tokenize };
}

/** BM25 scores, best first. With `prefix`, a query term matches every indexed term it starts (cli.md §5.13's rule,
 *  `deci` matches `decision`): its frequency in a document is the sum over those terms, its df the documents with any. */
export function score(index: Index, query: string, options: { prefix?: boolean; k1?: number; b?: number } = {}): { key: string; score: number }[] {
  const { prefix = false, k1 = 1.5, b = 0.75 } = options;
  const n = index.docs.length;
  const vocab = prefix ? [...index.df.keys()] : [];
  // Upstream sums over every query term, repeats included.
  const terms = index.tokenize(query).map((term) => ({ term, matching: prefix ? vocab.filter((word) => word.startsWith(term)) : [term] }));
  const freq = (doc: Index["docs"][number], matching: string[]) => matching.reduce((sum, word) => sum + (doc.tf.get(word) ?? 0), 0);
  const df = new Map(terms.map(({ term, matching }) => [term, prefix ? index.docs.filter((doc) => freq(doc, matching) > 0).length : (index.df.get(term) ?? 0)]));
  const out: { key: string; score: number }[] = [];
  for (const doc of index.docs) {
    let s = 0;
    for (const { term, matching } of terms) {
      const f = freq(doc, matching);
      if (!f) continue;
      const d = df.get(term)!;
      s += (Math.log(1 + (n - d + 0.5) / (d + 0.5)) * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.len) / index.avg));
    }
    if (s > 0) out.push({ key: doc.key, score: s });
  }
  return out.sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}
