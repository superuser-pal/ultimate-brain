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
 * is that PR's merge commit, unless `plain` makes it an ordinary commit the API still associates with the PR. `releases` are `{ version, at }` with `at` a history label,
 * and for vendoring (§9.2) optionally `draft`, `body` (the release notes), `annotated` (the tag is a tag object) and `assets`
 * (`{ id, name, bytes, redirect? }`; `redirect` answers with a 302 to a signed URL).
 */
export function forkState({ history, releases = [], schema = SCHEMA }) {
  return { history: history.map((commit) => ({ ...commit, sha: sha(commit.label) })), releases: releases.map((release) => ({ ...release, commit: sha(release.at) })), schema };
}

/**
 * Starts the mock. `state` = `{ fork, issues, schemaCommit, down?, forkDown?, token?, comparePageCap?, compareTruncated? }` (compare pages at most
 * `comparePageCap` commits, 100 by default; `compareTruncated` returns only the first page); `issues` are product issues and PRs:
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
      // A release asset's signed download URL (§9.2 step 3) takes no Authorization header, as GitHub's storage refuses one.
      if (url.pathname.startsWith("/signed/")) {
        if (request.headers.authorization !== undefined) return send(400, { message: "Authorization not allowed" });
        const asset = assetById(state, Number(url.pathname.slice("/signed/".length)));
        if (asset === undefined) return send(404, { message: "Not Found" });
        response.writeHead(200, { "content-type": "application/octet-stream" });
        return response.end(asset.bytes);
      }
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
        // Vendoring (§9.2): a release by tag with its notes and assets, the tag ref and tag object, and an asset's bytes.
        if ((match = /^\/releases\/tags\/brain-v(.+)$/.exec(rest))) {
          const release = state.fork.releases.find((entry) => entry.version === decodeURIComponent(match[1]));
          if (release === undefined) return send(404, { message: "Not Found" });
          return send(200, { tag_name: `brain-v${release.version}`, draft: release.draft ?? false, body: release.body ?? "", assets: (release.assets ?? []).map((asset) => ({ id: asset.id, name: asset.name })) });
        }
        if ((match = /^\/git\/ref\/tags\/brain-v(.+)$/.exec(rest))) {
          const release = state.fork.releases.find((entry) => entry.version === decodeURIComponent(match[1]));
          if (release === undefined) return send(404, { message: "Not Found" });
          return send(200, { ref: `refs/tags/brain-v${release.version}`, object: release.annotated ? { type: "tag", sha: sha(`tag ${release.version}`) } : { type: "commit", sha: release.commit } });
        }
        if ((match = /^\/git\/tags\/([0-9a-f]{40})$/.exec(rest))) {
          const release = state.fork.releases.find((entry) => entry.annotated && sha(`tag ${entry.version}`) === match[1]);
          return release === undefined ? send(404, { message: "Not Found" }) : send(200, { sha: match[1], object: { type: "commit", sha: release.commit } });
        }
        if ((match = /^\/releases\/assets\/(\d+)$/.exec(rest))) {
          const asset = assetById(state, Number(match[1]));
          if (asset === undefined) return send(404, { message: "Not Found" });
          if (request.headers.accept !== "application/octet-stream") return send(415, { message: "octet-stream only" });
          if (asset.redirect) {
            response.writeHead(302, { location: `http://${request.headers.host}/signed/${asset.id}` });
            return response.end();
          }
          response.writeHead(200, { "content-type": "application/octet-stream" });
          return response.end(asset.bytes);
        }
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
          const all = to > from ? history.slice(from + 1, to + 1).map((commit) => ({ sha: commit.sha, parents: commit.pull === undefined || commit.plain ? [{}] : [{}, {}] })) : [];
          const perPage = Math.min(Number(url.searchParams.get("per_page") ?? 250), state.comparePageCap ?? 100);
          const page = Number(url.searchParams.get("page") ?? 1);
          const commits = state.compareTruncated ? all.slice(0, perPage) : all.slice((page - 1) * perPage, page * perPage);
          return send(200, { status, total_commits: all.length, commits: page > 1 && state.compareTruncated ? [] : commits });
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

function assetById(state, id) {
  return (state.fork?.releases ?? []).flatMap((release) => release.assets ?? []).find((asset) => asset.id === id);
}

function view(issue) {
  return { number: issue.number, title: issue.title, body: issue.body, state: issue.state ?? "open", labels: (issue.labels ?? []).map((name) => ({ name })), ...(issue.pull_request === undefined ? {} : { pull_request: issue.pull_request }) };
}

const PACKAGE_SKILL = "---\nname: brain-apply\ndescription: Synthetic fixture skill.\n---\n";
const PACKAGE_HASH = createHash("sha256").update(PACKAGE_SKILL).digest("hex");
/** The integrity of every package snapshot `writePackage` writes: one skill, the same bytes. */
export const PACKAGE_INTEGRITY = `sha256-${createHash("sha256").update(`${PACKAGE_HASH}  brain-apply/SKILL.md\n`).digest("hex")}`;

/** The notes lines a fork release ends with (§10.2), for a package snapshot of range `cli`. */
export const releaseNotes = (cli, integrity = PACKAGE_INTEGRITY) => `Release notes.\n\nIntegrity: ${integrity}\nTarball-SHA256: ${"0".repeat(64)}\nCLI: ${cli}\n`;

/**
 * Writes a valid package snapshot at `<root>/.agents/skills` and the product's snapshot schema at `<root>/spec/schemas` (§2). A fork
 * snapshot (`ultimate-brain-skills`) also gets the LICENSE and NOTICE.md a vendored release carries (§9.1).
 */
export function writePackage(root, { name = "ultimate-brain", version = "0.9.0", cli = ">=0.9.0 <0.10.0", commit } = {}) {
  const folder = join(root, ".agents", "skills", "brain-apply");
  mkdirSync(folder, { recursive: true });
  const content = PACKAGE_SKILL;
  writeFileSync(join(folder, "SKILL.md"), content);
  const hash = PACKAGE_HASH;
  const integrity = PACKAGE_INTEGRITY;
  const fork = name === "ultimate-brain-skills";
  if (fork) {
    writeFileSync(join(root, ".agents", "skills", "LICENSE"), "MIT License\n");
    writeFileSync(join(root, ".agents", "skills", "NOTICE.md"), "# Notice\n");
  }
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
