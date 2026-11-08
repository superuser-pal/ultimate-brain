// Compact snippets and one result per note.
// Adapted from claude-obsidian scripts/retrieve.py (`chunk_snippet`: the chunk's raw text, at most 200 characters, then "…";
// and the dedupe that keeps each page's best-scoring chunk after ranking) at commit 2e545563172f97f02ecaaaab376ceea1246a0583,
// MIT License, Copyright (c) 2026 AgriciDaniel. Written in TypeScript from reading the file; none of its code is run.
// Left out: the optional embedding rerank (it needs Ollama and a model).

export function snippet(raw: string, max = 200): string {
  return raw.length <= max ? raw : `${raw.slice(0, max).trimEnd()}…`;
}

/** Keep each note's best chunk, in score order. Chunk keys are `<note id>:<index>`. */
export function bestPerNote(scored: readonly { key: string; score: number }[]): { id: string; chunk: number; score: number }[] {
  const best = new Map<string, { id: string; chunk: number; score: number }>();
  for (const { key, score } of scored) {
    const at = key.lastIndexOf(":");
    const id = key.slice(0, at);
    const prior = best.get(id);
    if (!prior || score > prior.score) best.set(id, { id, chunk: Number(key.slice(at + 1)), score });
  }
  return [...best.values()].sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
