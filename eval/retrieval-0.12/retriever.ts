// The one interface every retriever in this comparison implements (CC-167).
// A retriever takes a query and returns ranked note ids, plus the text its result page would deliver to the agent.

export interface Results {
  /** Ranked note ids, as `brain query --candidates` returns them. */
  ids: string[];
  /** The whole text the agent would read for this query. */
  page: string;
}

export interface Retriever {
  name: string;
  search(query: string, limit: number): Results;
}

/** One result: its note id and the compact block the page shows for it, never the whole note. */
export interface Hit {
  id: string;
  text: string;
}

/** A compact result page: one framing line, then one numbered block per hit. */
export function compactPage(query: string, hits: readonly Hit[]): Results {
  return {
    ids: hits.map((hit) => hit.id),
    page: [`Results for: ${query}`, ...hits.map((hit, index) => `${index + 1}. ${hit.id} ${hit.text}`)].join("\n"),
  };
}
