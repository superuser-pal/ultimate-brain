# Your data

Ultimate Brain is published by Sentina. It has no server and collects nothing. The `brain` command has no telemetry and contacts no service of ours: the only network use it starts is Git pushing your brain to your own backup. Your notes are Markdown files in a Git repository on your computer. They leave your computer only through the services you connect:

| Where | What goes there | When |
|---|---|---|
| Your AI agent's provider (Anthropic, for Claude Code) | Everything the agent reads while it works: meeting minutes, documents, notes, Notion pages | Every session |
| Notion | The pages your brain publishes: sources, Review rows, documents, tasks, reports | When you approve a publish, or automatically if you set publishing to auto |
| Notion AI | The meeting transcripts and pages you run the minutes prompt or Notion Brain Assistant on | Only when you use those features |
| GitHub | A private repository that backs up your brain. Setup creates it | Each time your brain pushes: after each change, or when you say so, as your push setting says |

Each of these processes your content under your own account and plan with that company. Read their terms before you put client material in your brain.

## What stays private

- The backup repository is created private. Setup checks its visibility and stops if it is public.
- The setup report holds counts and codes only: no names, paths, ids or your words. You see it whole before anything is sent, and it is sent only if you say yes.
- A report you agree to send becomes a **public issue** on this repository, under your GitHub name. The same is true of any issue you open here, so never paste notes, client names, Notion links or tokens into one.

## What the review rules protect, and what they don't

Your brain only changes what it knows after you approve it, and it leaves out anything you excluded. The `brain` command applies these rules to what it returns, and the instructions installed in your brain folder and in each repository you link with `brain link` tell your agent to work only through it. They are rules for the agent, not locks on the files.

An AI agent you start somewhere else on your computer, in a folder that isn't linked, is not bound by them. If it can read your brain folder, it can read every file in it, including text you excluded. Link a repository before you ask brain questions there.

## Text from outside

Meeting notes, web pages and documents you capture are stored word for word, so that every claim can be traced to its source. Your agent's instructions tell it to treat instructions found in a captured text as content, not as orders. No instruction can make that certain, so review what a capture proposes before you approve it.

## Deleting your data

Everything is yours to delete: your brain folder, its backup on GitHub and your Notion space. What setup put on your computer, and how to remove it: [Uninstalling](docs/setup.md#uninstalling).

## Questions

Open an issue on this repository. For a security problem, see [SECURITY.md](SECURITY.md).
