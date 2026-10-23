// A local BM25 index over a brain's Markdown notes, for CC-50. No dependencies.
// Fields: title and aliases count 3 times, summary twice, the rest of the
// frontmatter and the body once (a simple BM25F). Tokens as `brain query`
// (cli.md §5.13): NFKD, no accents, lowercase, [a-z0-9] runs, length ≥ 2, same stopwords.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const STOP = new Set(
  ("a an and are as at be by did do does for from has have how in is it of on or that the this to was we what when where which who why will with " +
    "al como con de del el en es la las lo los para por que se su un una y").split(" "),
);
export function tokens(s) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

const SKIP = new Set([".git", ".agents", ".claude", "_proposals", "log", "memories", "sources"]);
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith(".md")) yield p;
  }
}

export function build(brain) {
  const docs = [];
  for (const path of walk(brain)) {
    const text = readFileSync(path, "utf8");
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (!m) continue;
    const fm = m[1];
    const get = (k) => (new RegExp(`^${k}: (.*)$`, "m").exec(fm) || [, ""])[1];
    const id = get("id");
    if (!id) continue;
    const title = get("title") + " " + get("aliases");
    const rest = fm.replace(/^(id|title|summary|aliases):.*$/gm, "");
    const toks = [...Array(3).fill(tokens(title)).flat(), ...tokens(get("summary")), ...tokens(get("summary")), ...tokens(rest), ...tokens(m[2])];
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    docs.push({ id, path: relative(brain, path), len: toks.length, tf });
  }
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  return { docs, df, avg };
}

export function search(index, query, limit = 10, k1 = 1.2, b = 0.75) {
  const { docs, df, avg } = index;
  const q = [...new Set(tokens(query))];
  const N = docs.length;
  const scored = [];
  for (const d of docs) {
    let s = 0;
    for (const t of q) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg));
    }
    if (s > 0) scored.push({ id: d.id, path: d.path, score: s });
  }
  return scored.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1)).slice(0, limit);
}
