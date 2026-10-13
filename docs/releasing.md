# Releasing

How a change on `main` reaches users. The npm package `ultimate-brain` ships the CLI, the Codex skills (`.agents/skills/`), the brain template and the JSON schemas. The Claude Code plugin is read from GitHub directly.

## Once per machine

```sh
npm login        # the npm account that owns `ultimate-brain`
```

npm requires two-factor authentication to publish: turn it on at npmjs.com → Account → Two-Factor Authentication. `npm publish` then asks for the code (or pass `--otp=<code>`).

## Each release

From an up-to-date `main` with a clean tree:

```sh
npm test && npm run typecheck && npm run test:package
npm version minor        # or patch; bumps package.json, commits and tags vX.Y.Z
npm publish              # prepack builds dist/ first
git push --follow-tags
```

- **patch:** fixes only. **minor:** new commands, skill changes, new template rules. Stay below 1.0.0 until v1 is declared stable.
- Check the result with `npm view ultimate-brain version`.

## Then, in each brain

```sh
npm install -g ultimate-brain@latest
brain upgrade && git commit -am "upgrade: ultimate brain <version>"
```

`brain upgrade` logs the installed version.
