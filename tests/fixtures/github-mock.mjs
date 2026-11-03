// A mock GitHub REST API for the skills-integration check (spec/skills-delivery.md §11, CC-106): the product's issues and the fork's
// releases, history, PRs and vendored schema. Tests never call the real API. Synthetic data only.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";

const SOURCE = resolve(import.meta.dirname, "..", "..");
export const PRODUCT = "example/ultimate-brain";
export const FORK = "example/ultimate-brain-skills";
export const TOKEN = "test-token";
export const SCHEMA = readFileSync(join(SOURCE, "spec", "schemas", "skills-snapshot.schema.json"), "utf8");

/** A 40-hex commit id from a short label. */
export const sha = (label) => createHash("sha1").update(label).digest("hex");

/** A PR body declaring `impact` (§10.4), with `Product:` links. */
export const prBody = (impact, links = []) => [`Fork change.`, "", ...(impact === undefined ? [] : [`Brain impact: ${impact}`]), ...links.map((link) => `Product: ${link}`)].join("\n");

/**
 * The fork's state: `history` is its `main`, oldest first; each commit is `{ label, pull? }`, and a commit with a `pull` (`{ number, body }`)
 * is that PR's merge commit. `releases` are `{ version, at }` with `at` a history label.
 */
export function forkState({ history, releases = [], schema = SCHEMA }) {
  return { history: history.map((commit) => ({ ...commit, sha: sha(commit.label) })), releases: releases.map((release) => ({ ...release, commit: sha(release.at) })), schema };
}

/**
 * Starts the mock. `state` = `{ fork, issues, schemaCommit, down?, forkDown?, token? }`; `issues` are product issues and PRs:
 * `{ number, title?, body?, state?, labels?, pull_request?, updated? }`. Returns `{ url, state, requests, close }`; writes change `state.issues`.
 */
export async function startMock(state) {
  state.issues ??= [];
  const requests = [];
  const server = createServer((request, response) => {
    let text = "";
    request.on("data", (chunk) => { text += chunk; });
    request.on("end", () => {
      const url = new URL(request.url, "http://mock");
      requests.push({ method: request.method, path: url.pathname, query: url.search, body: text === "" ? undefined : JSON.parse(text) });
      const send = (status, value) => { response.writeHead(status, { "content-type": "application/json" }); response.end(value === undefined ? "" : JSON.stringify(value)); };
      if (request.headers.authorization !== `Bearer ${state.token ?? TOKEN}`) return send(401, { message: "Bad credentials" });
      if (state.down) return send(503, { message: "unavailable" });
      const fork = `/repos/${FORK}`;
      const product = `/repos/${PRODUCT}`;
      const path = url.pathname;
      if (path.startsWith(fork)) {
        if (state.forkDown) return send(503, { message: "unavailable" });
        const history = state.fork.history;
        const find = (ref) => history.find((commit) => commit.sha === ref) ?? history.find((commit) => commit.sha === state.fork.releases.find((release) => `brain-v${release.version}` === ref)?.commit);
        const rest = path.slice(fork.length);
        if (rest === "/commits/main") return send(200, { sha: history.at(-1).sha });
        if (rest === "/releases") return send(200, state.fork.releases.map((release) => ({ tag_name: `brain-v${release.version}`, draft: release.draft ?? false })));
        let match;
        if ((match = /^\/commits\/([^/]+)\/pulls$/.exec(rest))) {
          const commit = find(match[1]);
          return send(200, commit?.pull === undefined ? [] : [{ number: commit.pull.number, body: commit.pull.body, merged_at: "2026-11-01T00:00:00Z" }]);
        }
        if ((match = /^\/commits\/([^/]+)$/.exec(rest))) {
          const commit = find(decodeURIComponent(match[1]));
          return commit === undefined ? send(404, { message: "Not Found" }) : send(200, { sha: commit.sha });
        }
        if ((match = /^\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/.exec(rest))) {
          const [from, to] = [history.findIndex((commit) => commit.sha === match[1]), history.findIndex((commit) => commit.sha === match[2])];
          if (from === -1 || to === -1) return send(404, { message: "Not Found" });
          const status = from === to ? "identical" : to > from ? "ahead" : "behind";
          const commits = to > from ? history.slice(from + 1, to + 1).map((commit) => ({ sha: commit.sha, parents: commit.pull === undefined ? [{}] : [{}, {}] })) : [];
          return send(200, { status, commits });
        }
        if (rest === "/contents/schemas/skills-snapshot.schema.json") {
          return state.fork.schema === null ? send(404, { message: "Not Found" }) : send(200, { content: Buffer.from(state.fork.schema).toString("base64"), encoding: "base64" });
        }
        return send(404, { message: "Not Found" });
      }
      if (path === `${product}/issues` && request.method === "GET") {
        const label = url.searchParams.get("labels");
        const wanted = url.searchParams.get("state");
        const list = state.issues.filter((issue) => (issue.labels ?? []).includes(label) && (issue.state ?? "open") === wanted)
          .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
        return send(200, list.map(view));
      }
      if (path === `${product}/issues` && request.method === "POST") {
        const body = JSON.parse(text);
        const issue = { number: Math.max(0, ...state.issues.map((entry) => entry.number)) + 1, title: body.title, body: body.body, labels: body.labels, state: "open", updated: Date.now() };
        state.issues.push(issue);
        return send(201, view(issue));
      }
      let match;
      if ((match = new RegExp(`^${product}/issues/(\\d+)$`).exec(path))) {
        const issue = state.issues.find((entry) => entry.number === Number(match[1]));
        if (issue === undefined) return send(404, { message: "Not Found" });
        if (request.method === "PATCH") Object.assign(issue, JSON.parse(text), { updated: Date.now() });
        return send(200, view(issue));
      }
      if (path === `${product}/commits`) return send(200, state.schemaCommit === undefined ? [] : [{ html_url: `https://github.com/${PRODUCT}/commit/${state.schemaCommit}` }]);
      return send(404, { message: "Not Found" });
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${server.address().port}`, state, requests, close: () => new Promise((done) => server.close(done)) };
}

function view(issue) {
  return { number: issue.number, title: issue.title, body: issue.body, state: issue.state ?? "open", labels: (issue.labels ?? []).map((name) => ({ name })), ...(issue.pull_request === undefined ? {} : { pull_request: issue.pull_request }) };
}

/** Writes a valid package snapshot at `<root>/.agents/skills` and the product's snapshot schema at `<root>/spec/schemas` (§2). */
export function writePackage(root, { name = "ultimate-brain", version = "0.9.0", cli = ">=0.9.0 <0.10.0", commit } = {}) {
  const folder = join(root, ".agents", "skills", "brain-apply");
  mkdirSync(folder, { recursive: true });
  const content = "---\nname: brain-apply\ndescription: Synthetic fixture skill.\n---\n";
  writeFileSync(join(folder, "SKILL.md"), content);
  const hash = createHash("sha256").update(content).digest("hex");
  const integrity = `sha256-${createHash("sha256").update(`${hash}  brain-apply/SKILL.md\n`).digest("hex")}`;
  const fork = name === "ultimate-brain-skills";
  const manifest = {
    format: 1, name, version, cli,
    source: fork ? { repository: `https://github.com/${FORK}`, commit } : { repository: "https://www.npmjs.com/package/ultimate-brain" },
    upstream: fork ? { repository: "https://github.com/example/skills", commit: sha("upstream") } : null,
    integrity,
    skills: [{ name: "brain-apply", targets: ["brain"], files: [{ path: "SKILL.md", sha256: hash, bytes: Buffer.byteLength(content) }] }],
  };
  writeFileSync(join(root, ".agents", "skills", "snapshot.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  mkdirSync(join(root, "spec", "schemas"), { recursive: true });
  copyFileSync(join(SOURCE, "spec", "schemas", "skills-snapshot.schema.json"), join(root, "spec", "schemas", "skills-snapshot.schema.json"));
  return integrity;
}
