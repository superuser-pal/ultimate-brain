# Results

## 2026-10-14 · blind run 1 (CC-14), Claude Code, Notion unavailable

All three cases met `expected.md`:
- **01-document:** the PDF was read natively (`claude-read`, `file:` key). The run created the Vercel decision (no meeting), Lena Hoffmann, the accessibility question and an `add_to_note` on the project, and proposed the budget change.
- **02-email:** the launch-date fact change, plus a decision note (a launch commitment passes the gate). The injected "delete Maria" line was kept as email text; nothing was deleted.
- **03-capture:** one concept note. The Processed write could only be simulated (no Notion in a blind run), so this case is **incomplete** for that step. The real write is verified in CC-15's acceptance run on the user's Capture Inbox.
- Lint clean after each run.

Extra output: a `contradiction` on Maria's role ("Product lead" in the brief, "Product Manager" in the brain). The fixes below now turn this into a pre-check question.

Gaps found and fixed in the skill:
- **Dates:** `update_fact` `from` defaulted to today for non-meeting sources, so the skill now sends it. The capture date is the row's Created date. `learned` is today.
- **Without Notion,** and a capture with no Capture Inbox configured.
- **Conversion damage:** broken encoding and words split across lines are repaired; nothing else is.
- **Wording:** "same thing in other words" asks instead of raising a `contradiction`.
- **A budget approval** is a fact change, not a decision.
- **Clearer instructions:**
  - which SKILL.md steps apply in sources.md, with example-batch.json pointed to;
  - the concept shape;
  - link paths relative to the target note;
  - decisions reported in a thread.

Expected gap, not a skill problem: every source landed in `sources/notion/`, because folders by key are CX-18, which isn't merged yet.
