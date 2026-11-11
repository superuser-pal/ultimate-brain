// The no-file-read check (decision 0077 §5, spec/eligibility.md §12 item 4): classifies one tool call of a native
// session. A call that opens, searches or lists a path under the brain folder fails the session, unless the path is
// an input being taken in (intake, §10) or a product file the agent may load (its skills and instructions). A `brain`
// CLI call is never such a read: answer surfaces, administrative commands (§7) and writes are recorded by category.
//
//   classifyCall(call, ctx) → { kind, reason, paths: [{ path, rel, access }], brain?: { args, sub, category } }
//   call: { tool, input }            normalised by trace.mjs: Claude Code's Read, Grep, Glob, Bash…; Codex's `shell`
//   ctx:  { brain, cwd, home, env, intake? }   absolute brain folder, the session's working folder and HOME, the
//                                              variables a shell would expand ($BRAIN_DIR, $HOME…), intake paths
//   kind: "brain-cli"     a call of the brain CLI (category: answer, administrative, write, other)
//         "brain-read"    a read, search or listing of a brain path: a violation
//         "product-read"  a brain path that holds product files (.agents/, .claude/, AGENTS.md, CLAUDE.md) or brain.json
//         "intake"        a brain path listed in ctx.intake (a new input being ingested, §10)
//         "other"         anything else (the caller repo's files, a tool with no path)
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

// Under the brain but not a note: what `brain init` installs (lint's `product-file`, cli.md §5.4) and the config.
const PRODUCT = [/^\.agents(\/|$)/, /^\.claude(\/|$)/, /^AGENTS\.md$/, /^CLAUDE\.md$/, /^brain\.json$/];
// Programs that take a path without opening, searching or listing it.
const NOT_READING = new Set(["echo", "printf", "cd", "pushd", "popd", "pwd", "export", "set", "unset", "true", "false", "test", "[", "basename", "dirname", "which", "type", "sleep", "date", "mkdir", "exit"]);
// Shell keywords before a command (`do brain query …`), and lines that are only structure (`for x in a b`, `done`).
const KEYWORDS = new Set(["do", "then", "else", "elif", "if", "while", "until", "!", "{"]);
const STRUCTURE = new Set(["for", "done", "fi", "esac", "}", "case", "function", "select"]);
// Wrappers whose first argument that is not an option is the real program.
const WRAPPERS = new Set(["sudo", "env", "command", "time", "nice", "nohup", "exec", "xargs", "builtin"]);

// The brain CLI's commands by what they do to the brain (spec/eligibility.md §7 and §10; cli.md §2).
const ANSWER = new Set(["query", "recall"]);
const ADMIN = new Set(["status", "index", "lint", "log", "modules", "config", "schedule", "repo", "assistant", "views", "skills", "--version", "--help", "help", "workflow"]);
const WRITE = new Set(["apply", "proposal", "note", "correct", "link", "upgrade", "init", "source", "extract", "sync", "report", "question", "recover", "id"]);

/** The brain CLI's category for an argument list (`query --read …` → answer). */
export function brainCategory(args) {
  const sub = args.find((a) => !a.startsWith("-") || a === "--version" || a === "--help") ?? "";
  if (sub === "reflect") return { sub, category: args.includes("--candidates") ? "answer" : "write" };
  if (sub === "proposal" && args.includes("list")) return { sub: "proposal list", category: "administrative" };
  if (sub === "sync" && ["plan", "render", "record"].some((s) => args.includes(s))) return { sub: `sync ${["plan", "render", "record"].find((s) => args.includes(s))}`, category: "administrative" };
  if (ANSWER.has(sub)) return { sub: `${sub} ${args.find((a) => ["--candidates", "--read", "--pack", "--search", "--historical"].includes(a)) ?? ""}`.trim(), category: "answer" };
  if (ADMIN.has(sub)) return { sub, category: "administrative" };
  if (WRITE.has(sub)) return { sub, category: "write" };
  return { sub, category: "other" };
}

// ---- shell ----

/**
 * Splits a shell command into simple commands: [{ words, redirects, sub? }]. Handles quotes, backslashes, `;`, `&&`,
 * `||`, `|`, `&`, newlines, parentheses, redirections and `$(…)` / backticks (their text is split too, as `sub`).
 * Variables listed in `vars` are expanded outside single quotes, and `~` at the start of an unquoted word.
 */
export function splitShell(text, vars = {}) {
  const commands = [];
  let words = [];
  let redirects = [];
  let word = null; // null: no word started
  let pendingRedirect = null;
  const subs = [];
  const finishWord = () => {
    if (word === null) return;
    if (pendingRedirect) { redirects.push({ op: pendingRedirect, target: word }); pendingRedirect = null; }
    else words.push(word);
    word = null;
  };
  const finishCommand = () => {
    finishWord();
    if (words.length || redirects.length) commands.push({ words, redirects });
    words = [];
    redirects = [];
  };
  const expand = (i, quoted) => {
    // $NAME, ${NAME}; returns [value, next index] or null
    const m = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/.exec(text.slice(i));
    if (!m) return null;
    const name = m[1] ?? m[2];
    return [name in vars ? vars[name] : (quoted ? "" : ""), i + m[0].length];
  };
  const takeSub = (i) => {
    // i at "$(" → returns end index after the matching ")"
    let depth = 0;
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === "(") depth++;
      else if (text[j] === ")") { depth--; if (depth === 0) { subs.push(text.slice(i + 2, j)); return j + 1; } }
    }
    subs.push(text.slice(i + 2));
    return text.length;
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      word = (word ?? "") + text.slice(i + 1, end < 0 ? text.length : end);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let out = "";
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\" && j + 1 < text.length) { out += text[j + 1]; j += 2; continue; }
        if (text[j] === "$" && text[j + 1] === "(") { j = takeSub(j); continue; }
        if (text[j] === "$") { const e = expand(j, true); if (e) { out += e[0]; j = e[1]; continue; } }
        out += text[j++];
      }
      word = (word ?? "") + out;
      i = j + 1;
      continue;
    }
    if (ch === "\\") { word = (word ?? "") + (text[i + 1] ?? ""); i += 2; continue; }
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      subs.push(text.slice(i + 1, end < 0 ? text.length : end));
      word = word ?? "";
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (ch === "$" && text[i + 1] === "(") { i = takeSub(i); word = word ?? ""; continue; }
    if (ch === "$") { const e = expand(i, false); if (e) { word = (word ?? "") + e[0]; i = e[1]; continue; } }
    if (ch === "~" && word === null && (text[i + 1] === "/" || text[i + 1] === undefined || /[\s;|&)]/.test(text[i + 1]))) {
      word = vars.HOME ?? "~";
      i++;
      continue;
    }
    if (ch === "#" && word === null) { const end = text.indexOf("\n", i); i = end < 0 ? text.length : end; continue; }
    if (/\s/.test(ch) && ch !== "\n") { finishWord(); i++; continue; }
    if (ch === "\n" || ch === ";" || ch === "|" || ch === "&" || ch === "(" || ch === ")") {
      // `2>&1`, `>&2`: a redirection to a descriptor, not a separator
      if (ch === "&" && pendingRedirect && word === null) { pendingRedirect = null; i++; while (/\d/.test(text[i] ?? "")) i++; continue; }
      finishCommand();
      i += (ch === "&" && text[i + 1] === "&") || (ch === "|" && text[i + 1] === "|") || (ch === ";" && text[i + 1] === ";") ? 2 : 1;
      continue;
    }
    if (ch === ">" || ch === "<") {
      // a digit just before (2>) belongs to the operator
      if (word !== null && /^\d+$/.test(word)) word = null;
      else finishWord();
      let op = ch;
      i++;
      if (text[i] === ">" || (ch === "<" && text[i] === "<")) { op += text[i]; i++; }
      if (ch === "<" && op === "<<") { // here-document: skip its delimiter word, its body is not a path
        pendingRedirect = "<<";
        continue;
      }
      pendingRedirect = op;
      continue;
    }
    word = (word ?? "") + ch;
    i++;
  }
  finishCommand();
  for (const sub of subs) commands.push(...splitShell(sub, vars).map((c) => ({ ...c, sub: true })));
  return commands;
}

/** A Codex command (`/bin/zsh -lc '…'`, `bash -c "…"`) unwrapped to the script it runs. */
export function unwrapShell(command) {
  if (Array.isArray(command)) command = command.join(" ");
  const m = /^\s*(?:\/(?:usr\/)?bin\/)?(?:ba|z|da)?sh\s+-l?c\s+([\s\S]+)$/.exec(command);
  if (!m) return command;
  const [inner] = splitShell(m[1]).flatMap((c) => c.words);
  return inner ?? command;
}

// ---- paths ----

function under(base, path) {
  const rel = relative(base, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)) ? rel.split(sep).join("/") : null;
}

/** A path as the call names it, resolved against `cwd`; a glob's magic part is kept (it only narrows a brain path). */
function absolute(path, cwd) {
  return normalize(isAbsolute(path) ? path : join(cwd, path));
}

/** Where a path falls: { rel, access } when under the brain, else null. */
function brainPath(path, ctx) {
  const roots = ctx.brainAliases ?? [ctx.brain];
  for (const root of roots) {
    const rel = under(root, path);
    if (rel === null) continue;
    for (const intake of ctx.intake ?? []) if (under(intake, path) !== null) return { path, rel, access: "intake" };
    if (rel !== "" && PRODUCT.some((re) => re.test(rel))) return { path, rel, access: "product" };
    return { path, rel, access: "note" };
  }
  return null;
}

/**
 * Absolute brain paths written inside a longer word (an inline script, a here-document line). Only paths spelled out
 * from the brain's absolute folder are found; a path an interpreter builds at run time (from an environment variable,
 * by joining strings) is not: the check's stated limit (README "The no-file-read check").
 */
function embeddedBrainPaths(word, ctx) {
  const found = [];
  for (const root of ctx.brainAliases ?? [ctx.brain]) {
    const re = new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/[^\\s'"\`)\\];,]*)?(?![\\w.-])`, "g");
    for (const m of word.matchAll(re)) {
      const hit = brainPath(normalize(m[0]), ctx);
      if (hit && !found.some((f) => f.path === hit.path)) found.push(hit);
    }
  }
  return found;
}

/** The outcome for a set of brain paths a call touches. */
function verdict(paths, reason) {
  if (paths.some((p) => p.access === "note")) return { kind: "brain-read", reason, paths };
  if (paths.some((p) => p.access === "product")) return { kind: "product-read", reason, paths };
  if (paths.length) return { kind: "intake", reason, paths };
  return { kind: "other", reason, paths };
}

function isBrainProgram(words) {
  const [program, script] = words;
  const name = program?.split("/").pop();
  if (name === "brain" || name === "ultimate-brain") return 1;
  if (name === "node" && script && /(?:^|\/)(?:brain\.js|cli\.ts)$/.test(script)) return 2;
  if ((name === "npx" || name === "pnpx") && (script === "brain" || script === "ultimate-brain")) return 2;
  return 0;
}

/** Classifies one shell script (every simple command in it); the worst verdict wins. */
function classifyShell(script, ctx) {
  const vars = { HOME: ctx.home, ...(ctx.env ?? {}) };
  let cwd = ctx.cwd;
  const brainCalls = [];
  const hits = [];
  for (const { words: raw, redirects, sub } of splitShell(script, vars)) {
    let words = raw;
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words = words.slice(1);
    while (words.length && (KEYWORDS.has(words[0]) || WRAPPERS.has(words[0].split("/").pop()))) {
      if (KEYWORDS.has(words[0])) { words = words.slice(1); continue; }
      words = words.slice(1);
      while (words.length && (words[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]))) words = words.slice(1);
    }
    const program = words[0]?.split("/").pop();
    for (const r of redirects) {
      if (r.op === "<<") continue;
      const hit = brainPath(absolute(r.target, cwd), ctx);
      if (hit) hits.push({ ...hit, by: `${program ?? ""} ${r.op} ${r.target}`.trim() });
    }
    if (!program || STRUCTURE.has(words[0])) continue;
    if (program === "cd" || program === "pushd") { cwd = absolute(words[1] ?? ctx.home, cwd); continue; }
    const skip = isBrainProgram(words);
    if (skip) { brainCalls.push(words.slice(skip)); continue; }
    // A program that only names a path is exempt, except inside a substitution, whose output feeds another command
    // (`cat $(echo /…/brain/a.md)`).
    if (NOT_READING.has(program) && !sub) continue;
    const args = words.slice(1).map((w) => (w.startsWith("-") && w.includes("=") ? w.slice(w.indexOf("=") + 1) : w)).filter((w) => w && !w.startsWith("-"));
    // Standing in the brain folder, any program but the brain CLI and those above reads it (`cd brain && grep -r x`);
    // elsewhere, a path argument under the brain does (`cat ~/x/brain/decisions/a.md`, `ls ../../brain`).
    const inBrain = brainPath(cwd, ctx);
    if (inBrain) { hits.push({ ...inBrain, by: `${program} (in ${inBrain.rel || "the brain folder"})` }); continue; }
    const named = new Set();
    for (const arg of args) {
      const hit = brainPath(absolute(arg, cwd), ctx);
      if (hit) { hits.push({ ...hit, by: program }); named.add(arg); }
    }
    // A brain path inside a word: an interpreter's inline script (`python3 -c "open('/…/brain/a.md')"`,
    // `node -e …`) or a here-document's body, whose lines split into words like `open("/…/brain/a.md").read`.
    for (const word of words) {
      if (named.has(word)) continue;
      for (const hit of embeddedBrainPaths(word, ctx)) hits.push({ ...hit, by: `${program} (a path inside its script)` });
    }
  }
  const result = verdict(hits, hits.length ? `shell: ${[...new Set(hits.map((h) => h.by))].join(", ")}` : "shell");
  if (brainCalls.length) {
    const brain = brainCalls.map((args) => ({ args, ...brainCategory(args) }));
    if (result.kind === "other") return { kind: "brain-cli", reason: brain.map((b) => `brain ${b.sub}`).join(", "), paths: [], brain };
    result.brain = brain;
  }
  return result;
}

/** Classifies one normalised tool call. */
export function classifyCall(call, ctx) {
  const input = call.input ?? {};
  const at = (p) => (p ? brainPath(absolute(p, ctx.cwd), ctx) : null);
  switch (call.tool) {
    case "Read":
    case "NotebookRead":
    case "Edit":
    case "Write":
    case "MultiEdit":
    case "NotebookEdit": {
      const hit = at(input.file_path ?? input.notebook_path ?? input.path);
      return verdict(hit ? [{ ...hit, by: call.tool }] : [], call.tool);
    }
    case "LS": {
      const hit = at(input.path);
      return verdict(hit ? [{ ...hit, by: "LS" }] : [], "LS");
    }
    case "Grep": {
      const hit = at(input.path ?? ctx.cwd);
      return verdict(hit ? [{ ...hit, by: "Grep" }] : [], "Grep");
    }
    case "Glob": {
      const base = input.path ?? ctx.cwd;
      const pattern = input.pattern ?? "";
      const hits = [at(base), isAbsolute(pattern) ? at(pattern.replace(/[*?[{].*$/, "")) : at(join(base, pattern.replace(/[*?[{].*$/, "")))].filter(Boolean);
      return verdict(hits.map((h) => ({ ...h, by: "Glob" })), "Glob");
    }
    case "Bash":
    case "shell":
      return classifyShell(call.tool === "shell" ? unwrapShell(input.command ?? "") : input.command ?? "", ctx);
    default:
      return { kind: "other", reason: call.tool, paths: [] };
  }
}
