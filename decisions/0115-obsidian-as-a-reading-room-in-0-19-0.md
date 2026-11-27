# 0115 — Obsidian as a reading room for the brain, in 0.19.0

**Status:** Accepted
**Date:** 2026-11-27
**Release:** 0.19.0
**Amends:** [0112](0112-0-18-0-fourteen-features-and-espanol-in-0-19-0.md) (0.19.0 holds one more feature, beside its fourteen); [0061](0061-roadmap-and-launch-boundary.md) (release scope: an explicit roadmap change after the cutoff); [0071](0071-a-simpler-notion.md) (a report may carry a diagram)
**Keeps:** Markdown and Git canonical, Notion as the human interface and the place where you act ([0101](0101-where-notion-ai-and-the-brain-each-write.md)); [0002](0002-link-syntax.md) (standard relative Markdown links and no `[[wikilinks]]` in a note the brain writes; Obsidian an optional viewer); the vision's "Obsidian is never required"; [0015](0015-notion-access-via-mcp.md) (the brain's program reads no Notion); [0049](0049-documents.md) and [0100](0100-keep-a-task-as-a-document.md) (your own text is kept as a Document); [0091](0091-other-peoples-text-keeps-its-links.md); [0103](0103-first-things-first-and-upgrades-with-unrelated-work.md) (an upgrade works around unrelated uncommitted work); [0104](0104-product-design-principles.md); every rule of 0112 and 0113
**Amended by:** [0117](0117-a-factory-starter-for-repo-new-in-0-19-0.md) (2026-11-27; 0.19.0): 0.19.0 also holds a factory starter for `brain repo new`; this decision's rules don't change

## Context

The author asked for the brain to be usable from Obsidian, "barely the minimum": Notion stays the place where work is done, and Obsidian is a wiki to read the brain's long reports, see diagrams drawn in Excalidraw, and hold longer documentation. It is to be an option, not a requirement, and grouped into a release rather than a version of its own.

0002 already makes the brain readable in Obsidian: its notes link to each other with standard relative Markdown links. What goes wrong today is small and concrete:
- Obsidian's default link format writes `[[wikilinks]]` when you link or edit, and `brain lint` reports a `wikilink` error in a note the brain writes (spec/schema.md §15).
- Obsidian rewrites its workspace layout file all the time, so every session finds uncommitted changes.
- Diagrams have no place. The Excalidraw plugin saves `.excalidraw.md` files by default, and an `.md` file without an `id` in a note folder is a lint error; the author's own brain holds an uncommitted drawing at its root.
- Nothing tells the agents or the user how the brain and Obsidian fit.

In the same conversation the author said that, for them, the wiki is the one the agent manages, and asked whether their own long text should live in a folder of its own or in Notion's Documents database.

## Decision

### 1. Obsidian is a reading room, and the wiki is the brain's
- **The wiki is what the brain already writes and keeps:** `knowledge/` and `reports/`. Obsidian reads it: links, backlinks, the graph, diagrams beside the text. The brain writes it as today; nothing in the brain depends on Obsidian, and a brain without it works as before.
- **No folder for your own text.** A folder of the user's own pages (named `writing/` after the author rejected `wiki/`) was considered and dropped: your own text already has a home in Documents, through Keep as document on an Inbox row or a task (0049, 0100), where it is linked to its Project or Area, searchable, cited and visible in Notion. Two homes would make you choose each time (0104, user effort). The question whether search reads such a folder goes with it.

### 2. One setup question, off by default
- **Setup asks once:** "Do you read your brain in Obsidian?" With no, nothing changes. With yes, a setting in `brain.json` records it, and the brain:
  - writes Obsidian's link settings in the vault's configuration (`.obsidian/`): Markdown links rather than wikilinks, relative paths, and links updated when a file is renamed. Only those settings: the user's other Obsidian settings are kept as they are;
  - adds Obsidian's workspace layout files to the brain's `.gitignore`.
- **You can say it later in a session** ("I read my brain in Obsidian", "I stopped using Obsidian"). Turning it off stops the brain looking after those settings; it removes nothing.
- **To settle:** the setting's key in `brain.json`; whether `brain init`, `brain upgrade` or the setup skill writes the files, and how an existing `.obsidian/` folder is merged; what an upgrade does when a link setting was changed back to wikilinks (**default:** puts it back and says so in its report, since a wikilink is a lint error).

### 3. A place for diagrams
- **`diagrams/` is the brain's folder for diagrams:** an Excalidraw drawing, with an `.svg` exported beside it. A note or report shows the diagram with a standard Markdown image link to the `.svg`, so it displays in Obsidian, on GitHub and in an editor. The folder is outside the note folders, so lint never reads a diagram as a note.
- **A report may carry a diagram** (Reports module, amends 0071): when you ask for one, or, offered once, when the report describes a flow, a structure or a timeline. A note's body gets one only when you ask in the session.
- **To settle:**
  - what an agent needs to write an `.excalidraw` file and its `.svg` in Claude Code and in Codex, on macOS and on Windows, without tools the user installs. If it needs one, the contract brings the alternative to the author before choosing: Mermaid in the Markdown itself, which Obsidian, GitHub and Notion show with no tool;
  - what the published report shows in Notion (**default:** one line naming the diagram and where to open it, since the brain's program reads no Notion; the contract checks whether the Notion MCP can upload an image and offers it to the author if so);
  - a report's refresh and its diagram (**default:** redrawn with the report, as part of the brain's summary);
  - what happens to a diagram whose report or note is removed or archived (**default:** it moves with it).

### 4. The agents and the guide
- **The brain's `AGENTS.md`** says the wiki is `knowledge/` and `reports/`, what `diagrams/` holds, and that a note the brain writes never gets a wikilink, from Obsidian or anywhere else.
- **A short guide, "Your brain in Obsidian":** open the brain folder as a vault; what the setup question set and why; editing a note in Obsidian is a hand edit like any other; don't move or rename the note folders; your own long text goes to Documents; the Excalidraw plugin's file format.

### 5. Checks before the contract
Agents answer these from the vendors' current documents and one synthetic brain, with no sitting by the author: Obsidian's current names for the three link settings and its workspace files; whether Obsidian's Properties editor rewrites a note's frontmatter in a way `brain lint` rejects; the Excalidraw plugin's file format setting and whether it can save plain `.excalidraw`; whether anything in the CLI reads `.md` files outside the note folders (index, search, lint), which an `.excalidraw.md` in `diagrams/` would meet; the same behaviour on macOS and Windows (0104 §7); whether the Notion MCP can upload an image.

### 6. Release
In **0.19.0**, by explicit roadmap change after the 0.15.0 cutoff, beside the fourteen features of 0112, whose rules don't change. Not in 0.18.0, which is near its release. It has its own rows, its skills join 0.19.0's one fork release, and 0.20.0 translates its guide and setup question with the rest.

## Consequences

- 0.19.0 gains CC-406 (the checks of §5 and the contract), CC-407 (the CLI, the template and the guide) and CC-408 (the skills, in CC-381's fork release), and U-49, the author's use of it after the release.
- No Notion database, property or migration; no Obsidian plugin; no wikilink support; no sync. A user who never says yes sees one more question at setup and an empty `diagrams/` folder only if a diagram is drawn.
- 0002 and the vision's "Obsidian is never required" stand: this decision makes the optional viewer comfortable, not required.

## Evidence

The author's words, in the planning session of 2026-11-26 and 2026-11-27 (CC-405):
- "I want a version that will make this brain Obsidian compatible, at least to some degree of workflows—barely the minimum. Just notion keeps being the execution space. But Obsidian is a wiki that can also be accessed for diagrams from Skalidro for reading their long reports, if desired, or to have its own wiki document, like a more extensive wiki documentation."
- "I'm not sure of the size of this request. If it's too small, then I would add it here. If it's too big on its own and needs its own version, I would honestly prefer to group it since I am in use of having this for my own brain. But I also want to make this like an option, right? Like you can have an Obsidian wiki inside the brain."
- On the user's own folder: "I feel here wiki should not be the name. give me options. for me the wiki is the one managed with the agent"; on search reading it: "ok"; then, after the comparison with a Documents row, the folder was dropped and "ok the scope is fine. let's place it in 0.19.0".

Today's shape: [0002](0002-link-syntax.md); spec/schema.md §15 (lint's `wikilink` rule and the `.md` without `id` error); spec/cli.md §5.15 (uncommitted work an upgrade leaves alone, which names a diagram); [docs/notion-space-design.md](../docs/notion-space-design.md) §3.14 (how a Document is created and edited).
