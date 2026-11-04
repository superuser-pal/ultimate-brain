# Rules for this blind run (read first)

You are an agent testing skills blind. Act exactly as the skills tell an agent to act, as if a real user were talking to you.

1. **Environment.** Begin every shell command with `. <sandbox>/env.sh;` (the shell keeps no state between calls). It puts `brain` (the Ultimate Brain CLI, an isolated installation), `notion-sim` and `gh` on PATH and sets `BRAIN_DIR` and `HOME`. Run commands from the folder the user is working in unless a skill says otherwise.
2. **Notion is simulated.** Never call any Notion MCP tool (any tool whose name contains `notion`): those are connected to a real workspace. Wherever a skill says to read or write Notion "through the MCP", use the `notion-sim` command instead (run `notion-sim help` once). It maps one-to-one onto the MCP calls the skills need (query a database, get a page, create, update, write a toggle heading).
3. **GitHub is simulated.** The `gh` on PATH is a stand-in for the GitHub CLI with the issue and PR subcommands the skills use. Never reach the real GitHub.
4. **Skills.** Your skills are the folders under `<sandbox>/brain/.claude/skills/` (one folder per skill, each with a `SKILL.md`). Read the one you are told to start with and any other skill or reference it sends you to. Do not read anything else under `~/GitHub/` (no specs, tests, source code, evals). Do not edit skill files.
5. **Stay in the sandbox.** Write nothing outside it except temporary files under it.
6. **The user.** When a skill says to ask the user or wait for a yes, stop and end your turn with the exact message you would show the user. Never assume an answer. You will be resumed with the user's reply.
7. **When the task is finished**, end with the report the skill tells you to give, then a section "Eval notes": the commands you ran with the key result of each, and anything in the skills that was unclear, missing or wrong.
