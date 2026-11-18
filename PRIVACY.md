# Your data

Ultimate Brain is published by Sentina. The product has no server and collects nothing; the one exception is [the wishlist](#the-wishlist), which keeps your email address only if you join it. The `brain` command has no telemetry and contacts no service of ours: the only network use it starts is Git pushing your brain to your own backup. Your notes are Markdown files in a Git repository on your computer. They leave your computer only through the services you connect:

| Where | What goes there | When |
|---|---|---|
| Your AI agent's provider (Anthropic, for Claude Code) | Everything the agent reads while it works: meeting minutes, documents, notes, Notion pages | Every session |
| Notion | The pages your brain publishes: sources, Review rows, documents, tasks, reports | When you approve a publish, or automatically if you set publishing to auto |
| Notion AI | The meeting transcripts and pages you run the minutes prompt or Brain Assistant on | Only when you use those features |
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

## The wishlist

The wishlist page, its list and its one email live in GoHighLevel (GHL), a marketing service Sentina uses for them. Nothing else in Ultimate Brain uses GHL, and the `brain` command never contacts it. The statements about GHL below were checked against GHL's own pages on 2026-11-18; each links the page it came from.

- **What is kept, and why.** The email address you enter and your consent tick, which GHL records on your contact ([GHL: customer consent](https://help.gohighlevel.com/support/solutions/articles/155000006325-how-to-get-customer-consent-or-track-legal-basis-to-process-your-lead-s-or-customer-s-personal-data)). It is used for one thing: one email when Ultimate Brain 1.0 is released. Nothing else is sent to it, and it is not shared or sold. It is kept until you leave the list or ask for it to be deleted.
- **Who is responsible.** Sentina decides what the list is for; GHL processes it on Sentina's behalf, as a processor under its [Data Processing Addendum](https://www.gohighlevel.com/data-processing-agreement) (§3) and its [GDPR page](https://help.gohighlevel.com/support/solutions/articles/48001210915-gdpr-compliance-and-data-privacy). GHL's own [privacy policy](https://www.gohighlevel.com/privacy-policy) says it does not apply to data GHL keeps for its customers; this section does.
- **Leaving the list.** The email has an unsubscribe link: GHL adds one to every email by default ([GHL: unsubscribe links](https://help.gohighlevel.com/support/solutions/articles/48001225534)), and unsubscribing turns on GHL's Do Not Disturb for email, which blocks marketing email to you ([GHL: Do Not Disturb](https://help.gohighlevel.com/support/solutions/articles/48001214849)). To leave before then, or to have your address deleted, write to the contact address on the wishlist page; don't post your email in a public issue here.
- **Deleting your address.** We delete your contact in GHL. GHL can restore a deleted contact for 60 days; after that it is removed for good ([GHL: deleting contacts](https://help.gohighlevel.com/support/solutions/articles/155000000583)). GHL's addendum keeps archived backups isolated from further use rather than deleting them at once; neither page gives a date by which a backup copy is gone ([Data Processing Addendum](https://www.gohighlevel.com/data-processing-agreement)).
- **Where GHL keeps it.** GHL's [sub-processor list](https://www.gohighlevel.com/sub-processors) names Google Cloud and Amazon Web Services for data storage, both in the United States; Twilio, Mailgun and its affiliate LeadConnector for communication services, in the United States; and its affiliate HighLevel India for services and support. The list names no narrower region and no storage outside the United States, and none of GHL's pages above says more. Transfers from the EU, the UK and Switzerland rely on GHL's certification under the EU-U.S. Data Privacy Framework and the Standard Contractual Clauses in its [Data Processing Addendum](https://www.gohighlevel.com/data-processing-agreement) (§13).

## Questions

Open an issue on this repository. For a security problem, see [SECURITY.md](SECURITY.md).
