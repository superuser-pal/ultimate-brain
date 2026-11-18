#!/usr/bin/env node
// A fake Notion MCP server for CC-267's before/after catch-up (a stdio JSON-RPC server, no dependencies).
//
//   node notion-fake.mjs <sim dir>
//
// It answers with the tool names of the Notion MCP server (`API-post-page`, `API-patch-block-children`, …) and replies
// shaped like Notion's: a page with every property of its database, a block with its annotations, an append that returns the
// parent's blocks. So a run pays for the replies it would pay for against Notion. State is `<sim>/state.json` (written by
// setup.py, then by every write); every write is also a line of `<sim>/writes.jsonl`, which the run's collection counts.
// Everything in it is synthetic.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createInterface } from "node:readline";

const SIM = process.argv[2];
const STATE = join(SIM, "state.json");
const WRITES = join(SIM, "writes.jsonl");
// Ids built from parts, so no literal UUID sits in the repo (the leak check).
const fakeId = (head, n) => [head, "0000", "4000", "8000", String(n).padStart(12, "0")].join("-");
const USER = { object: "user", id: fakeId("c0000000", 1) };
const now = () => new Date().toISOString().replace(/\.\d+Z$/, ".000Z");
const load = () => JSON.parse(readFileSync(STATE, "utf8"));
const save = (s) => writeFileSync(STATE, JSON.stringify(s));
const logWrite = (entry) => appendFileSync(WRITES, `${JSON.stringify({ at: now(), ...entry })}\n`);
const clean = (id) => String(id ?? "").replace(/^.*?([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}).*$/i, "$1").toLowerCase();
const dashed = (id) => {
  const h = clean(id).replace(/-/g, "");
  return h.length === 32 ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : clean(id);
};

// Arguments may come as JSON strings inside the object; parse them as Notion's MCP server does.
function parseArgs(value) {
  if (typeof value === "string") {
    const t = value.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try { return parseArgs(JSON.parse(t)); } catch { return value; }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(parseArgs);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, parseArgs(v)]));
  return value;
}

const ANN = { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" };
function richText(items) {
  return (Array.isArray(items) ? items : []).map((r) => {
    if (r?.type === "mention" || r?.mention) return { type: "mention", mention: r.mention, annotations: { ...ANN, ...(r.annotations ?? {}) }, plain_text: r.plain_text ?? "", href: null };
    const content = r?.text?.content ?? r?.plain_text ?? (typeof r === "string" ? r : "");
    const link = r?.text?.link ?? null;
    return { type: "text", text: { content, link }, annotations: { ...ANN, ...(r?.annotations ?? {}) }, plain_text: content, href: link?.url ?? null };
  });
}
const plain = (rt) => (rt ?? []).map((r) => r.plain_text ?? "").join("");

// A property as sent (Notion API shape) to the stored shape Notion returns.
function normProp(name, value, schema) {
  const type = schema?.type ?? Object.keys(value ?? {}).find((k) => k !== "id" && k !== "type") ?? "rich_text";
  const v = value?.[type];
  const base = { id: schema?.id ?? name.slice(0, 4), type };
  switch (type) {
    case "title": case "rich_text": return { ...base, [type]: richText(v) };
    case "checkbox": return { ...base, checkbox: Boolean(v) };
    case "number": return { ...base, number: v ?? null };
    case "url": case "email": case "phone_number": return { ...base, [type]: v ?? null };
    case "date": return { ...base, date: v ? { start: v.start, end: v.end ?? null, time_zone: null } : null };
    case "select": case "status": return { ...base, [type]: v?.name ? { id: `opt-${v.name.length}`, name: v.name, color: "default" } : null };
    case "multi_select": return { ...base, multi_select: (v ?? []).map((o) => ({ id: `opt-${o.name.length}`, name: o.name, color: "default" })) };
    case "relation": return { ...base, relation: (v ?? []).map((r) => ({ id: dashed(r.id) })), has_more: false };
    case "people": return { ...base, people: (v ?? []).map((p) => ({ object: "user", id: p.id })) };
    default: return { ...base, [type]: v ?? null };
  }
}
function emptyProp(name, schema) {
  const t = schema.type;
  const empty = { title: [], rich_text: [], checkbox: false, number: null, url: null, date: null, select: null, status: null, multi_select: [], relation: [], people: [], email: null };
  return { id: schema.id, type: t, [t]: empty[t] ?? null, ...(t === "relation" ? { has_more: false } : {}) };
}

function pageObject(s, page) {
  const schema = s.schemas[page.database] ?? {};
  const properties = {};
  for (const [name, sc] of Object.entries(schema)) properties[name] = page.properties[name] ?? emptyProp(name, sc);
  for (const [name, p] of Object.entries(page.properties)) if (!(name in properties)) properties[name] = p;
  return {
    object: "page", id: page.id, created_time: page.created, last_edited_time: page.edited, created_by: USER, last_edited_by: USER,
    cover: null, icon: null, parent: { type: "data_source_id", data_source_id: page.database_id, database_id: page.database_id },
    archived: Boolean(page.in_trash), in_trash: Boolean(page.in_trash), is_locked: false, properties,
    url: `https://www.notion.so/${page.id.replace(/-/g, "")}`, public_url: null, request_id: randomUUID(),
  };
}

function blockObject(s, b) {
  return {
    object: "block", id: b.id, parent: b.parent_type === "page" ? { type: "page_id", page_id: b.parent } : { type: "block_id", block_id: b.parent },
    created_time: b.created, last_edited_time: b.edited, created_by: USER, last_edited_by: USER,
    has_children: (s.children[b.id] ?? []).length > 0, archived: false, in_trash: false, type: b.type, [b.type]: b.content,
  };
}

function addBlocks(s, parentId, children, after) {
  const made = [];
  const list = (s.children[parentId] ??= []);
  let at = after ? list.indexOf(dashed(after)) + 1 : list.length;
  if (at <= 0 && after) at = list.length;
  for (const raw of children ?? []) {
    const type = raw.type ?? Object.keys(raw).find((k) => !["object", "type", "children", "id"].includes(k));
    const body = { ...(raw[type] ?? {}) };
    const nested = body.children ?? raw.children ?? [];
    delete body.children;
    if (body.rich_text) body.rich_text = richText(body.rich_text);
    if (["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "toggle", "quote", "to_do", "callout"].includes(type)) {
      body.rich_text ??= [];
      body.color ??= "default";
      if (type.startsWith("heading_")) body.is_toggleable ??= false;
      if (type === "to_do") body.checked ??= false;
    }
    const id = randomUUID();
    const t = now();
    s.blocks[id] = { id, parent: parentId, parent_type: s.pages[parentId] ? "page" : "block", type, content: body, created: t, edited: t };
    list.splice(at++, 0, id);
    if (nested.length) addBlocks(s, id, nested);
    made.push(id);
  }
  return made;
}

function removeBlock(s, id) {
  for (const c of s.children[id] ?? []) removeBlock(s, c);
  delete s.children[id];
  const b = s.blocks[id];
  if (b) s.children[b.parent] = (s.children[b.parent] ?? []).filter((x) => x !== id);
  delete s.blocks[id];
}

function markdown(s, parent, depth = 0) {
  const out = [];
  for (const id of s.children[parent] ?? []) {
    const b = s.blocks[id];
    const text = plain(b.content.rich_text);
    const pad = "  ".repeat(depth);
    const line = {
      heading_1: `# ${text}`, heading_2: `## ${text}`, heading_3: `### ${text}`, bulleted_list_item: `${pad}- ${text}`,
      numbered_list_item: `${pad}1. ${text}`, to_do: `${pad}- [${b.content.checked ? "x" : " "}] ${text}`, quote: `> ${text}`, divider: "---",
    }[b.type] ?? text;
    if (b.type === "toggle" || b.content.is_toggleable) out.push(`<details><summary>${text}</summary>\n\n${markdown(s, id, 0)}\n</details>`);
    else { out.push(line); if ((s.children[id] ?? []).length) out.push(markdown(s, id, depth + 1)); }
  }
  return out.join("\n\n");
}

function matches(page, filter) {
  if (!filter) return true;
  if (filter.and) return filter.and.every((f) => matches(page, f));
  if (filter.or) return filter.or.some((f) => matches(page, f));
  const p = page.properties[filter.property];
  if (!p) return false;
  for (const kind of ["rich_text", "title", "select", "status", "checkbox"]) {
    const cond = filter[kind];
    if (!cond) continue;
    const value = kind === "checkbox" ? p.checkbox : kind === "select" || kind === "status" ? p[p.type]?.name : plain(p[p.type]);
    if ("equals" in cond) return value === cond.equals;
    if ("contains" in cond) return String(value ?? "").includes(cond.contains);
    if ("is_empty" in cond) return !value;
    if ("is_not_empty" in cond) return Boolean(value);
    if ("does_not_equal" in cond) return value !== cond.does_not_equal;
  }
  return true;
}

const err = (status, code, message) => ({ error: { object: "error", status, code, message, request_id: randomUUID() } });
const dbOf = (s, id) => Object.entries(s.databases).find(([, v]) => v === dashed(id))?.[0];

const TOOLS = {
  "API-post-page"(a, s) {
    const parentId = dashed(a.parent?.data_source_id ?? a.parent?.database_id ?? a.parent?.page_id);
    const database = dbOf(s, parentId);
    if (!database) return err(404, "object_not_found", `Could not find data source with ID: ${parentId}.`);
    const t = now();
    const page = { id: randomUUID(), database, database_id: parentId, properties: {}, created: t, edited: t };
    for (const [n, v] of Object.entries(a.properties ?? {})) page.properties[n] = normProp(n, v, s.schemas[database]?.[n]);
    s.pages[page.id] = page;
    if (a.template?.type === "default" && s.templates[database]) addBlocks(s, page.id, s.templates[database]);
    if (a.children?.length) addBlocks(s, page.id, a.children);
    logWrite({ tool: "post-page", database, page: page.id, brain_id: plain(page.properties["Brain ID"]?.rich_text) || null, name: plain(page.properties.Name?.title) || null });
    return pageObject(s, page);
  },
  "API-patch-page"(a, s) {
    const page = s.pages[dashed(a.page_id)];
    if (!page) return err(404, "object_not_found", `Could not find page with ID: ${a.page_id}.`);
    for (const [n, v] of Object.entries(a.properties ?? {})) page.properties[n] = normProp(n, v, s.schemas[page.database]?.[n]);
    if (a.in_trash !== undefined || a.archived !== undefined) page.in_trash = Boolean(a.in_trash ?? a.archived);
    page.edited = now();
    logWrite({ tool: "patch-page", database: page.database, page: page.id, brain_id: plain(page.properties["Brain ID"]?.rich_text) || null, props: Object.keys(a.properties ?? {}) });
    return pageObject(s, page);
  },
  "API-retrieve-a-page"(a, s) {
    const page = s.pages[dashed(a.page_id)];
    return page ? pageObject(s, page) : err(404, "object_not_found", `Could not find page with ID: ${a.page_id}.`);
  },
  "API-retrieve-a-page-property"(a, s) {
    const page = s.pages[dashed(a.page_id)];
    if (!page) return err(404, "object_not_found", `Could not find page with ID: ${a.page_id}.`);
    const p = Object.values(pageObject(s, page).properties).find((x) => x.id === a.property_id) ?? pageObject(s, page).properties[a.property_id];
    return p ? { object: "property_item", ...p } : err(404, "object_not_found", "Could not find property.");
  },
  "API-get-block-children"(a, s) {
    const id = dashed(a.block_id);
    if (!s.pages[id] && !s.blocks[id]) return err(404, "object_not_found", `Could not find block with ID: ${a.block_id}.`);
    const all = s.children[id] ?? [];
    const start = a.start_cursor ? all.indexOf(dashed(a.start_cursor)) : 0;
    const size = Math.min(Number(a.page_size) || 100, 100);
    const ids = all.slice(Math.max(start, 0), Math.max(start, 0) + size);
    const next = all[Math.max(start, 0) + size] ?? null;
    return { object: "list", results: ids.map((b) => blockObject(s, s.blocks[b])), next_cursor: next, has_more: Boolean(next), type: "block", block: {}, request_id: randomUUID() };
  },
  "API-patch-block-children"(a, s) {
    const id = dashed(a.block_id);
    if (!s.pages[id] && !s.blocks[id]) return err(404, "object_not_found", `Could not find block with ID: ${a.block_id}.`);
    const made = addBlocks(s, id, a.children, a.after);
    const page = s.pages[id] ?? s.pages[s.blocks[id]?.parent];
    logWrite({ tool: "append-blocks", parent: id, database: page?.database ?? null, brain_id: page ? plain(page.properties["Brain ID"]?.rich_text) || null : null, blocks: made.length });
    // Notion's reply here, as the gate measured (CC-264): the parent's first-level blocks, up to 100.
    const all = (s.children[id] ?? []).slice(0, 100);
    return { object: "list", results: all.map((b) => blockObject(s, s.blocks[b])), next_cursor: null, has_more: false, type: "block", block: {}, request_id: randomUUID() };
  },
  "API-delete-a-block"(a, s) {
    const b = s.blocks[dashed(a.block_id)];
    if (!b) return err(404, "object_not_found", `Could not find block with ID: ${a.block_id}.`);
    const obj = { ...blockObject(s, b), archived: true, in_trash: true };
    removeBlock(s, b.id);
    logWrite({ tool: "delete-block", block: b.id });
    return obj;
  },
  "API-retrieve-a-block"(a, s) {
    const b = s.blocks[dashed(a.block_id)];
    return b ? blockObject(s, b) : err(404, "object_not_found", `Could not find block with ID: ${a.block_id}.`);
  },
  "API-update-a-block"(a, s) {
    const b = s.blocks[dashed(a.block_id)];
    if (!b) return err(404, "object_not_found", `Could not find block with ID: ${a.block_id}.`);
    const v = a[b.type];
    if (v) b.content = { ...b.content, ...v, ...(v.rich_text ? { rich_text: richText(v.rich_text) } : {}) };
    b.edited = now();
    logWrite({ tool: "update-block", block: b.id });
    return blockObject(s, b);
  },
  "API-query-data-source"(a, s) {
    const id = dashed(a.data_source_id ?? a.database_id);
    const database = dbOf(s, id);
    if (!database) return err(404, "object_not_found", `Could not find data source with ID: ${id}.`);
    const all = Object.values(s.pages).filter((p) => p.database === database && !p.in_trash && matches(p, a.filter));
    const start = a.start_cursor ? Number(a.start_cursor) : 0;
    const size = Math.min(Number(a.page_size) || 100, 100);
    const results = all.slice(start, start + size).map((p) => pageObject(s, p));
    const more = start + size < all.length;
    return { object: "list", results, next_cursor: more ? String(start + size) : null, has_more: more, type: "page_or_data_source", page_or_data_source: {}, request_id: randomUUID() };
  },
  "API-retrieve-a-data-source"(a, s) {
    const id = dashed(a.data_source_id);
    const database = dbOf(s, id);
    if (!database) return err(404, "object_not_found", `Could not find data source with ID: ${id}.`);
    return { object: "data_source", id, title: [{ type: "text", text: { content: database, link: null }, plain_text: database }], properties: Object.fromEntries(Object.entries(s.schemas[database] ?? {}).map(([n, sc]) => [n, { id: sc.id, name: n, type: sc.type, [sc.type]: {} }])), parent: { type: "database_id", database_id: id } };
  },
  "API-retrieve-a-database"(a, s) {
    const id = dashed(a.database_id);
    const database = dbOf(s, id);
    if (!database) return err(404, "object_not_found", `Could not find database with ID: ${id}.`);
    return { object: "database", id, title: [{ type: "text", text: { content: database, link: null }, plain_text: database }], data_sources: [{ id, name: database }], is_inline: false, in_trash: false };
  },
  "API-list-data-source-templates"(a, s) {
    const database = dbOf(s, dashed(a.data_source_id));
    return { templates: s.templates[database] ? [{ id: fakeId("e0000000", 1), name: `${database} template`, is_default: true }] : [], has_more: false, next_cursor: null };
  },
  "API-retrieve-page-markdown"(a, s) {
    const id = dashed(a.page_id);
    if (!s.pages[id]) return err(404, "object_not_found", `Could not find page with ID: ${a.page_id}.`);
    return { object: "page_markdown", id, markdown: markdown(s, id), truncated: false, unknown_block_ids: [] };
  },
  "API-post-search"() {
    return { object: "list", results: [], next_cursor: null, has_more: false, type: "page_or_data_source", page_or_data_source: {} };
  },
};

const DESCRIPTIONS = {
  "API-post-page": ["Notion | Create a page", ["parent", "properties", "children", "template"]],
  "API-patch-page": ["Notion | Update page properties", ["page_id", "properties", "in_trash"]],
  "API-retrieve-a-page": ["Notion | Retrieve a page", ["page_id"]],
  "API-retrieve-a-page-property": ["Notion | Retrieve a page property item", ["page_id", "property_id"]],
  "API-get-block-children": ["Notion | Retrieve block children", ["block_id", "start_cursor", "page_size"]],
  "API-patch-block-children": ["Notion | Append block children", ["block_id", "children", "after"]],
  "API-delete-a-block": ["Notion | Delete a block", ["block_id"]],
  "API-retrieve-a-block": ["Notion | Retrieve a block", ["block_id"]],
  "API-update-a-block": ["Notion | Update a block", ["block_id"]],
  "API-query-data-source": ["Notion | Query a data source", ["data_source_id", "filter", "sorts", "start_cursor", "page_size"]],
  "API-retrieve-a-data-source": ["Notion | Retrieve a data source", ["data_source_id"]],
  "API-retrieve-a-database": ["Notion | Retrieve a database", ["database_id"]],
  "API-list-data-source-templates": ["Notion | List templates in a data source", ["data_source_id"]],
  "API-retrieve-page-markdown": ["Notion | Retrieve a page as Markdown", ["page_id"]],
  "API-post-search": ["Notion | Search by title", ["query", "filter"]],
};
const tools = Object.entries(DESCRIPTIONS).map(([name, [description, props]]) => ({
  name, description,
  inputSchema: { type: "object", properties: Object.fromEntries(props.map((p) => [p, {}])), additionalProperties: true },
}));

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // a notification
  if (method === "initialize") return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "notion-fake", version: "1.0.0" } } });
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools } });
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/call") {
    const fn = TOOLS[params?.name];
    if (!fn) return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Unknown tool ${params?.name}` }], isError: true } });
    let out;
    try {
      const s = load();
      out = fn(parseArgs(params.arguments ?? {}), s);
      save(s);
    } catch (e) {
      out = err(400, "validation_error", String(e?.message ?? e));
    }
    const isError = Boolean(out?.error);
    return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(isError ? out.error : out) }], isError } });
  }
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
});
