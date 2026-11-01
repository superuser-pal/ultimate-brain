#!/usr/bin/env python3
"""Build the brains and the simulated Notion files for the accepted-wording runs (CC-73, decision 0054).

    python3 eval/wording-0.8.0/setup.py <scenario>      one scenario
    python3 eval/wording-0.8.0/setup.py all             every scenario

Needs `npm run build` in the repo first (the `brain` shim runs bin/brain.js). Everything is synthetic and goes under
$UB_EVAL_DIR (default /tmp/ub-eval-0.8.0): `bin/brain` (the shim), `no-mcp.json` (an empty MCP config), and per scenario
`<name>/` (the brain) and `<name>-sim/` (the Notion answers: documents.json, reports.json, pages/<id>.json, snapshot.json, writes.md).
The snapshot does NOT carry the `wording` objects: building them from the pages is the skill's job, and what the runs test.
"""
import hashlib, json, os, pathlib, shutil, subprocess, sys

R = pathlib.Path(__file__).resolve().parents[2]
B = pathlib.Path(os.environ.get("UB_EVAL_DIR", "/tmp/ub-eval-0.8.0"))
NOW = "2026-12-14T09:00:00Z"
def uid(n): return f"{0xe2000000:08x}-0000-4000-8000-{n:012d}"
SEED = "## Why\n\nWe need one login for the website and the app.\n"
ACCEPTED_DOC = "> Purpose: decide how people sign in to the Acme website.\n\n## Main content\n\nEmail login only for launch; social login after launch.\n\n## Open questions\n\n- Who owns the password-reset emails?\n\n## Sources\n\n- [Use Supabase for auth](../decisions/2026-12-03-use-supabase-for-auth.md)\n"
REPORT_OLD = "\n\n".join(["## Where it stands", "Launch is set for February.", "## Timeline", "- 2026-12-03: auth chosen.", "## Decisions in force", "- Use Supabase for auth", "## Open questions and risks", "- None", "## People involved", "- Maria López", "## Gaps", "- Nothing on pricing."]) + "\n"
REPORT_NEW = REPORT_OLD.replace("Launch is set for February.", "As of 2026-12-14, from the pages in Notion: launch is set for February and the login work has started.")


def sha(text): return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def prepare():
    (B / "bin").mkdir(parents=True, exist_ok=True)
    shim = B / "bin" / "brain"
    shim.write_text(f'#!/bin/sh\nexec node {R}/bin/brain.js "$@"\n')
    shim.chmod(0o755)
    (B / "no-mcp.json").write_text('{"mcpServers":{}}\n')
    os.environ["PATH"] = f"{B / 'bin'}:{os.environ['PATH']}"


def sh(*a, cwd=None, check=True):
    return subprocess.run(a, cwd=cwd, check=check, capture_output=True, text=True).stdout


def git(d, *a, check=True):
    return sh("git", "-c", "user.name=Blind", "-c", "user.email=b@brain.example", *a, cwd=d, check=check)


def brain(d, *args):
    return json.loads(sh("brain", *args, "--brain", str(d), "--now", NOW, "--json"))["data"]


def make(name):
    d = B / name
    shutil.rmtree(d, ignore_errors=True); shutil.rmtree(B / f"{name}-sim", ignore_errors=True)
    sh("node", "scripts/blind-brain.mjs", "brain-acme", str(d), cwd=R)
    sh("brain", "proposal", "backlog", "--brain", str(d), "--json")
    config(d, lambda c: c.update({"settings": {"publish": "auto", "push": "auto"}, "modules": {"knowledge": True, "orgs": True, "documents": True, "reports": True, "tasks": False, "planning": False}}))
    def dbs(c):
        for i, k in enumerate(c["notion"]["databases"]): c["notion"]["databases"][k] = uid(i + 1)
        for i, k in enumerate(["inbox", "concepts", "documents"]): c["notion"]["databases"][k] = uid(50 + i)
    config(d, dbs)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: backlog done, Notion connected", check=False)
    return d


def config(d, fn):
    p = d / "brain.json"; c = json.loads(p.read_text()); fn(c); p.write_text(json.dumps(c, indent=2) + "\n")


def edit_front(path, notion, published):
    t = path.read_text()
    block = f"\nnotion: {notion}\nnotion_published:\n" + "".join(f'  "{k}": {json.dumps(v)}\n' for k, v in published.items())
    path.write_text(t.replace("\n---\n", block + "---\n", 1))


def promoted(d, title, frm, notion, body=SEED):
    inp = B / f"{d.name}-{title.split()[0].lower()}.json"
    inp.write_text(json.dumps({"notes": [{"type": "reference", "title": title, "frontmatter": {"summary": f"{title}.", "origin": "promoted", "promoted_from": frm}, "body": body}]}))
    made = brain(d, "note", "new", "--input", str(inp))["created"][0]
    path = d / made["path"]
    seed_hash = sha(path.read_text().split("\n---\n", 1)[1].lstrip("\n"))
    edit_front(path, notion, {"@content": seed_hash, "@notion_body": seed_hash, "@git_body": seed_hash})
    return made["id"], notion


def report(d, notion):
    inp = B / f"{d.name}-report.json"
    inp.write_text(json.dumps({"title": "Acme launch: where we stand", "question": "Where does the Acme launch stand?", "projects": ["prj-9x4t1b7e"], "body": REPORT_OLD}))
    vw = brain(d, "report", "new", "--input", str(inp))["id"]
    path = next((d / "reports").glob("*.md"))
    h = sha(REPORT_OLD)
    edit_front(path, notion, {"@content": h, "@notion_body": h, "@git_body": h, "@fixes": 0})
    return vw


def blocks(markdown_doc):
    """Notion-like blocks for the accepted document text."""
    return [
        {"type": "callout", "icon": "💡", "text": "Purpose: decide how people sign in to the Acme website."},
        {"type": "heading_2", "text": "Main content"},
        {"type": "paragraph", "text": "Email login only for launch; social login after launch."},
        {"type": "heading_2", "text": "Open questions"},
        {"type": "bulleted_list_item", "text": "Who owns the password-reset emails?"},
        {"type": "heading_2", "text": "Sources"},
        {"type": "bulleted_list_item", "text": "Use Supabase for auth", "link": "../decisions/2026-12-03-use-supabase-for-auth.md"},
    ]


def report_blocks(text):
    out = []
    for part in text.strip().split("\n\n"):
        if part.startswith("## "): out.append({"type": "heading_2", "text": part[3:]})
        elif part.startswith("- "): out.append({"type": "bulleted_list_item", "text": part[2:]})
        else: out.append({"type": "paragraph", "text": part})
    return out


def sim(name, documents=(), reports=(), pages=None, rereads=None):
    """`rereads`: page id -> the page as it is when the skill reads it again just before applying (a change between plan and apply)."""
    s = B / f"{name}-sim"; (s / "pages").mkdir(parents=True, exist_ok=True)
    (s / "documents.json").write_text(json.dumps(list(documents), indent=1))
    (s / "reports.json").write_text(json.dumps(list(reports), indent=1))
    (s / "snapshot.json").write_text(json.dumps({"as_of": NOW, "rows": []}, indent=1))
    for pid, page in (pages or {}).items(): (s / "pages" / f"{pid}.json").write_text(json.dumps(page, indent=1))
    for pid, page_ in (rereads or {}).items(): (s / "pages" / f"{pid}.reread.json").write_text(json.dumps(page_, indent=1))
    (s / "writes.md").write_text("")


def doc_row(page, brain_id, accepted, accepted_at, edited):
    return {"database": "documents", "page_id": page, "last_edited_time": edited, "properties": {"Brain ID": brain_id, "Accepted": accepted, "Accepted at": {"start": accepted_at} if accepted_at else None}}


def page(blocks_, edited, accepted=True, accepted_at="2026-12-14T08:50:00.000Z"):
    return {"last_edited_time": edited, "properties": {"Accepted": accepted, "Accepted at": {"start": accepted_at} if accepted_at else None}, "blocks": blocks_}


def scenario_import():
    d = make("import"); did, p = promoted(d, "Login page", "dec-7k2m9q4x", uid(101))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: promoted Document published")
    sim("import", documents=[doc_row(p, did, True, "2026-12-14T08:50:00.000Z", "2026-12-14T08:50:00.000Z")], pages={p: page(blocks(ACCEPTED_DOC), "2026-12-14T08:50:00.000Z")})


def scenario_stale():
    d = make("stale"); did, p = promoted(d, "Login page", "dec-7k2m9q4x", uid(101))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: promoted Document published")
    edited = blocks(ACCEPTED_DOC); edited[2]["text"] += " Also: magic links."
    sim("stale", documents=[doc_row(p, did, True, "2026-12-14T08:50:00.000Z", "2026-12-14T08:57:00.000Z")], pages={p: page(edited, "2026-12-14T08:57:00.000Z")})


def scenario_report():
    d = make("report"); rp = uid(301); vw = report(d, rp)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: published report")
    row = {"database": "inbox", "page_id": rp, "last_edited_time": "2026-12-14T08:50:00.000Z", "properties": {"Brain ID": vw, "Kind": "Report", "Accepted": True, "Accepted at": {"start": "2026-12-14T08:50:00.000Z"}}}
    sim("report", reports=[row], pages={rp: page(report_blocks(REPORT_NEW), "2026-12-14T08:50:00.000Z")})


def scenario_unattended():
    d = make("unattended"); a, pa = promoted(d, "Login page", "dec-7k2m9q4x", uid(101)); b, pb = promoted(d, "Rollout notes", "con-1s6t8e2b", uid(102))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: two promoted Documents published")
    draft = blocks(ACCEPTED_DOC); draft[2]["text"] = "A rough idea the user is still writing."
    sim("unattended", documents=[doc_row(pa, a, True, "2026-12-14T08:50:00.000Z", "2026-12-14T08:50:00.000Z"), doc_row(pb, b, False, None, "2026-12-14T08:55:00.000Z")],
        pages={pa: page(blocks(ACCEPTED_DOC), "2026-12-14T08:50:00.000Z"), pb: page(draft, "2026-12-14T08:55:00.000Z", accepted=False, accepted_at=None)})


def strip_baselines(path):
    t = path.read_text()
    path.write_text("".join(l for l in t.splitlines(keepends=True) if '"@notion_body"' not in l and '"@git_body"' not in l))


def scenario_changed():
    """The page changes between the plan and the apply: the second read (pages/<id>.reread.json) shows a later edit."""
    d = make("changed"); did, p = promoted(d, "Login page", "dec-7k2m9q4x", uid(101))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: promoted Document published")
    later = blocks(ACCEPTED_DOC); later[2]["text"] += " Also: magic links."
    sim("changed", documents=[doc_row(p, did, True, "2026-12-14T08:50:00.000Z", "2026-12-14T08:50:00.000Z")],
        pages={p: page(blocks(ACCEPTED_DOC), "2026-12-14T08:50:00.000Z")}, rereads={p: page(later, "2026-12-14T08:52:00.000Z")})


def scenario_revision():
    """Accepted, but a Proposed revision toggle is still on the page: an unresolved proposal blocks acceptance."""
    d = make("revision"); did, p = promoted(d, "Login page", "dec-7k2m9q4x", uid(101))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: promoted Document published")
    withtoggle = blocks(ACCEPTED_DOC) + [{"type": "toggle", "text": "Proposed revision", "children": [{"type": "paragraph", "text": "A newer draft from Write up, not yet adopted."}]}]
    sim("revision", documents=[doc_row(p, did, True, "2026-12-14T08:50:00.000Z", "2026-12-14T08:50:00.000Z")], pages={p: page(withtoggle, "2026-12-14T08:50:00.000Z")})


def scenario_adopt():
    """A Document published before 0.8.0 (no baselines), accepted; the user chooses to adopt the text from Notion."""
    d = make("adopt"); did, p = promoted(d, "Login page", "dec-7k2m9q4x", uid(101))
    strip_baselines(next((d / "knowledge/references").glob("*.md")))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: promoted Document published before 0.8.0 (no baselines)")
    sim("adopt", documents=[doc_row(p, did, True, "2026-12-14T08:50:00.000Z", "2026-12-14T08:50:00.000Z")], pages={p: page(blocks(ACCEPTED_DOC), "2026-12-14T08:50:00.000Z")})


SCENARIOS = {"import": scenario_import, "stale": scenario_stale, "report": scenario_report, "unattended": scenario_unattended, "changed": scenario_changed, "revision": scenario_revision, "adopt": scenario_adopt}

if __name__ == "__main__":
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind not in SCENARIOS and kind != "all":
        sys.exit(f"usage: setup.py <{'|'.join(SCENARIOS)}|all>")
    prepare()
    for name in (SCENARIOS if kind == "all" else [kind]):
        SCENARIOS[name](); print(B / name)
