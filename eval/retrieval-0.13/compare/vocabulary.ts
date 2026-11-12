// C2v's vocabulary map (spec/retrieval.md §4): general business English only, at most 40 groups of at most 6 words. No project,
// client, person or product name, no question id, no answer, and no word taken from a held-back case: every word is found in a
// `dev` case (its question or evidence) or in eval/search-0.5's questions and answer notes (compare/run.mjs checks it before any
// run). A query word in a group also searches the group's other words, as one term (bm25Groups). Committed before the held-back
// run (§5.4). Words are written as the notes and questions use them; with C2w they are compared by their stem.
export const VOCABULARY: readonly (readonly string[])[] = [
  ["budget", "money", "spend"],
  ["launch", "live"],
  ["approve", "sign"],
  ["release", "deployment", "deploy"],
  ["invoice", "bill"],
  ["backup", "copies"],
  ["conference", "talk"],
  ["sms", "text"],
  ["postpone", "move"],
  ["hourly", "hour"],
  ["designer", "design"],
  ["reply", "answer", "response"],
];
