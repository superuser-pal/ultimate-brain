# Security

## Reporting a problem

Please don't open a public issue for a security problem. Use **Report a vulnerability** on this repository's Security tab, which reaches the maintainers privately. Say what you found, how to reproduce it and which version (`brain --version`).

## What is in scope

- The `brain` command and the skills it installs.
- Anything that makes an agent run a command, push, change knowledge without your approval or send data out because of text it read (a note, a meeting, a web page, a Notion page).
- Anything that puts a token or private content into the brain repository, its backup or a log.

## What to know

- The command stores no credentials and contacts no service of ours. It pushes your brain to your backup with your own Git and `gh` sign-in; your Notion sign-in belongs to your agent.
- Skills are checked against the package's manifest: `brain lint` reports a skill file that was changed.
- During the beta, only the latest release is supported.
