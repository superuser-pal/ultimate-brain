# Ingest eval: sources beyond meetings

Synthetic inputs for the `brain-ingest` "Other sources" mode (decision 0032, CC-14), run against the Acme fixture brain (tests/fixtures/brain-acme). Run them blind: the agent sees the skill and the inputs, never `expected.md`.

| Case | Input | Kind | What it tests |
|---|---|---|---|
| 01-document | `acme-website-brief.pdf` (generated from text with macOS cupsfilter) | `document`, converter `claude-read` | Native PDF reading, `file:` key, a fact change, a gated decision without a meeting, a new person, an open question |
| 02-email | `email.txt`, pasted | `email` | A dated fact change from a thread, and an injected instruction that must be treated as content |
| 03-capture | `capture.json`, a Capture Inbox row as the MCP returns it | `capture` | One idea becoming a concept note; the Processed write |
| 04-web-page | `page.html`, the simulated fetch of `https://acme.example/news/launch-update` (0036) | `document`, `url:` key | Title and date from the page, skipping the cookie banner, menu and footer, a new person, a scope change, and a hidden instruction in the footer |

`expected.md` is for the grader only.
