// Usage: node notion-search.cjs <title>. The MCP search for notion-sim: pages whose Name contains <title>.
const st = JSON.parse(require("fs").readFileSync(process.env.NOTION_SIM_DIR + "/state.json", "utf8"));
const q = (process.argv[2] || "").toLowerCase();
const r = Object.entries(st.pages).filter(([, p]) => String(p.properties.Name || "").toLowerCase().includes(q))
  .map(([id, p]) => ({ id, title: p.properties.Name, database: p.database }));
console.log(JSON.stringify({ results: r }, null, 2));
