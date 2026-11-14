# 0026 · Weekly review opens the weekly report

**Design change:** decision [0093](../../decisions/0093-the-0-15-0-scope-grill.md) §2 (with [0090](../../decisions/0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md) §3, §4 and [0075](../../decisions/0075-weekly-review-and-targeted-corrections.md)); CC-256 (release 0.15.0; spec/weekly-review.md §13). **Applies to:** every space built or migrated before 0.15.0, the template's copy included. Needs migration 0025. A step already done changes nothing, so running this again is safe.

**What changes:** from 0.15.0 the brain writes one weekly review per week (say "weekly review" to Claude Code or Codex in your brain, or turn on its Monday schedule). With Reports on, it is a row in Documents with Origin Report, named `Weekly review · <the week's dates>`. Brain Assistant's **Weekly review** no longer builds its own six-section digest. Asked by name ("Run Weekly review"), it:
- opens this week's report, or the newest one, saying its week; with none, it says how to get one, and that with Reports off the review is a file in the brain;
- sums up What changed and Task analysis in a few lines;
- walks you through What needs your decision in rounds of three to five questions, each with options and the one it recommends, as Review with me does;
- decides each item where it lives. On a Review page it writes what you agreed into the item sections, after your yes, as Grill review does. For a row that needs only Your call, and for a task, it says what to set and links it. It never sets Your call and never changes a property or a task: you do.

No database, property, view or button changes.

Run this migration after `brain upgrade` has put 0.15.0 in place. The order of the steps doesn't matter.

Who does each step:
- **by hand:** you, in Notion. The API can't edit a Custom Agent.
- **by hand, or the agent:** the Template version line.

## 1 · Brain Assistant (by hand)

Open the agent. [../brain-assistant.md](../brain-assistant.md) has the texts.
1. **Instructions:** replace them with the block under "Instructions". Three rules now name Weekly review next to Grill review, with the same limits: it may write into the item sections of a Review page its report links to, only after your yes; it never sets Your call or What to fix; it recommends one option per question, never Approve or Reject. Re-link each *[@…]* with a real @mention.
2. **Skills** database: replace the **Description** and the body of **Weekly review** with the new ones. Keep **Use automatically** on. The other skills don't change.
3. **Tools and access:** nothing changes. Weekly review reads Documents and Tasks, and writes only into Review, which has edit access since migration 0025.

Without a Custom Agent: replace your personal Weekly review skill with the same text, and add the three rules to your personal Instructions.

## 2 · How it works (by hand)

Replace the text of **How it works** with `brain-howto/references/guide.md` as it is in the skills release that ships with 0.15.0. It now says how to ask Brain Assistant for the weekly review. If you already did this for migration 0025 with that release, skip it.

## 3 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0026`. A space without that line has nothing to change.

## What this migration doesn't do

- **No weekly report.** The brain writes it. A space with Reports off gets none in Notion; the skill then says the review is a file in the brain.
- **No change to how a Review row is decided.** Your call decides it, as migration 0025 says; Weekly review only helps you get there.
- **No new property, view or button.**

## Verify

- [ ] The Weekly review page in Skills starts its body with "Goal: take me through this week's weekly review", and its Description says it never sets Your call.
- [ ] Brain Assistant's Instructions name "Weekly review" in the edit rule, the Review exception and the recommendation rule.
- [ ] In the agent's chat, "Run Weekly review" in a space with no weekly report answers that there is none yet and how to get one, and writes nothing.
- [ ] With a synthetic weekly report in a test space (never a real one): it sums up the report, asks its first round with lettered options and one recommended, with a blank line between questions and between options; it writes nothing before your yes; afterwards Your call and every task are as they were. Delete the test rows.
- [ ] The System callout reads `Template version: 0026`.
