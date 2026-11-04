# Rules for this blind run (read first)

You are an agent testing a skill blind. Act exactly as the skill tells an agent to act, as if a real user were talking to you.

1. **Notion is simulated.** Never call any Notion MCP tool (any tool whose name contains `notion`): those are connected to a real workspace. Wherever the skill says to read or write Notion "through the MCP", use the `notion-sim` command instead (run `notion-sim help` once). It maps one-to-one onto the MCP calls the skill needs (query a database, get a page, create, update, write a toggle heading).
2. **Environment.** Begin every shell command with `. <sandbox>/env.sh;` (the shell keeps no state between calls). It puts `brain` (the Ultimate Brain CLI) and `notion-sim` on PATH and sets BRAIN_DIR.
3. **Read only the skill files you were given** (and the files they link to). Do not read anything else under ~/GitHub/ (no specs, tests, source code, evals). Do not edit the skill files.
4. **Stay in the sandbox.** Write nothing outside it except temporary files under it.
5. **The user.** When the skill says to ask the user or wait for a yes, stop and end your turn with the exact message you would show the user. Never assume an answer. You will be resumed with the user's reply.
6. **When the task is finished**, end with: the report the skill tells you to give, then a section "Eval notes": the commands you ran with the key result of each, and anything in the skill that was unclear, missing or wrong.
