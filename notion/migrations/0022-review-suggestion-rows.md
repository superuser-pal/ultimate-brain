# 0022 · Review gains Suggestion rows: Kind Notion Change and Set Field

**Design change:** decisions [0064](../../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md) and [0072](../../decisions/0072-ultimate-assistant.md) §2; CC-145 (release 0.10.0; docs/notion-space-design.md §3.10; spec/assistant.md §6.3; spec/schema.md §14). **Applies to:** every space built or migrated before 0.10.0. A step already done changes nothing, so running this again is safe.

What changes: when you ask Ultimate Assistant to "propose" a change instead of saying yes in chat, it writes a Review row of a new kind, a **Suggestion**: a task's Status, Due, Project or Area, a project's Status or an Area's Archived (Kind **Notion Change**, carried out in Notion once you approve), or a project's Area or an Area's Domain (Kind **Set Field**). So the **Kind** select on Review gains **Notion Change** and **Set Field**, and the **Type** formula gains a fourth value, **Suggestion**, for both. You decide a Suggestion row like any other: Approve, Reject, or Fix with What to fix. Brain Assistant, the Notion agent, learns the new Type in its Today and Review queue skills (step 3). Nothing else changes: no new property, no view change. The views grouped by Type (Home's "What's waiting for you?", an area's "Review waiting") gain a Suggestion group when the first such row arrives.

Run it after `brain upgrade` has put 0.10.0 in place, and before your first "propose" to Ultimate Assistant. Until step 2 is done, a Suggestion row shows Type **Conflict**, since the old formula calls every kind it doesn't know a Conflict.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## Prompt (Notion AI)

Not needed: the agent does both steps through the API. Don't add the options with Notion AI: it can give a new option the id of an existing one, and deleting one of them later deletes both (migration 0001). Without the agent, do step 1 by hand and paste the formula of step 2 by hand.

## 1 · Review · Kind (agent)

Read the Review data source first:
- **Notion Change and Set Field are already options:** add nothing.
- **Either is missing:** update Kind with every existing option, each with its id, name and colour, in its current order, then the missing ones (a name, no id) last: **Notion Change**, then **Set Field**. An update that leaves out an existing option deletes it and clears that value on every row that held it, so never send the new options alone.
- **Kind is missing, or isn't a select:** change nothing, report it, and ask the user.

Read the property back after writing it: every option that was there before is still there with the same id, and no id is shared by two options.

**By hand, without the agent:** open Review, click the **Kind** header → **Edit property** → **Add an option** → `Notion Change`, then again → `Set Field`. Don't delete and re-add an option to "fix" it.

## 2 · Review · Type (agent)

Replace the expression of the **Type** formula with the one in [Prompt 4](../prompts/04-formula-rollup.md) ("Review Type"):

```text
if(or(prop("Kind") == "Review Notes", prop("Kind") == "Update Fact", prop("Kind") == "Add To Note", prop("Kind") == "Update Body", prop("Kind") == "Add Link"), "From source",
  if(prop("Kind") == "Answer", "Answer",
    if(or(prop("Kind") == "Notion Change", prop("Kind") == "Set Field"), "Suggestion",
      if(empty(prop("Kind")), "", "Conflict"))))
```

Keep the property's name and description. Read it back: the expression holds `"Suggestion"`.
- **Type is missing, or isn't a formula:** change nothing, report it, and ask the user (migration 0010 adds it).
- **The API refuses the expression,** or reads it back unchanged: **by hand**, open Review, click the **Type** header → **Edit property** → **Formula**, and paste the expression above in place of the old one.

## 3 · Brain Assistant's skills (by hand)

Open the agent; [../brain-assistant.md](../brain-assistant.md) has the texts. In its **Skills** database, replace the body of **Today** (step 3 counts Suggestion rows too) and of **Review queue** (Suggestion is a fourth group, and step 2 says what approving a Notion Change or a Set Field does) with the blocks under those headings. Keep **Use automatically** on. The Instructions and the other skills don't change.

## By hand

Step 3, and the fallbacks of steps 1 and 2 when the agent couldn't do them. A view grouped by Type whose groups you ordered or hid yourself may add the Suggestion group as hidden: open the view's **Group** settings and show it.

## What this migration doesn't do

- **No new property, no view, no `brain.json` change.** A Suggestion row uses the properties every Review row has; its Name starts with "Suggestion: " (cli.md §5.14.4).
- **No brain edit by hand.** The brain writes Suggestion rows only when you ask Ultimate Assistant to "propose" one; a change you say yes to in chat never becomes a row (spec/assistant.md §6.2).
- **It doesn't carry out a Notion Change.** After you approve one, the next skill that applies your decisions (brain-apply, brain-sync, a catch-up, or Ultimate Assistant itself) makes the change in Notion; until then the row shows Pending (spec/assistant.md §6.3).

## Verify
- [ ] Review · Kind lists Update Fact, Add To Note, Update Body, Add Link, Supersede, Contradiction, Merge, New Item, Review Notes, Answer, Notion Change and Set Field (with any order you set for the older ones), with no option shared by two ids, and every option that existed before keeps its id.
- [ ] No Review row lost its Kind: the count of rows per Kind is the same as before the migration.
- [ ] Review · Type returns **Suggestion** on a test row with Kind Notion Change and on one with Kind Set Field; **Conflict** with Kind Merge; **Answer** with Kind Answer; **From source** with Kind Review Notes; empty with no Kind. Delete the test rows.
- [ ] Home's "What's waiting for you?" and an area's "Review waiting" show a Suggestion group while such a row is pending.
- [ ] Ask Brain Assistant "review queue" with a test Suggestion row pending: it shows a Suggestion group and says what approving it does. Delete the test row.
- [ ] `brain-notion-change`, in Check mode, reports no difference for Review.
