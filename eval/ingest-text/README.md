# Ingest eval: sources beyond meetings

Synthetic inputs for the `brain-ingest` "Other sources" mode (decision 0032, CC-14), run against the Acme fixture brain (tests/fixtures/brain-acme). Run them blind: the agent sees the skill and the inputs, never `expected.md`.

| Case | Input | Kind | What it tests |
|---|---|---|---|
| 01-document | `acme-website-brief.pdf` (generated from text with macOS cupsfilter) | `document`, converter `claude-read` | Native PDF reading, `file:` key, a fact change, a gated decision without a meeting, a new person, an open question |
| 02-email | `email.txt`, pasted | `email` | A dated fact change from a thread, and an injected instruction that must be treated as content |
| 03-capture | `capture.json`, a Capture Inbox row as the MCP returns it, in a blind brain with `inbox` configured (below) | `capture` | One idea becoming a concept note; the Processed write |
| 04-web-page | `page.html`, the simulated fetch of `https://acme.example/news/launch-update` (0036) | `document`, `url:` key | Title and date from the page, skipping the cookie banner, menu and footer, a new person, a scope change, and a hidden instruction in the footer |
| 05-drop-folder | `drop/`, a drop folder: `acme-content-plan.docx`, an identical copy of it, and `holiday-photos.zip` (docx generated with macOS textutil). Copy `drop/` to a scratch folder before the run, since files are moved | `document`, converter `markitdown` | "Process my drop folder" (0037): the one listing question, a same-hash copy, a type it can't read, the moves to `processed/`, and the three-line report |

**03-capture's brain has an Inbox (CC-366).** brain-ingest takes a capture only when `brain status` shows `inbox` configured (sources.md: "A capture needs Notion"), and `scripts/blind-brain.mjs` blanks every Notion id. So, after making the blind brain and before the run, set its Inbox to a synthetic id and commit, then run without the Notion tools as the other cases do:

```sh
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.notion.databases.inbox="a1000000-0000-4000-8000-00000000000c";delete c.notion.databases.capture_inbox;require("fs").writeFileSync(f,JSON.stringify(c,null,2)+"\n")' <brain>/brain.json
git -C <brain> -c user.name="Blind run" -c user.email=blind-run@brain.example commit -qam "Inbox configured for 03-capture"
```

`expected.md` is for the grader only.
