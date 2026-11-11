# 0081 — How the brain talks to you: a response style setting, working principles and plain writing

**Status:** Accepted
**Date:** 2026-11-11
**Release:** 0.14.0
**Amends:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) (0.14.0's scope gains the response style, and the settings screen gains one item for it)
**Keeps:** Markdown + Git canonical; the CLI stays non-interactive; text the CLI renders and a skill shows exactly as returned stays as it is; operational skills never rely on a general skill being installed ([skills-delivery](../spec/skills-delivery.md) §4); no onboarding profiles ([0030](0030-capability-based-onboarding-profiles.md)); the feature cutoff at 0.15.0

## Context

Early access (0078) brings in people who are not developers. Today every brain skill talks the same way, and the user has no way to ask for shorter answers, fewer technical terms or the answer first. Text the brain writes into Notion also shows patterns people recognise as written by an AI.

On 2026-11-11 the user reviewed three public skill collections as sources:
- the Karpathy guidelines (multica-ai/andrej-karpathy-skills): four always-on working rules for coding agents. The repository has no licence file;
- humanizer (blader/humanizer, MIT): an editing skill that removes AI writing patterns from text;
- i-have-adhd (ayghri/i-have-adhd, MIT): a session mode that shapes answers for a reader with ADHD (the next action first, numbered steps, the current state restated, short lists).

The user then ran a scope grill (Q1 to Q6) and chose each option below. The user doesn't want a single fixed voice: each user chooses how the brain talks to them, opts in or out, and adjusts single aspects.

## Decision

### 1. Working principles in the brain's rules, in our own words

The brain template's rules block (`templates/brain/AGENTS.md`, between the `ultimate-brain:rules` markers, so `brain upgrade` brings it to every brain) gains a few lines that restate the Karpathy principles for brain work, written in our own words with no text copied:
- **Ask before guessing:** when a capture could be a task or a note, or could belong to two projects, ask which.
- **Nothing speculative:** don't create an Area, Project, tag or note nobody asked for.
- **Touch only what was asked:** change only the note the request names; a change to existing knowledge is a proposal (0003).
- **End on what was checked:** say what was written and that `brain lint` passed.

There is no Karpathy skill, and no coding version: the general engineering skills in the fork already cover coding.

### 2. Reply rules for everyone

The same rules block gains three rules for every reply, whatever the style:
- no opener such as "Great question!" and no closer such as "Let me know if…";
- an error is stated as its cause and its fix, with no "Uh oh";
- when something is left open, the reply ends with one next action.

### 3. The response style setting

`brain.json` `settings.style` holds the user's response style. It has three dials:

| Dial | Levels | What changes |
|---|---|---|
| Explaining | `expert`, `some`, `plain` | `expert` defines nothing; `some` defines a new term once; `plain` uses no jargon and gives an example for each term |
| Length | `short`, `normal`, `full` | `short` shows at most five items, with "more" for the rest |
| Directness | `answer-first`, `context-first` | `answer-first` puts the answer or the next action on the first line and restates where the user is ("step 3 of 5") each turn |

Two presets: **Standard**, today's behaviour, and **Simple** (`plain`, `short`, `answer-first`). A dial the user sets on its own overrides the preset's value for that dial. The default is Standard, and an absent setting means Standard. The exact JSON shape and each preset's values are the contract's (CC-209).

### 4. How it reaches the agent

The CLI writes the style as a short "How to answer me" paragraph:
- in the brain's `AGENTS.md`, in a block of its own outside the rules block, since `brain upgrade` copies the rules block verbatim from the template;
- in each linked folder's instruction block, as `brain link` already does for the recall paragraph (cli.md §5.12).

With Standard there is no paragraph, and a run removes one written before. Every skill and plain chat follow the paragraph without anything being invoked. It works the same way in Claude Code and Codex, and it lasts across sessions.

### 5. Opt in at setup, change it in chat

- The setup's settings screen (0078 §2) gains one optional item, "How should the brain talk to you? Standard / Simple / Custom", with its one-line explanation. Custom asks for the three dials.
- The user changes it in chat ("talk to me more simply", "shorter answers", "go back to normal"). The agent writes the setting with `brain config set`, the brain's paragraph changes at once, and linked folders take the change at their next `brain link` or `brain upgrade`. The agent says so in one line.

### 6. What the style reaches

The style shapes only what the agent writes in its own words. Text the CLI renders and a skill shows exactly as returned (Ultimate Assistant's report, for example) is unchanged. Those reports already follow the rule of counts, what needs the user and the next action. Having the CLI render two lengths of each report is post-1.0.

### 7. Plain writing for text people read

- **The general skill:** humanizer is copied unchanged into the skills fork as a general skill, in a folder upstream doesn't use, with its licence and the upstream commit it was taken from. An update is a fork PR that moves to a newer commit. Users install it like the fork's other general skills.
- **Inside the brain:** a short "writing for people" reference in the fork's `brain/` lists the strongest patterns to avoid: "not X but Y" contrasts, one-line closers, forced lists of three, dashes as a connector, bold labels, inflated claims. The operational skills that write text a person reads in Notion or in a report follow it. They don't call humanizer, which may not be installed and is too long to load on every run.
- **Which rule applies where:** chat with the user follows the response style (§3). Text that is saved or read by others (notes, Notion pages, reports, Review rows) follows the writing reference.

### 8. Sources

The i-have-adhd skill is a reference for the dials and the reply rules; none of its text is copied. Humanizer is copied with its MIT licence and attribution. The Karpathy principles are restated in our own words (§1), because the repository has no licence file.

### Out of scope

- A skill the user switches on per session.
- Styles per skill or per agent.
- The style changing CLI-rendered reports (post-1.0, §6).
- Changes to the Notion AI prompts, including the minutes prompt (0079).
- Changes to upstream's skills, such as the grilling skill's rounds.
- The style of product development sessions in this repo; a user's own `CLAUDE.md` covers those.
- Translation (1.0).
- Any operation on the user's brain or Notion workspace without an explicit yes.

## Consequences

- [build/TASKS.md](../build/TASKS.md): 0.14.0 gains CC-208 (this record), CC-209 (contracts), CC-210 (the CLI), CC-211 (the template's rules, the setup item and the chat change) and CC-212 (humanizer and the writing reference in the skills fork).
- spec/schema.md §12 defines `settings.style`; spec/cli.md defines the paragraph in the brain's `AGENTS.md` and in `brain link`'s block, when `brain config set`, `brain link` and `brain upgrade` write it, and how `brain status` reports it; spec/setup.md gains the settings-screen item (CC-209).
- 0078 gets a header pointer to this decision; its body stays as recorded.
- This is a planning record: no CLI, schema, spec, skill, template or Notion change, no brain operation, and no implementation starts with it.

## Evidence

- The user's review of the three sources and the scope grill, 2026-11-11, Q1 to Q6: Karpathy as a few lines in the brain template's rules; humanizer copied unchanged as a general skill plus a short reference inside `brain/`; a configurable, opt-in style rather than a fixed voice; `settings.style` written into `AGENTS.md` by the CLI; three dials with the Standard and Simple presets; Standard by default, offered at setup, changeable in chat; the agent's own words only; the split between the rules for everyone and the dial rules; 0.14.0.
- The recall paragraph this follows: [spec/cli.md](../spec/cli.md) §5.12, `settings.recall` in [spec/schema.md](../spec/schema.md) §12.
- The settings writer: `brain config set`, [spec/cli.md](../spec/cli.md) §5.3.
- The general/operational split: [spec/skills-delivery.md](../spec/skills-delivery.md) §4 and §10.1.
- The settings screen: [0078](0078-onboarding-and-early-access-in-0-14-0.md) §2.
