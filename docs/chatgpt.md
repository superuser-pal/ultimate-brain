# ChatGPT with your brain (optional)

Claude Code or Codex runs your brain. ChatGPT is optional (decision [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §8.5): through Notion's MCP it can read your Notion space and run the same Brain Assistant skills, "prep my 3pm", "what's due today", "tidy that capture", from their one text, [notion/brain-assistant.md](../notion/brain-assistant.md). You don't need it, and nothing in your brain depends on it.

**What ChatGPT can and can't do here:**
- It sees **your Notion space**, not your brain folder: it answers from what the brain has published to Notion, which can lag your brain until the next publish.
- It **writes only Notion**, and only what the skills allow: a capture's text after your yes, your operational fields (a task's status or due date, for example). It never takes anything into your brain: that stays a Claude Code or Codex session.
- If it changes a value the brain owns (a Brief, a key fact), the brain doesn't take that as your correction: your next session asks you about it (decision 0101 §4).
- Never ask it to create Tasks from a meeting. The brain creates them once, when it takes the meeting in (decision 0101 §5).

## What you need

- **A ChatGPT plan that can add a custom MCP server.** Which plans can, and whether yours may write, is on OpenAI's help page, [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461). OpenAI's developer page, [Add custom MCP server](https://developers.openai.com/api/docs/guides/developer-mode) (checked 2026-11-20), gives the steps below and says ChatGPT supports both read and write tools, and that write actions need your confirmation by default. On a work account, your workspace's admin may have to allow it.
- **Notion's MCP**, which works on every Notion plan, Free included ([Notion MCP](https://developers.notion.com/docs/get-started-with-mcp), checked 2026-11-20). It acts with your own Notion permissions: it can reach everything you can ([Notion's help on MCP](https://www.notion.com/help/notion-mcp)).

## 1. Connect Notion to ChatGPT

On the ChatGPT website ([ChatGPT developer mode](https://developers.openai.com/api/docs/guides/developer-mode), checked 2026-11-20):

1. Open **Plugins** (chatgpt.com/plugins), select **+**, then **Add custom MCP server**. If you don't see it, your plan or your workspace's settings don't allow it: see OpenAI's help page above.
2. Name it **Notion**. Under **Connection**, as **Server URL** enter `https://mcp.notion.com/mcp`. As authentication choose **OAuth**.
3. Read OpenAI's warning, select **I understand and want to continue**, then **Create as a plugin**, and install it.
4. When Notion asks, sign in and allow access to the workspace that holds your brain.

ChatGPT asks you to confirm each write by default. Keep it that way: approve a write only when it is the change you asked for.

## 2. Make a ChatGPT project for your brain

A project keeps the rules in every chat, so you set them up once.

1. Download Brain Assistant's text for your version: open `https://github.com/superuser-pal/ultimate-brain/blob/v<version>/notion/brain-assistant.md`, with `<version>` what `brain --version` prints (for example `v0.17.0`), and choose **Download raw file**.
2. In ChatGPT, create a project named **Ultimate Brain**, and add that file to it ([Projects in ChatGPT](https://help.openai.com/en/articles/10169521)).
3. In the project's settings (••• → Project settings), paste these instructions, with your own link in place of `<link to Brain Data>` (open Brain Data from your space's top page, ••• → Copy link):

   ```text
   Follow the Instructions section of brain-assistant.md as your rules, except its lines about being a Custom Agent and about buttons. My Ultimate Brain is the Notion page Brain Data at <link to Brain Data>: read only the databases under it, through the Notion app, never a database with the same name elsewhere in my workspace. When I name a skill, or say what it does ("prep my 3pm" is Prep, "what's due today" is Today, "tidy that capture" is Tidy capture), follow that skill's text from the Skills section of brain-assistant.md, step by step. Before you change any page or property, show me the change and wait for my yes. Never create Tasks from a meeting.
   ```

## 3. Try it

In a chat in the project, select the Notion app (type `@` and pick it), then ask **"what's due today"**. It should list only tasks from the Tasks database under your Brain Data. If it shows a task from another space or template, give it the Brain Data link again in the chat, and check the link in the project's instructions.

When you upgrade Ultimate Brain, download `brain-assistant.md` again for the new version and replace the project's file.
