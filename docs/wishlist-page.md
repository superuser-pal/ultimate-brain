# The wishlist page's words

The English copy of the wishlist page, decided by [0106](../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §7 and §8. The author builds and hosts the page in GoHighLevel (U-39); this file keeps only its words. Paste the copy as it is. The notes for the person building the page are below the copy, not on the page.

---

## Copy

### Headline

**A second brain your AI agents can trust.**

### Under the headline

Ultimate Brain keeps what you know as plain Markdown files in Git, on your computer. Claude Code or Codex maintain it for you, and you read it in Notion.

### What it is

- **Your agents remember.** Meetings, documents and agent sessions become notes your agents can use in any project, so you stop explaining the same context again.
- **Every answer has a source.** Each claim points back to the meeting or document it came from, and a contradiction is shown to you, never settled silently.
- **Nothing changes without your yes.** New notes come in as drafts. A change to what your brain already knows waits for your approval.
- **It's yours.** Plain Markdown in a private Git repository, with no lock-in. Ultimate Brain is free and open source (MIT); you pay only for your agent's plan and your Notion plan.

### Who it's for

Solo knowledge workers who already use Claude Code or Codex: consultants, founders, researchers, solopreneurs and remote workers who want their agents to remember what they decided and why.

You need a Notion plan with Notion AI.

### The demo

<!-- DEMO VIDEO: added after 0.17.0, recorded from docs/demo-script.md (CC-353). Leave this section out of the page until then. -->

### Join the wishlist

Ultimate Brain is in a private beta. Leave your email and we'll write to you **once**, when version 1.0 is released. We send nothing else.

**Form:** one field, *Email address*, and the button **Join the wishlist**.

**Consent line, a checkbox beside the form, unticked:**

> ☐ Email me once when Ultimate Brain 1.0 is released. I can leave the list at any time. See [how my email is kept](PRIVACY_LINK).

**After joining:**

> You're on the list. We'll write once, when 1.0 is out.

### Footer

[How your email is kept](PRIVACY_LINK) · [Ultimate Brain on GitHub](REPO_LINK)

---

## Notes for building the page (U-39)

- **Links:** `PRIVACY_LINK` is the waitlist section of PRIVACY.md on GitHub, `https://github.com/superuser-pal/ultimate-brain/blob/main/PRIVACY.md#the-wishlist`. `REPO_LINK` is the repository's GitHub page.
- **The form asks for an email address only.** Ask for nothing else: PRIVACY.md says the email address and the consent tick are all the list keeps.
- **The checkbox is required and unticked.** GoHighLevel's form builder records consent with a Custom Checkbox, tracked on the contact ([How to Get Customer Consent](https://help.gohighlevel.com/support/solutions/articles/155000006325-how-to-get-customer-consent-or-track-legal-basis-to-process-your-lead-s-or-customer-s-personal-data)). Make it required so the form can't be sent without it; never tick it by default.
- **No confirmation email, no sequence, no other campaign.** 0106 §7 allows one email to the list: the 1.0.0 announcement. Turn off any automatic welcome or double opt-in email the form or a workflow would send.
- **Keep the unsubscribe link** in the announcement email. GoHighLevel adds one to every email by default ([Managing Default Unsubscribe Links](https://help.gohighlevel.com/support/solutions/articles/48001225534)); don't turn that off.
- **Contact for leaving or deletion:** the page shows a contact address for people who want to leave the list before 1.0 or have their email deleted (PRIVACY.md points to it). It is set in GoHighLevel, not written in this repo.
- **What you need:** after 0.17.0, Notion AI is optional. Then replace "You need a Notion plan with Notion AI." with "You need a Notion account; Notion AI is optional." in this file and on the page, in the PR that adds the demo.
- **Promise nothing unreleased.** Every line in the copy describes released behaviour. A line about a feature still to come (the path without Notion AI, Spanish) goes on the page only once it is released.
- **Spanish** words come with 0.18.0.
- **Nothing from the list in the repo:** list members and account details stay in GoHighLevel.
