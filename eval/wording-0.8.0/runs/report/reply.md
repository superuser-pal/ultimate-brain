Done: imported your accepted text on the Acme launch report and published 23 Notion writes (19 pages). Lint shows 0 errors.
Needs you: the push failed because this repo has no remote, so 3 commits are not pushed · 2 Review notes rows (Acme kickoff, Acme sync) are waiting for your decision.
Next: decide those rows in Notion, then "catch up".

**What came in**
- **Acme launch: where we stand** (report): your accepted text is now in Git exactly as written (+1 −1 line). Its fingerprint matched when I checked again just before applying and again before clearing Accepted.
  ```diff
  -Launch is set for February.
  +As of 2026-12-14, from the pages in Notion: launch is set for February and the login work has started.
  ```
  Not in the accepted text, but in the brain:
  - The open question "Who owns the Acme mobile app?" (still a draft). The report says "Open questions and risks: None".
  - Carlos Ruiz, the developer on the rebuild, isn't under People involved.
  - The launch month is February 2027.

  Want a full refresh?

**What changed**
- In Git: the report body, three commits (`documents: import accepted wording (1)`, `publish: catch up`, `log: catch up`).
- In Notion (lines in `writes.md`):
  - New pages: Carlos Ruiz, both auth decisions, Row-level security, and the 2 Review notes rows.
  - Updated: the area, project, people, org, question, Review rows and both meetings' relations.
  - The report row's properties, with Accepted unticked and Accepted at cleared.
  - Nothing else was waiting: no meetings, captures, Ask rows, conflicts or document requests.

**Check**
- **Placeholder page ids:** the 6 pages this run created have made-up page ids, because the simulation returns none. They are recorded in the notes and Notion relations, so replace them once real pages exist.
- **Shared temp folder:** another session writing to `/tmp/ub-catchup` overwrote my `plan.json` partway through. My import used my own plan. The two publish renders used the other plan; it had no conflicts and names no note in this brain, so the output was the same apart from the report's properties (no body was written). I finished in a private folder (`/tmp/ub-report-catchup.JKm5us`). That other session may also have read my `snapshot.json` or `plan.json`, so its results are worth a look.
- **No source in the brain:** "the login work has started" comes only from your Notion text. Reports aren't knowledge, so nothing was proposed from it.
- **Lint warning (product issue):** the import added `sources: [notion:…]` to the report, and `brain lint` then warns `view does not declare "sources"`. A warning, not an error. Suggested dogfood issue, not filed:
  > A report published to Notion is edited there and accepted. `brain sync apply` imports it and writes `sources:` into the view's frontmatter, then `brain lint` warns `unknown-key: view does not declare "sources"` on that same file. The CLI should either not write the key on views, or the view schema should declare it.

  Say the word and I'll file it with `gh`.
