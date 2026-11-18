#!/usr/bin/env python3
"""Figures of one `claude -p --output-format json` run: cost, and per transcript (the session and each sub-agent) the model
calls, the peak context and the compactions. The transcripts are Claude Code's own, under ~/.claude/projects.

    python3 measure.py <result.json>
"""
import glob, json, os, sys

res = json.load(open(sys.argv[1]))
sid = res["session_id"]
root = os.path.expanduser("~/.claude/projects")
main = glob.glob(f"{root}/*/{sid}.jsonl")
if len(main) != 1: sys.exit(f"transcript of {sid}: {len(main)} found")
subs = sorted(glob.glob(f"{os.path.dirname(main[0])}/{sid}/subagents/*.jsonl"))


def figures(path):
    calls, peak, compactions, out = {}, 0, 0, 0
    for line in open(path):
        try: e = json.loads(line)
        except ValueError: continue
        if e.get("type") == "system" and e.get("subtype") == "compact_boundary": compactions += 1
        m = e.get("message") or {}
        u = m.get("usage") if e.get("type") == "assistant" else None
        if not u: continue
        ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
        calls[m.get("id") or len(calls)] = (ctx, u.get("output_tokens", 0))
    for ctx, o in calls.values(): peak = max(peak, ctx); out += o
    return {"model_calls": len(calls), "peak_context": peak, "compactions": compactions, "output_tokens": out}


print(json.dumps({
    "cost_usd": round(res.get("total_cost_usd", 0), 2),
    "duration_s": round(res.get("duration_ms", 0) / 1000),
    "turns": res.get("num_turns"),
    "models": {k: round(v.get("costUSD", 0), 2) for k, v in (res.get("modelUsage") or {}).items()},
    "session": figures(main[0]),
    "subagents": [figures(p) for p in subs],
}, indent=1))
